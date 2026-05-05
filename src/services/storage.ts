// src/services/storage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const DAILY_MOOD_RETENTION_DAYS = 180;
type LimitMap = Record<string, number>;
export type DailyLimitSnapshots = Record<string, LimitMap>;
export type StoredMood = 'happy' | 'lightSmile' | 'neutral' | 'dotted';
export type DailyMoodSnapshots = Record<string, StoredMood>;

const pruneOldDateKeys = (
  keyedData: Record<string, unknown>,
  retentionDays: number
): Record<string, unknown> => {
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - retentionDays);
  const cutoffMs = cutoff.getTime();

  return Object.entries(keyedData).reduce<Record<string, unknown>>((acc, [dateKey, value]) => {
    const parsed = new Date(`${dateKey}T00:00:00`).getTime();
    if (!Number.isNaN(parsed) && parsed >= cutoffMs) {
      acc[dateKey] = value;
    }
    return acc;
  }, {});
};

const formatDateKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

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
    await this.saveAllLimits(limits);
  },

  async getAllLimits(): Promise<LimitMap> {
    const data = await AsyncStorage.getItem('@app_limits');
    return data ? JSON.parse(data) : {};
  },

  async getTrackingStartDate(): Promise<string | null> {
    return await AsyncStorage.getItem('@tracking_start_date');
  },

  async ensureTrackingStartDate(): Promise<string> {
    const existing = await this.getTrackingStartDate();
    if (existing) return existing;
    const today = formatDateKey(new Date());
    await AsyncStorage.setItem('@tracking_start_date', today);
    await AsyncStorage.setItem('@current_streak', '0');
    await AsyncStorage.setItem('@last_streak_date', today);
    return today;
  },

  async getDailyLimitSnapshots(): Promise<DailyLimitSnapshots> {
    const data = await AsyncStorage.getItem('@daily_limit_snapshots');
    return data ? JSON.parse(data) : {};
  },

  async saveTodayLimitSnapshot(limits: LimitMap): Promise<void> {
    const snapshots = await this.getDailyLimitSnapshots();
    snapshots[formatDateKey(new Date())] = { ...limits };
    const pruned = pruneOldDateKeys(snapshots, DAILY_MOOD_RETENTION_DAYS) as DailyLimitSnapshots;
    await AsyncStorage.setItem('@daily_limit_snapshots', JSON.stringify(pruned));
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

  async getDailyMoods(): Promise<DailyMoodSnapshots> {
    const data = await AsyncStorage.getItem('@daily_moods');
    return data ? JSON.parse(data) : {};
  },

  async saveDailyMood(dateKey: string, mood: StoredMood): Promise<void> {
    const moods = await this.getDailyMoods();
    moods[dateKey] = mood;
    const prunedMoods = pruneOldDateKeys(moods, DAILY_MOOD_RETENTION_DAYS) as DailyMoodSnapshots;
    await AsyncStorage.setItem('@daily_moods', JSON.stringify(prunedMoods));
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
  async saveAllLimits(limits: LimitMap): Promise<void> {
    await this.ensureTrackingStartDate();
    await AsyncStorage.setItem('@app_limits', JSON.stringify(limits));
    await this.saveTodayLimitSnapshot(limits);
  }
};
