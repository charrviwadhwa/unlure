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
  }
};