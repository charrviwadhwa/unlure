import { DeviceEventEmitter, NativeModules, Platform } from 'react-native';

const { UsageModule } = NativeModules;

let storeTodayStatsPromise: Promise<boolean> | null = null;
let storedDailyStatsPromise: Promise<DailyUsageMap> | null = null;
let installedAppsPromise: Promise<AppInfo[]> | null = null;
let lastStoreTodayStatsAt = 0;
const STORE_TODAY_STATS_TTL_MS = 15000;

if (Platform.OS === 'android') {
  DeviceEventEmitter.addListener('UnlureInstalledAppsChanged', () => {
    installedAppsPromise = null;
  });
}

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

export interface FocusModeDecisions {
  protectedApps: Record<string, boolean>;
  bypassedApps: Record<string, boolean>;
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

  async hasUsageAccess(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    try {
      return Boolean(await UsageModule.hasUsageAccess());
    } catch {
      return false;
    }
  },

  async canDrawOverlays(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    try {
      return Boolean(await UsageModule.canDrawOverlays());
    } catch {
      return false;
    }
  },

  async openOverlaySettings(): Promise<void> {
    if (Platform.OS !== 'android') return;
    try {
      await UsageModule.openOverlaySettings();
    } catch {
      // no-op
    }
  },

  async syncFocusModeConfig(
    limits: Record<string, number>,
    appNames: Record<string, string> = {}
  ): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    try {
      return Boolean(await UsageModule.syncFocusModeConfig(limits, appNames));
    } catch {
      return false;
    }
  },

  async storeTodayStats(forceRefresh = false): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    const now = Date.now();
    if (!forceRefresh && storedDailyStatsPromise && now - lastStoreTodayStatsAt < STORE_TODAY_STATS_TTL_MS) {
      return true;
    }
    if (storeTodayStatsPromise) return storeTodayStatsPromise;
    try {
      const promise = UsageModule.storeTodayStats()
        .then((result: boolean) => {
          lastStoreTodayStatsAt = Date.now();
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

  async getTodayFocusModeDecisions(): Promise<FocusModeDecisions> {
    if (Platform.OS !== 'android') return { protectedApps: {}, bypassedApps: {} };
    try {
      return await UsageModule.getTodayFocusModeDecisions();
    } catch {
      return { protectedApps: {}, bypassedApps: {} };
    }
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
