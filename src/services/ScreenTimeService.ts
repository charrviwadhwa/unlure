import { NativeModules, Platform } from 'react-native';

// This name MUST match exactly what you returned in UsageModule.java's getName()
const { UsageModule } = NativeModules;

export interface AppUsageStats {
  packageName: string;
  minutes: number;
}
export interface AppUsage {
  id: string;      // This matches your item.id in the map
  minutes: number;
}

export const ScreenTimeService = {
  // Change the return type from AppUsageStats[] to AppUsage[]
  async getDailyStats(): Promise<AppUsage[]> {
    if (Platform.OS !== 'android') return [];

    try {
      const rawStats = await UsageModule.get24HourStats();
      
      return rawStats
        .map((app: any) => ({
          // Map packageName to id here so the UI is happy
          id: app.packageName, 
          minutes: Math.floor(app.totalTime / 60000),
        }))
        .filter((app: any) => app.minutes > 0)
        .sort((a: any, b: any) => b.minutes - a.minutes);
    } catch (error) {
      console.warn('Usage Stats Error:', error);
      return [];
    }
  },

  /**
   * Opens the Android system settings for Usage Access
   */
  openSettings(): void {
    if (Platform.OS === 'android') {
      UsageModule.openSettings();
    }
  }
};