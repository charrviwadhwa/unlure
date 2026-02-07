import { NativeModules, Platform } from 'react-native';

const { UsageModule } = NativeModules;

export interface AppUsage {
  id: string;
  minutes: number;
}

export interface AppInfo {
  appName: string;
  packageName: string;
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
    } catch (e) {
      return [];
    }
  },

  async getInstalledApps(): Promise<AppInfo[]> {
    if (Platform.OS !== 'android') return [];
    try {
      return await UsageModule.getInstalledApps();
    } catch (error) { return []; }
  }
};