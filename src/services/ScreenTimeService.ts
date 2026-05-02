import { NativeModules, Platform } from 'react-native';

const { UsageModule } = NativeModules;

let storeTodayStatsPromise: Promise<boolean> | null = null;
let storedDailyStatsPromise: Promise<DailyUsageMap> | null = null;
let installedAppsPromise: Promise<AppInfo[]> | null = null;

export interface AppUsage {
  id: string;
  minutes: number;
}

export interface AppInfo {
  appName: string;
  packageName: string;
  iconBase64?: string;
}

export interface DailyUsageMap {
  [date: string]: {
    [packageName: string]: number; // milliseconds
  };
}

export const ScreenTimeService = {
  async getDailyStats(): Promise<AppUsage[]> {
    try {
      const rawStats = await UsageModule.getDailyStats();
      
      // Merge logic just in case the OS still sends fragments
      const merged = rawStats.reduce((acc: any, curr: any) => {
        const id = curr.id || curr.packageName; // Check both keys
        acc[id] = (acc[id] || 0) + curr.totalTime;
        return acc;
      }, {});

      return Object.keys(merged).map(pkg => ({
        id: pkg,
        minutes: Math.floor(merged[pkg] / 60000) // Using floor for accuracy
      }))
      .filter(app => app.minutes > 0)
      .sort((a, b) => b.minutes - a.minutes);
    } catch {
      return [];
    }
  },

  async openUsageAccessSettings(): Promise<void> {
    if (Platform.OS !== 'android') return;
    try {
      await UsageModule.openSettings();
    } catch {
      // no-op
    }
  },

  async storeTodayStats(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    if (storeTodayStatsPromise) return storeTodayStatsPromise;
    try {
      const promise = UsageModule.storeTodayStats()
        .then((result: boolean) => {
          storedDailyStatsPromise = null;
          return result;
        })
        .catch(() => false)
        .finally(() => {
          storeTodayStatsPromise = null;
        });
      storeTodayStatsPromise = promise;
      return await promise;
    } catch {
      storeTodayStatsPromise = null;
      return false;
    }
  },

  async getStoredDailyStats(): Promise<DailyUsageMap> {
    if (Platform.OS !== 'android') return {};
    if (storedDailyStatsPromise) return storedDailyStatsPromise;
    try {
      const promise = UsageModule.getStoredDailyStats()
        .catch(() => ({} as DailyUsageMap));
      storedDailyStatsPromise = promise;
      return await promise;
    } catch { return {}; }
  },

  async getInstalledApps(forceRefresh = false): Promise<AppInfo[]> {
    if (Platform.OS !== 'android') return [];
    if (!forceRefresh && installedAppsPromise) return installedAppsPromise;
    try {
      const promise = UsageModule.getInstalledApps()
        .catch(() => [] as AppInfo[]);
      installedAppsPromise = promise;
      return await promise;
    } catch { return []; }
  }
};
