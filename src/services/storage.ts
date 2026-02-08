// src/services/storage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

// Define the "Schema" for our local storage
interface AppLimit {
  packageName: string;
  limitMinutes: number;
}

export const UserStore = {
  // --- Existing Name Logic ---
  async getName(): Promise<string> {
    const name = await AsyncStorage.getItem('@user_name');
    return name || 'Guest';
  },

  async saveName(name: string): Promise<void> {
    await AsyncStorage.setItem('@user_name', name);
  },

  // --- NEW: App Selection & Limits ---
  async setAppLimit(packageName: string, minutes: number): Promise<void> {
    const limits = await this.getAllLimits();
    limits[packageName] = minutes;
    await AsyncStorage.setItem('@app_limits', JSON.stringify(limits));
  },

  async getAllLimits(): Promise<Record<string, number>> {
    const data = await AsyncStorage.getItem('@app_limits');
    return data ? JSON.parse(data) : {};
  },

  // --- NEW: Streak Logic ---
  async getStreak(): Promise<number> {
    const streak = await AsyncStorage.getItem('@current_streak');
    return streak ? parseInt(streak, 10) : 0;
  },

  async updateStreak(isSuccess: boolean): Promise<void> {
    let current = await this.getStreak();
    if (isSuccess) {
      await AsyncStorage.setItem('@current_streak', (current + 1).toString());
    } else {
      await AsyncStorage.setItem('@current_streak', '0'); // Reset on failure
    }
  },

  async getDailyMoods(): Promise<Record<string, string>> {
    const data = await AsyncStorage.getItem('@daily_moods');
    return data ? JSON.parse(data) : {};
  },

  async saveDailyMood(dateKey: string, mood: string): Promise<void> {
    const moods = await this.getDailyMoods();
    moods[dateKey] = mood;
    await AsyncStorage.setItem('@daily_moods', JSON.stringify(moods));
  },

  async getLastStreakDate(): Promise<string | null> {
    return await AsyncStorage.getItem('@last_streak_date');
  },

  async setLastStreakDate(dateKey: string): Promise<void> {
    await AsyncStorage.setItem('@last_streak_date', dateKey);
  },

  async updateStreakForDate(dateKey: string, isSuccess: boolean): Promise<void> {
    const lastDate = await this.getLastStreakDate();
    if (lastDate === dateKey) return;
    await this.updateStreak(isSuccess);
    await this.setLastStreakDate(dateKey);
  },
  // src/services/storage.ts
async saveAllLimits(limits: Record<string, number>): Promise<void> {
  await AsyncStorage.setItem('@app_limits', JSON.stringify(limits));
}
};
