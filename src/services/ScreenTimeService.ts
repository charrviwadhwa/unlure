import { NativeModules, Platform } from 'react-native';

const { UsageModule } = NativeModules;

export interface AppUsage {
  id: string;      // package name
  minutes: number; 
}

export const ScreenTimeService = {
  async getDailyStats(): Promise<AppUsage[]> {
    if (Platform.OS !== 'android') return [];
    try {
      const rawStats = await UsageModule.getDailyStats();
      
      const merged = rawStats.reduce((acc: Record<string, number>, curr: any) => {
        acc[curr.id] = (acc[curr.id] || 0) + curr.totalTime;
        return acc;
      }, {});

      return Object.keys(merged)
        .map(pkg => ({
          id: pkg, 
          minutes: Math.floor(merged[pkg] / 60000), // Change to floor for precision
        }))
        .filter(app => app.minutes > 0)
        .sort((a, b) => b.minutes - a.minutes);
    } catch (error) {
      return [];
    }
  },
  openSettings: () => UsageModule.openSettings(),
};