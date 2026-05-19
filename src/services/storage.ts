// src/services/storage.ts
import { open } from '@op-engineering/op-sqlite';

const db = open({ name: 'unlure.db' });

type DbRow = Record<string, unknown>;

export const formatDateKey = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const today = () => formatDateKey(new Date());
export const yesterday = () => formatDateKey(new Date(Date.now() - 86400000));

export type StoredMood =
  | 'happy'
  | 'lightSmile'
  | 'neutral'
  | 'dotted'
  | 'empty';

export type AppLimit = {
  packageName: string;
  minutes: number;
};

export type DailyLog = {
  date: string;
  mood: StoredMood | null;
  wasClean: boolean;
  totalScreenTime: number;
};

export type StreakInfo = {
  current: number;
  best: number;
  lastDate: string | null;
};

export type DailyLimitSnapshots = Record<string, Record<string, number>>;
export type DailyMoodSnapshots = Record<string, StoredMood>;

export const initDB = (): void => {
  db.executeSync(`
    CREATE TABLE IF NOT EXISTS user (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      name TEXT DEFAULT 'Guest',
      onboarding_complete INTEGER DEFAULT 0,
      tracking_start_date TEXT,
      current_streak INTEGER DEFAULT 0,
      best_streak INTEGER DEFAULT 0,
      last_streak_date TEXT
    )
  `);

  try {
    db.executeSync(`ALTER TABLE user ADD COLUMN focus_goal TEXT DEFAULT ''`);
  } catch {
    // Column already exists on upgraded installs.
  }

  db.executeSync(`
    CREATE TABLE IF NOT EXISTS daily_log (
      date TEXT PRIMARY KEY,
      mood TEXT,
      was_clean INTEGER DEFAULT 0,
      total_screen_time INTEGER DEFAULT 0
    )
  `);

  db.executeSync(`
    CREATE TABLE IF NOT EXISTS app_limits (
      package_name TEXT PRIMARY KEY,
      minutes INTEGER NOT NULL DEFAULT 0
    )
  `);

  db.executeSync(`
    CREATE TABLE IF NOT EXISTS daily_limit_snapshots (
      date TEXT NOT NULL,
      package_name TEXT NOT NULL,
      minutes INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (date, package_name)
    )
  `);

  const cutoff = formatDateKey(new Date(Date.now() - 180 * 86400000));
  db.executeSync('DELETE FROM daily_log WHERE date < ?', [cutoff]);
  db.executeSync('DELETE FROM daily_limit_snapshots WHERE date < ?', [cutoff]);
  db.executeSync('INSERT OR IGNORE INTO user (id) VALUES (1)');
};

const rowToDailyLog = (row: DbRow): DailyLog => ({
  date: row.date as string,
  mood: (row.mood as StoredMood | null) ?? null,
  wasClean: row.was_clean === 1,
  totalScreenTime: (row.total_screen_time as number | undefined) ?? 0,
});

export const DailyLogStore = {
  getLog(dateKey: string): DailyLog | null {
    const result = db.executeSync('SELECT * FROM daily_log WHERE date = ?', [dateKey]);
    const row = result.rows?.[0] as DbRow | undefined;
    return row ? rowToDailyLog(row) : null;
  },

  getMonthLogs(yearMonth: string): DailyLog[] {
    const result = db.executeSync(
      `SELECT * FROM daily_log
       WHERE date LIKE ?
       ORDER BY date ASC`,
      [`${yearMonth}%`]
    );
    return ((result.rows ?? []) as DbRow[]).map(rowToDailyLog);
  },

  getWeekLogs(startDate: string, endDate: string): DailyLog[] {
    const result = db.executeSync(
      `SELECT * FROM daily_log
       WHERE date BETWEEN ? AND ?
       ORDER BY date ASC`,
      [startDate, endDate]
    );
    return ((result.rows ?? []) as DbRow[]).map(rowToDailyLog);
  },

  saveMood(dateKey: string, mood: StoredMood): void {
    db.executeSync(
      `INSERT INTO daily_log (date, mood)
       VALUES (?, ?)
       ON CONFLICT(date) DO UPDATE SET mood = excluded.mood`,
      [dateKey, mood]
    );
  },

  saveScreenTime(dateKey: string, totalMs: number): void {
    db.executeSync(
      `INSERT INTO daily_log (date, total_screen_time)
       VALUES (?, ?)
       ON CONFLICT(date) DO UPDATE SET total_screen_time = excluded.total_screen_time`,
      [dateKey, totalMs]
    );
  },

  markClean(dateKey: string, isClean: boolean): void {
    db.executeSync(
      `INSERT INTO daily_log (date, was_clean)
       VALUES (?, ?)
       ON CONFLICT(date) DO UPDATE SET was_clean = excluded.was_clean`,
      [dateKey, isClean ? 1 : 0]
    );
  },

  getMonthStats(yearMonth: string): {
    cleanDays: number;
    avgScreenTime: number;
    daysOverLimit: number;
  } {
    const result = db.executeSync(
      `SELECT
        SUM(was_clean) AS clean_days,
        AVG(total_screen_time) AS avg_screen_time,
        SUM(CASE WHEN was_clean = 0 THEN 1 ELSE 0 END) AS days_over
       FROM daily_log
       WHERE date LIKE ?
       AND date <= ?`,
      [`${yearMonth}%`, today()]
    );

    const row = result.rows?.[0] as DbRow | undefined;
    return {
      cleanDays: (row?.clean_days as number | undefined) ?? 0,
      avgScreenTime: (row?.avg_screen_time as number | undefined) ?? 0,
      daysOverLimit: (row?.days_over as number | undefined) ?? 0,
    };
  },
};

export const LimitsStore = {
  getAll(): Record<string, number> {
    const result = db.executeSync('SELECT package_name, minutes FROM app_limits');
    const map: Record<string, number> = {};
    for (const row of (result.rows ?? []) as DbRow[]) {
      map[row.package_name as string] = row.minutes as number;
    }
    return map;
  },

  setLimit(packageName: string, minutes: number): void {
    if (minutes <= 0) {
      db.executeSync('DELETE FROM app_limits WHERE package_name = ?', [packageName]);
      return;
    }
    db.executeSync(
      `INSERT INTO app_limits (package_name, minutes)
       VALUES (?, ?)
       ON CONFLICT(package_name) DO UPDATE SET minutes = excluded.minutes`,
      [packageName, minutes]
    );
  },

  removeLimit(packageName: string): void {
    db.executeSync('DELETE FROM app_limits WHERE package_name = ?', [packageName]);
  },

  getLimitedPackages(): string[] {
    const result = db.executeSync('SELECT package_name FROM app_limits WHERE minutes > 0');
    return ((result.rows ?? []) as DbRow[]).map(row => row.package_name as string);
  },
};

export const StreakStore = {
  getStreak(): StreakInfo {
    const result = db.executeSync(
      'SELECT current_streak, best_streak, last_streak_date FROM user WHERE id = 1'
    );
    const row = result.rows?.[0] as DbRow | undefined;
    return {
      current: (row?.current_streak as number | undefined) ?? 0,
      best: (row?.best_streak as number | undefined) ?? 0,
      lastDate: (row?.last_streak_date as string | undefined) ?? null,
    };
  },

  evaluateOnOpen(): void {
    const { lastDate } = this.getStreak();
    const t = today();
    const y = yesterday();

    if (!lastDate || lastDate === t) return;

    if (lastDate < y) {
      db.executeSync(
        'UPDATE user SET current_streak = 0, last_streak_date = ? WHERE id = 1',
        [t]
      );
      return;
    }

    const log = DailyLogStore.getLog(y);
    this.markDayResult(y, Boolean(log?.wasClean));
  },

  markDayResult(dateKey: string, isClean: boolean): void {
    if (isClean) {
      const { current, best } = this.getStreak();
      const next = current + 1;
      db.executeSync(
        `UPDATE user SET
          current_streak = ?,
          best_streak = ?,
          last_streak_date = ?
         WHERE id = 1`,
        [next, Math.max(next, best), dateKey]
      );
      return;
    }

    db.executeSync(
      `UPDATE user SET
        current_streak = 0,
        last_streak_date = ?
       WHERE id = 1`,
      [dateKey]
    );
  },
};

const getSnapshotRows = (): DailyLimitSnapshots => {
  const result = db.executeSync(
    'SELECT date, package_name, minutes FROM daily_limit_snapshots ORDER BY date ASC'
  );
  const snapshots: DailyLimitSnapshots = {};
  for (const row of (result.rows ?? []) as DbRow[]) {
    const dateKey = row.date as string;
    const packageName = row.package_name as string;
    if (!snapshots[dateKey]) snapshots[dateKey] = {};
    snapshots[dateKey][packageName] = row.minutes as number;
  }
  return snapshots;
};

const getMoodRows = (): DailyMoodSnapshots => {
  const result = db.executeSync(
    'SELECT date, mood FROM daily_log WHERE mood IS NOT NULL ORDER BY date ASC'
  );
  const moods: DailyMoodSnapshots = {};
  for (const row of (result.rows ?? []) as DbRow[]) {
    moods[row.date as string] = row.mood as StoredMood;
  }
  return moods;
};

export const UserStore = {
  getName(): string {
    const result = db.executeSync('SELECT name FROM user WHERE id = 1');
    return ((result.rows?.[0] as DbRow | undefined)?.name as string | undefined) ?? 'Guest';
  },

  saveName(name: string): void {
    db.executeSync('UPDATE user SET name = ? WHERE id = 1', [name]);
  },

  getFocusGoal(): string {
    const result = db.executeSync('SELECT focus_goal FROM user WHERE id = 1');
    return ((result.rows?.[0] as DbRow | undefined)?.focus_goal as string | undefined) ?? '';
  },

  saveFocusGoal(goal: string): void {
    db.executeSync('UPDATE user SET focus_goal = ? WHERE id = 1', [goal.trim()]);
  },

  hasCompletedOnboarding(): boolean {
    const result = db.executeSync('SELECT onboarding_complete FROM user WHERE id = 1');
    return ((result.rows?.[0] as DbRow | undefined)?.onboarding_complete as number | undefined) === 1;
  },

  completeOnboarding(): void {
    const t = today();
    db.executeSync(
      `UPDATE user SET
        onboarding_complete = 1,
        tracking_start_date = COALESCE(tracking_start_date, ?),
        last_streak_date = COALESCE(last_streak_date, ?)
       WHERE id = 1`,
      [t, t]
    );
  },

  getTrackingStartDate(): string | null {
    const result = db.executeSync('SELECT tracking_start_date FROM user WHERE id = 1');
    return ((result.rows?.[0] as DbRow | undefined)?.tracking_start_date as string | undefined) ?? null;
  },

  ensureTrackingStartDate(): string {
    const existing = this.getTrackingStartDate();
    if (existing) return existing;
    const t = today();
    db.executeSync(
      `UPDATE user SET
        tracking_start_date = COALESCE(tracking_start_date, ?),
        last_streak_date = COALESCE(last_streak_date, ?)
       WHERE id = 1`,
      [t, t]
    );
    return t;
  },

  getStreak(): number {
    return StreakStore.getStreak().current;
  },

  getAllLimits(): Record<string, number> {
    return LimitsStore.getAll();
  },

  saveAllLimits(limits: Record<string, number>): void {
    db.executeSync('BEGIN TRANSACTION');
    try {
      db.executeSync('DELETE FROM app_limits');
      for (const [packageName, minutes] of Object.entries(limits)) {
        if (minutes > 0) LimitsStore.setLimit(packageName, minutes);
      }
      db.executeSync('COMMIT');
    } catch (error) {
      db.executeSync('ROLLBACK');
      throw error;
    }
  },

  getDailyLimitSnapshots(): DailyLimitSnapshots {
    return getSnapshotRows();
  },

  saveTodayLimitSnapshot(limits: Record<string, number>): void {
    const dateKey = today();
    db.executeSync('DELETE FROM daily_limit_snapshots WHERE date = ?', [dateKey]);
    for (const [packageName, minutes] of Object.entries(limits)) {
      if (minutes <= 0) continue;
      db.executeSync(
        `INSERT INTO daily_limit_snapshots (date, package_name, minutes)
         VALUES (?, ?, ?)
         ON CONFLICT(date, package_name) DO UPDATE SET minutes = excluded.minutes`,
        [dateKey, packageName, minutes]
      );
    }
  },

  getDailyMoods(): DailyMoodSnapshots {
    return getMoodRows();
  },

  saveDailyMood(dateKey: string, mood: StoredMood): void {
    DailyLogStore.saveMood(dateKey, mood);
  },

  getTodayMood(): StoredMood | null {
    const result = db.executeSync('SELECT mood FROM daily_log WHERE date = ?', [today()]);
    return ((result.rows?.[0] as DbRow | undefined)?.mood as StoredMood | undefined) ?? null;
  },

  hasDoneCheckinToday(): boolean {
    return this.getTodayMood() !== null;
  },
};
