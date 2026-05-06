import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
  Platform,
  StatusBar
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { ScreenTimeService, DailyUsageMap, FocusModeDecisions } from '../../services/ScreenTimeService';
import { DailyLimitSnapshots, DailyMoodSnapshots, StoredMood, UserStore } from '../../services/storage';
import { useMidnightRefresh } from '../../hooks/useMidnightRefresh';

const { width } = Dimensions.get('window');

const COLORS = {
  bg: '#FFFFFF',
  cardBg: '#FFFFFF',
  textMain: '#000000',
  textSecondary: '#8E8E93',
  textFaint: '#D1D1D6',
  pillBg: '#F2F2F7',
  moods: {
    great: { bg: '#D3D0FF', line: '#5C56B6' },
    good: { bg: '#C6E3FF', line: '#528DF5' },
    neutral: { bg: '#FCEFB4', line: '#C2A320' },
    bad: { bg: '#FCE1B9', line: '#D0933C' },
    awful: { bg: '#FCE1B9', line: '#D0933C' },
    empty: { bg: '#F8F9FB', line: '#D1D1D6' }
  }
};

const MOOD_TYPES = {
  GREAT: 'great',
  GOOD: 'good',
  NEUTRAL: 'neutral',
  AWFUL: 'awful',
  EMPTY: 'empty'
} as const;

type MoodType = (typeof MOOD_TYPES)[keyof typeof MOOD_TYPES];
type CalendarItem = {
  date: string;
  dateKey?: string;
  isCurrentMonth: boolean;
  mood: MoodType;
  isToday?: boolean;
};

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MOOD_LABELS: Record<MoodType, string> = {
  great: 'Great',
  good: 'Good',
  neutral: 'Close',
  awful: 'Over limit',
  empty: 'No tracking'
};
const LEGEND_ITEMS: MoodType[] = [MOOD_TYPES.GREAT, MOOD_TYPES.GOOD, MOOD_TYPES.NEUTRAL, MOOD_TYPES.AWFUL];
const EMPTY_FOCUS_DECISIONS: FocusModeDecisions = { protectedApps: {}, bypassedApps: {} };

const ChevronIcon = ({ direction }: { direction: 'left' | 'right' }) => (
  <Svg width={18} height={18} viewBox="0 0 24 24">
    <Path
      d={direction === 'left' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'}
      fill="none"
      stroke="#000000"
      strokeWidth={2.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const MoodFace = ({ type }: { type: MoodType }) => {
  const theme = COLORS.moods[type];

  if (type === MOOD_TYPES.EMPTY) {
    return (
      <View style={[styles.faceContainer, styles.transparentFace]} />
    );
  }

  const isFrown = type === MOOD_TYPES.AWFUL;
  const isNeutral = type === MOOD_TYPES.NEUTRAL;

  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={10} fill={theme.bg} stroke={theme.line} strokeWidth={1.6} />
      <Circle cx={8.5} cy={9.5} r={1.45} fill={theme.line} />
      <Circle cx={15.5} cy={9.5} r={1.45} fill={theme.line} />
      {isNeutral ? (
        <Path
          d="M8.5 15.5h7"
          stroke={theme.line}
          strokeWidth={1.7}
          strokeLinecap="round"
        />
      ) : isFrown ? (
        <Path
          d="M8 17c.8-1.8 2.1-2.7 4-2.7s3.2.9 4 2.7"
          fill="none"
          stroke={theme.line}
          strokeWidth={1.7}
          strokeLinecap="round"
        />
      ) : (
        <Path
          d="M8 14.4c.8 1.8 2.1 2.7 4 2.7s3.2-.9 4-2.7"
          fill="none"
          stroke={theme.line}
          strokeWidth={1.7}
          strokeLinecap="round"
        />
      )}
    </Svg>
  );
};

const formatDateKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const HomeScreen = () => {
  const [monthDate, setMonthDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState<CalendarItem[]>([]);
  const [statsCache, setStatsCache] = useState<DailyUsageMap>({});
  const [limitsCache, setLimitsCache] = useState<Record<string, number>>({});
  const [limitSnapshotsCache, setLimitSnapshotsCache] = useState<DailyLimitSnapshots>({});
  const [savedMoodsCache, setSavedMoodsCache] = useState<DailyMoodSnapshots>({});
  const [focusDecisionsCache, setFocusDecisionsCache] = useState<FocusModeDecisions>(EMPTY_FOCUS_DECISIONS);
  const [trackingStartDate, setTrackingStartDate] = useState(formatDateKey(new Date()));
  const [refreshing, setRefreshing] = useState(false);

  const resolveMood = useCallback((
    dayMap: Record<string, number> | undefined,
    limits: Record<string, number>,
    focusDecisions: FocusModeDecisions = EMPTY_FOCUS_DECISIONS
  ): MoodType => {
    if (!dayMap) return MOOD_TYPES.EMPTY;
    const totalLimit = Object.keys(limits).reduce((acc, pkg) => acc + (limits[pkg] || 0), 0);
    if (totalLimit === 0) return MOOD_TYPES.NEUTRAL;
    const hasExceededApp = Object.keys(limits).some((pkg) => {
      const limit = limits[pkg];
      if (!limit) return false;
      const isAtLimit = Math.floor((dayMap[pkg] || 0) / 60000) >= limit;
      if (!isAtLimit) return false;
      if (focusDecisions.bypassedApps[pkg]) return true;
      return !focusDecisions.protectedApps[pkg];
    });
    if (hasExceededApp) return MOOD_TYPES.AWFUL;
    const limitedUsage = Object.keys(dayMap).reduce((acc, pkg) => {
      const limit = limits[pkg];
      if (!limit) return acc;
      return acc + Math.floor(dayMap[pkg] / 60000);
    }, 0);
    const ratio = limitedUsage / totalLimit;
    if (ratio <= 0.25) return MOOD_TYPES.GREAT;
    if (ratio <= 0.65) return MOOD_TYPES.GOOD;
    return MOOD_TYPES.NEUTRAL;
  }, []);

  const resolveStoredMood = useCallback((
    dayMap: Record<string, number> | undefined,
    limits: Record<string, number>,
    focusDecisions: FocusModeDecisions = EMPTY_FOCUS_DECISIONS
  ): StoredMood => {
    const mood = resolveMood(dayMap, limits, focusDecisions);
    if (mood === MOOD_TYPES.GREAT) return 'happy';
    if (mood === MOOD_TYPES.GOOD) return 'lightSmile';
    if (mood === MOOD_TYPES.AWFUL) return 'dotted';
    return 'neutral';
  }, [resolveMood]);

  const moodFromStored = useCallback((mood: StoredMood): MoodType => {
    if (mood === 'happy') return MOOD_TYPES.GREAT;
    if (mood === 'lightSmile') return MOOD_TYPES.GOOD;
    if (mood === 'dotted') return MOOD_TYPES.AWFUL;
    return MOOD_TYPES.NEUTRAL;
  }, []);

  const getLimitsForDate = useCallback((
    dateKey: string,
    snapshots: DailyLimitSnapshots,
    currentLimits: Record<string, number>
  ) => {
    const todayKey = formatDateKey(new Date());
    if (snapshots[dateKey]) return snapshots[dateKey];
    return dateKey === todayKey ? currentLimits : {};
  }, []);

  const lightenHex = (hex: string, amount = 0.48) => {
    const clean = hex.replace('#', '');
    const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    const lr = Math.round(r + (255 - r) * amount);
    const lg = Math.round(g + (255 - g) * amount);
    const lb = Math.round(b + (255 - b) * amount);
    return `rgb(${lr}, ${lg}, ${lb})`;
  };

  const buildCalendar = useCallback((
    targetDate: Date,
    stats: DailyUsageMap,
    snapshots: DailyLimitSnapshots,
    currentLimits: Record<string, number>,
    savedMoods: DailyMoodSnapshots,
    focusDecisions: FocusModeDecisions,
    startDateKey: string
  ) => {
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();
    const first = new Date(year, month, 1);
    const totalDays = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();
    const startPadding = first.getDay();
    const items: CalendarItem[] = [];

    for (let i = startPadding; i > 0; i -= 1) {
      const day = prevMonthDays - i + 1;
      items.push({ date: String(day), isCurrentMonth: false, mood: MOOD_TYPES.EMPTY });
    }

    const today = new Date();
    const isCurrentVisibleMonth = today.getFullYear() === year && today.getMonth() === month;
    const trackingStartMs = new Date(`${startDateKey}T00:00:00`).getTime();

    for (let day = 1; day <= totalDays; day += 1) {
      const dateObj = new Date(year, month, day);
      const dateKey = formatDateKey(dateObj);
      const isBeforeTrackingStart = dateObj.getTime() < trackingStartMs;
      const dayMap = stats[dateKey];
      const dayLimits = getLimitsForDate(dateKey, snapshots, currentLimits);
      const isToday = isCurrentVisibleMonth && today.getDate() === day;
      const dayFocusDecisions = isToday ? focusDecisions : EMPTY_FOCUS_DECISIONS;
      const mood = isBeforeTrackingStart
        ? MOOD_TYPES.EMPTY
        : !isToday && savedMoods[dateKey]
          ? moodFromStored(savedMoods[dateKey])
          : resolveMood(dayMap, dayLimits, dayFocusDecisions);
      items.push({
        date: String(day),
        dateKey,
        isCurrentMonth: true,
        mood,
        isToday
      });
    }

    let tail = 1;
    while (items.length % 7 !== 0) {
      items.push({ date: String(tail), isCurrentMonth: false, mood: MOOD_TYPES.EMPTY });
      tail += 1;
    }

    setCalendarData(items);
  }, [getLimitsForDate, moodFromStored, resolveMood]);

  const load = useCallback(async (targetDate: Date) => {
    await ScreenTimeService.storeTodayStats();
    const [stats, limits, limitSnapshots, savedMoods, loadedTrackingStartDate] = await Promise.all([
      ScreenTimeService.getStoredDailyStats(),
      UserStore.getAllLimits(),
      UserStore.getDailyLimitSnapshots(),
      UserStore.getDailyMoods(),
      UserStore.ensureTrackingStartDate()
    ]);
    const focusDecisions = await ScreenTimeService.getTodayFocusModeDecisions();
    await UserStore.saveTodayLimitSnapshot(limits || {});
    const todayKey = formatDateKey(new Date());
    const todayMood = resolveStoredMood((stats as DailyUsageMap)[todayKey], limits || {}, focusDecisions);
    await UserStore.saveDailyMood(todayKey, todayMood);
    const nextStats = stats as DailyUsageMap;
    const nextLimits = limits || {};
    const nextLimitSnapshots = limitSnapshots || {};
    const nextSavedMoods = { ...(savedMoods || {}), [todayKey]: todayMood };
    setStatsCache(nextStats);
    setLimitsCache(nextLimits);
    setLimitSnapshotsCache(nextLimitSnapshots);
    setSavedMoodsCache(nextSavedMoods);
    setFocusDecisionsCache(focusDecisions);
    setTrackingStartDate(loadedTrackingStartDate);
    buildCalendar(targetDate, nextStats, nextLimitSnapshots, nextLimits, nextSavedMoods, focusDecisions, loadedTrackingStartDate);
  }, [buildCalendar, resolveStoredMood]);

  useEffect(() => {
    load(new Date());
  }, [load]);

  useEffect(() => {
    buildCalendar(monthDate, statsCache, limitSnapshotsCache, limitsCache, savedMoodsCache, focusDecisionsCache, trackingStartDate);
  }, [buildCalendar, focusDecisionsCache, limitSnapshotsCache, limitsCache, monthDate, savedMoodsCache, statsCache, trackingStartDate]);

  const refreshCurrentMonth = useCallback(() => {
    const now = new Date();
    setMonthDate(now);
    load(now);
  }, [load]);

  useMidnightRefresh(refreshCurrentMonth);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load(monthDate);
    } finally {
      setRefreshing(false);
    }
  }, [load, monthDate]);

  const monthTitle = useMemo(
    () => monthDate.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
    [monthDate]
  );

  const monthSummary = useMemo(() => {
    const currentMonthItems = calendarData.filter((item) => item.isCurrentMonth);
    const cleanDays = currentMonthItems.filter((item) => item.mood !== MOOD_TYPES.EMPTY && item.mood !== MOOD_TYPES.AWFUL).length;
    const overDays = currentMonthItems.filter((item) => item.mood === MOOD_TYPES.AWFUL).length;
    return `${cleanDays} clean ${cleanDays === 1 ? 'day' : 'days'} • ${overDays} over-limit ${overDays === 1 ? 'day' : 'days'}`;
  }, [calendarData]);

  const shiftMonth = (delta: number) => {
    setMonthDate((prev) => {
      const next = new Date(prev);
      next.setMonth(next.getMonth() + delta);
      return next;
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.textMain} />}
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
        bounces={false}
        alwaysBounceVertical={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.pageTitle}>Month</Text>
            <Text style={styles.monthTitle}>{monthTitle}</Text>
            <Text style={styles.monthSummary}>{monthSummary}</Text>
          </View>
          <View style={styles.monthControls}>
            <TouchableOpacity style={styles.chevronButton} onPress={() => shiftMonth(-1)} activeOpacity={0.76}>
              <ChevronIcon direction="left" />
            </TouchableOpacity>
            <View style={styles.chevronDivider} />
            <TouchableOpacity style={styles.chevronButton} onPress={() => shiftMonth(1)} activeOpacity={0.76}>
              <ChevronIcon direction="right" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.daysOfWeekContainer}>
          {DAYS_OF_WEEK.map((day) => (
            <View key={day} style={styles.dayPill}>
              <Text style={styles.dayText}>{day}</Text>
            </View>
          ))}
        </View>

        <View style={styles.gridContainer}>
          {calendarData.map((item, index) => {
            const isFaint = !item.isCurrentMonth;
            return (
              <View
                key={`${item.date}-${index}`}
                style={[
                  styles.cellPill,
                  item.mood === MOOD_TYPES.EMPTY && styles.cellPillEmpty,
                  item.isToday
                    ? {
                        backgroundColor: lightenHex(COLORS.moods[item.mood].bg),
                        borderColor: COLORS.moods[item.mood].line
                      }
                    : null
                ]}
              >
                <Text
                  style={[
                    styles.dateText,
                    isFaint && styles.dateTextFaint,
                    item.mood === MOOD_TYPES.EMPTY && item.isCurrentMonth && styles.dateTextQuiet,
                    item.isToday && styles.dateTextSelected
                  ]}
                >
                  {item.date}
                </Text>
                <MoodFace type={item.mood} />
              </View>
            );
          })}
        </View>

        <View style={styles.legendRow}>
          {LEGEND_ITEMS.map((mood) => (
            <View key={mood} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: COLORS.moods[mood].bg, borderColor: COLORS.moods[mood].line }]} />
              <Text style={styles.legendText}>{MOOD_LABELS[mood]}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const CELL_WIDTH = (width - 48 - 42) / 7;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg
  },
  container: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 15 : 15,
    paddingBottom: 176
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 22
  },
  pageTitle: {
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '800',
    color: COLORS.textMain
  },
  monthTitle: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary
  },
  monthSummary: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    color: '#A0A0A6'
  },
  monthControls: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    paddingHorizontal: 5,
    borderRadius: 22,
    backgroundColor: COLORS.pillBg,
    borderWidth: 1,
    borderColor: '#ECECF2'
  },
  chevronButton: {
    width: 38,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center'
  },
  chevronDivider: {
    width: 1,
    height: 20,
    borderRadius: 1,
    backgroundColor: '#D8D8DE'
  },
  daysOfWeekContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  dayPill: {
    width: CELL_WIDTH,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.pillBg,
    justifyContent: 'center',
    alignItems: 'center'
  },
  dayText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '700'
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between'
  },
  cellPill: {
    width: CELL_WIDTH,
    height: 62,
    borderRadius: 20,
    backgroundColor: '#F8F8FA',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 6,
    paddingBottom: 5,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F2F2F5'
  },
  cellPillEmpty: {
    backgroundColor: '#FBFBFC',
    borderColor: '#F4F4F6'
  },
  dateText: {
    fontSize: 14,
    lineHeight: 17,
    fontWeight: '700',
    color: COLORS.textMain,
    marginBottom: 6
  },
  dateTextFaint: {
    color: COLORS.textFaint
  },
  dateTextQuiet: {
    color: '#C5C6CC'
  },
  dateTextSelected: {
    fontWeight: '700'
  },
  faceContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },
  transparentFace: {
    backgroundColor: 'transparent'
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
    marginBottom: 16
  },
  legendItem: {
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8FA'
  },
  legendDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1,
    marginRight: 6
  },
  legendText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '700'
  },
});

export default HomeScreen;
