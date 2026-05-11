import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  StatusBar,
  InteractionManager,
  Animated
} from 'react-native';
import { useColorScheme } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Circle, Path } from 'react-native-svg';
import { ScreenTimeService, DailyUsageMap, FocusModeDecisions } from '../../services/ScreenTimeService';
import { DailyLimitSnapshots, DailyMoodSnapshots, StoredMood, UserStore } from '../../services/storage';
import { useMidnightRefresh } from '../../hooks/useMidnightRefresh';

const { width } = Dimensions.get('window');
const FONT_SANS = Platform.select({ ios: 'Geist-Regular', android: 'Geist-Regular', default: 'System' });
const FONT_SANS_SEMIBOLD = Platform.select({ ios: 'Geist-SemiBold', android: 'Geist-SemiBold', default: 'System' });
const FONT_MONO = Platform.select({ ios: 'GeistMono-Regular', android: 'GeistMono-Regular', default: 'monospace' });
const FONT_SCRIPT = Platform.select({ ios: 'PlaywriteDESAS-Light', android: 'PlaywriteDESAS-Light', default: 'System' });

const COLORS = {
  bg: '#FFFFFF',
  cardBg: '#FFFFFF',
  textMain: '#000000',
  textSecondary: '#6F737C',
  textFaint: '#B8BBC3',
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
type PeriodMode = 'month' | 'week';

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

const ChevronIcon = ({ direction, color = '#000000' }: { direction: 'left' | 'right'; color?: string }) => (
  <Svg width={18} height={18} viewBox="0 0 24 24">
    <Path
      d={direction === 'left' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'}
      fill="none"
      stroke={color}
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

const getDayTotalMinutes = (dayMap: Record<string, number> | undefined) =>
  Math.floor(Object.values(dayMap || {}).reduce((sum, ms) => sum + ms, 0) / 60000);

const formatTime = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

const labelFromPackage = (pkg: string) => {
  const raw = pkg.split('.').pop() || pkg;
  return raw.charAt(0).toUpperCase() + raw.slice(1);
};

export const HomeScreen = ({ active = true }: { active?: boolean }) => {
  const isDark = useColorScheme() === 'dark';
  const theme = {
    bg: isDark ? '#121418' : COLORS.bg,
    panel: isDark ? 'rgba(255,255,255,0.055)' : 'rgba(255,255,255,0.74)',
    panelEmpty: isDark ? 'rgba(255,255,255,0.035)' : 'rgba(255,255,255,0.52)',
    text: isDark ? '#FFFFFF' : COLORS.textMain,
    subtext: isDark ? '#A5ACB8' : COLORS.textSecondary,
    faint: isDark ? '#8A93A6' : '#B8BBC3',
    quietDate: isDark ? '#8A93A6' : '#989BA5',
    pill: isDark ? 'rgba(255,255,255,0.06)' : '#F4F1EA',
    dayPill: isDark ? 'rgba(255,255,255,0.06)' : '#F4F1EA',
    border: isDark ? 'rgba(255,255,255,0.08)' : '#EEE8DC'
  };
  const screenGradientColors = isDark
    ? ['#121418', '#14151A', '#161A22', '#121418']
    : ['#FFFFFF', '#FBFDFF', '#FFFFFF'];
  const [monthDate, setMonthDate] = useState(new Date());
  const [periodMode, setPeriodMode] = useState<PeriodMode>('month');
  const [calendarData, setCalendarData] = useState<CalendarItem[]>([]);
  const [statsCache, setStatsCache] = useState<DailyUsageMap>({});
  const [limitsCache, setLimitsCache] = useState<Record<string, number>>({});
  const [limitSnapshotsCache, setLimitSnapshotsCache] = useState<DailyLimitSnapshots>({});
  const [savedMoodsCache, setSavedMoodsCache] = useState<DailyMoodSnapshots>({});
  const [focusDecisionsCache, setFocusDecisionsCache] = useState<FocusModeDecisions>(EMPTY_FOCUS_DECISIONS);
  const [trackingStartDate, setTrackingStartDate] = useState(formatDateKey(new Date()));
  const [refreshing, setRefreshing] = useState(false);
  const periodToggleAnim = useRef(new Animated.Value(0)).current;

  const resolveMood = useCallback((
    dayMap: Record<string, number> | undefined,
    limits: Record<string, number>,
    focusDecisions: FocusModeDecisions = EMPTY_FOCUS_DECISIONS
  ): MoodType => {
    if (!dayMap) return MOOD_TYPES.EMPTY;
    const totalLimit = Object.keys(limits).reduce((acc, pkg) => acc + (limits[pkg] || 0), 0);
    if (totalLimit === 0) return MOOD_TYPES.EMPTY;
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
    if (mood === MOOD_TYPES.EMPTY) return 'empty';
    return 'neutral';
  }, [resolveMood]);

  const moodFromStored = useCallback((mood: StoredMood): MoodType => {
    if (mood === 'happy') return MOOD_TYPES.GREAT;
    if (mood === 'lightSmile') return MOOD_TYPES.GOOD;
    if (mood === 'dotted') return MOOD_TYPES.AWFUL;
    if (mood === 'empty') return MOOD_TYPES.EMPTY;
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
    startDateKey: string,
    mode: PeriodMode
  ) => {
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();
    const today = new Date();
    const todayKey = formatDateKey(today);
    const trackingStartMs = new Date(`${startDateKey}T00:00:00`).getTime();
    const createCurrentItem = (dateObj: Date): CalendarItem => {
      const dateKey = formatDateKey(dateObj);
      const isBeforeTrackingStart = dateObj.getTime() < trackingStartMs;
      const dayMap = stats[dateKey];
      const dayLimits = getLimitsForDate(dateKey, snapshots, currentLimits);
      const hasLimits = Object.values(dayLimits).some((limit) => limit > 0);
      const isToday = dateKey === todayKey;
      const dayFocusDecisions = isToday ? focusDecisions : EMPTY_FOCUS_DECISIONS;
      const mood = isBeforeTrackingStart
        ? MOOD_TYPES.EMPTY
        : !hasLimits
          ? MOOD_TYPES.EMPTY
          : !isToday && savedMoods[dateKey]
            ? moodFromStored(savedMoods[dateKey])
            : resolveMood(dayMap, dayLimits, dayFocusDecisions);
      return {
        date: String(dateObj.getDate()),
        dateKey,
        isCurrentMonth: true,
        mood,
        isToday
      };
    };

    if (mode === 'week') {
      const start = new Date(targetDate);
      start.setDate(targetDate.getDate() - targetDate.getDay());
      start.setHours(0, 0, 0, 0);
      const items = Array.from({ length: 7 }, (_, i) => {
        const dateObj = new Date(start);
        dateObj.setDate(start.getDate() + i);
        return createCurrentItem(dateObj);
      });
      setCalendarData(items);
      return;
    }

    const first = new Date(year, month, 1);
    const totalDays = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();
    const startPadding = first.getDay();
    const items: CalendarItem[] = [];

    for (let i = startPadding; i > 0; i -= 1) {
      const day = prevMonthDays - i + 1;
      items.push({ date: String(day), isCurrentMonth: false, mood: MOOD_TYPES.EMPTY });
    }

    for (let day = 1; day <= totalDays; day += 1) {
      const dateObj = new Date(year, month, day);
      items.push(createCurrentItem(dateObj));
    }

    let tail = 1;
    while (items.length % 7 !== 0) {
      items.push({ date: String(tail), isCurrentMonth: false, mood: MOOD_TYPES.EMPTY });
      tail += 1;
    }

    setCalendarData(items);
  }, [getLimitsForDate, moodFromStored, resolveMood]);

  const load = useCallback(async (targetDate: Date, mode: PeriodMode = periodMode) => {
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
    buildCalendar(targetDate, nextStats, nextLimitSnapshots, nextLimits, nextSavedMoods, focusDecisions, loadedTrackingStartDate, mode);
  }, [buildCalendar, periodMode, resolveStoredMood]);

  useEffect(() => {
    if (!active) return;
    const task = InteractionManager.runAfterInteractions(() => load(new Date()));
    return () => task.cancel();
  }, [active, load]);

  useEffect(() => {
    buildCalendar(monthDate, statsCache, limitSnapshotsCache, limitsCache, savedMoodsCache, focusDecisionsCache, trackingStartDate, periodMode);
  }, [buildCalendar, focusDecisionsCache, limitSnapshotsCache, limitsCache, monthDate, periodMode, savedMoodsCache, statsCache, trackingStartDate]);

  const refreshCurrentMonth = useCallback(() => {
    const now = new Date();
    setMonthDate(now);
    load(now, periodMode);
  }, [load, periodMode]);

  useMidnightRefresh(refreshCurrentMonth);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load(monthDate, periodMode);
    } finally {
      setRefreshing(false);
    }
  }, [load, monthDate, periodMode]);

  const periodTitle = useMemo(() => {
    if (periodMode === 'month') return monthDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    const start = new Date(monthDate);
    start.setDate(monthDate.getDate() - monthDate.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const sameMonth = start.getMonth() === end.getMonth();
    const startLabel = start.toLocaleString('en-US', { month: 'short', day: 'numeric' });
    const endLabel = end.toLocaleString('en-US', sameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' });
    return `${startLabel} - ${endLabel}`;
  }, [monthDate, periodMode]);

  useMemo(() => {
    const currentMonthItems = calendarData.filter((item) => item.isCurrentMonth);
    const cleanDays = currentMonthItems.filter((item) => item.mood !== MOOD_TYPES.EMPTY && item.mood !== MOOD_TYPES.AWFUL).length;
    const overDays = currentMonthItems.filter((item) => item.mood === MOOD_TYPES.AWFUL).length;
    return `${cleanDays} clean ${cleanDays === 1 ? 'day' : 'days'} • ${overDays} over-limit ${overDays === 1 ? 'day' : 'days'}`;
  }, [calendarData]);

  const shiftMonth = (delta: number) => {
    setMonthDate((prev) => {
      const next = new Date(prev);
      if (periodMode === 'week') {
        next.setDate(next.getDate() + (delta * 7));
      } else {
        next.setMonth(next.getMonth() + delta);
      }
      return next;
    });
  };

  const periodStats = useMemo(() => {
    const items = calendarData.filter((item) => item.isCurrentMonth && item.dateKey);
    const cleanDays = items.filter((item) => item.mood !== MOOD_TYPES.EMPTY && item.mood !== MOOD_TYPES.AWFUL).length;
    const trackedDays = items.filter((item) => item.mood !== MOOD_TYPES.EMPTY).length;
    const overDays = items.filter((item) => item.mood === MOOD_TYPES.AWFUL).length;
    const totalMinutes = items.reduce((sum, item) => sum + getDayTotalMinutes(item.dateKey ? statsCache[item.dateKey] : undefined), 0);
    let best = 0;
    let running = 0;
    items.forEach((item) => {
      const isClean = item.mood !== MOOD_TYPES.EMPTY && item.mood !== MOOD_TYPES.AWFUL;
      if (isClean) {
        running += 1;
        best = Math.max(best, running);
      } else {
        running = 0;
      }
    });
    return {
      cleanDays,
      overDays,
      averageMinutes: trackedDays > 0 ? Math.floor(totalMinutes / trackedDays) : 0,
      bestStreak: best
    };
  }, [calendarData, statsCache]);

  const insightLine = useMemo(() => {
    const items = calendarData.filter((item) => item.isCurrentMonth && item.dateKey);
    const weekendItems = items.filter((item) => {
      const day = new Date(`${item.dateKey}T00:00:00`).getDay();
      return day === 0 || day === 6;
    });
    const weekendOver = weekendItems.filter((item) => item.mood === MOOD_TYPES.AWFUL).length;
    if (weekendItems.length > 0 && weekendOver > 0) {
      return `Weekends are harder for you. ${weekendOver} of ${weekendItems.length} were over limit.`;
    }
    if (periodStats.overDays > 0) {
      return `${periodStats.overDays} day${periodStats.overDays === 1 ? '' : 's'} crossed a limit in this ${periodMode}.`;
    }
    if (periodStats.cleanDays > 0) {
      return `Your clean days are holding steady this ${periodMode}.`;
    }
    return 'Patterns will appear here once a few tracked days build up.';
  }, [calendarData, periodMode, periodStats.cleanDays, periodStats.overDays]);

  const weeklyMoodItems = useMemo(
    () => calendarData
      .filter((item) => item.isCurrentMonth && item.dateKey)
      .slice(0, 7)
      .map((item) => ({
        ...item,
        label: item.dateKey ? new Date(`${item.dateKey}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' }).charAt(0) : ''
      })),
    [calendarData]
  );

  const bestDecision = useMemo(() => {
    const wins = calendarData
      .filter((item) => item.isCurrentMonth && item.dateKey)
      .flatMap((item) => {
        const dayLimits = getLimitsForDate(item.dateKey || '', limitSnapshotsCache, limitsCache);
        return Object.entries(dayLimits)
          .filter(([, limit]) => limit > 0)
          .map(([pkg, limit]) => {
            const minutes = Math.floor(((item.dateKey && statsCache[item.dateKey]?.[pkg]) || 0) / 60000);
            return {
              dateKey: item.dateKey || '',
              appName: pkg,
              minutes,
              limit,
              score: limit - minutes
            };
          })
          .filter((win) => win.minutes > 0 && win.minutes < win.limit && win.score >= 5);
      })
      .sort((a, b) => b.score - a.score);
    const win = wins[0];
    if (!win) return 'Best decisions will appear when you stop before a limit.';
    const day = new Date(`${win.dateKey}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long' });
    return `${day} - you stopped ${labelFromPackage(win.appName)} at ${formatTime(win.minutes)}`;
  }, [calendarData, getLimitsForDate, limitSnapshotsCache, limitsCache, statsCache]);

  const biggestSlip = useMemo(() => {
    const slips = calendarData
      .filter((item) => item.isCurrentMonth && item.dateKey)
      .flatMap((item) => {
        const dayLimits = getLimitsForDate(item.dateKey || '', limitSnapshotsCache, limitsCache);
        return Object.entries(dayLimits)
          .filter(([, limit]) => limit > 0)
          .map(([pkg, limit]) => {
            const minutes = Math.floor(((item.dateKey && statsCache[item.dateKey]?.[pkg]) || 0) / 60000);
            return {
              dateKey: item.dateKey || '',
              appName: pkg,
              minutes,
              overBy: minutes - limit
            };
          })
          .filter((slip) => slip.overBy > 0);
      })
      .sort((a, b) => b.overBy - a.overBy);
    const slip = slips[0];
    if (!slip) return 'No clear slip-up this week.';
    const day = new Date(`${slip.dateKey}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long' });
    return `${day}: ${labelFromPackage(slip.appName)} went ${formatTime(slip.overBy)} over.`;
  }, [calendarData, getLimitsForDate, limitSnapshotsCache, limitsCache, statsCache]);

  const handlePeriodModeChange = (mode: PeriodMode) => {
    if (mode === periodMode) return;
    setPeriodMode(mode);
    Animated.spring(periodToggleAnim, {
      toValue: mode === 'month' ? 0 : 1,
      useNativeDriver: true,
      friction: 10,
      tension: 160
    }).start();
    buildCalendar(monthDate, statsCache, limitSnapshotsCache, limitsCache, savedMoodsCache, focusDecisionsCache, trackingStartDate, mode);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]}>
      <LinearGradient colors={screenGradientColors} style={styles.screenGradient}>
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
            <Text style={[styles.brandMark, { color: isDark ? '#AAB0BD' : '#6E6E73' }]}>unlure</Text>
            <Text style={[styles.pageTitle, { color: theme.text }]}>Analytics</Text>
            <Text style={[styles.monthTitle, { color: theme.subtext }]}>{periodTitle}</Text>
          </View>
          <View style={[styles.monthControls, { backgroundColor: theme.pill, borderColor: theme.border }]}>
            <TouchableOpacity style={styles.chevronButton} onPress={() => shiftMonth(-1)} activeOpacity={0.76}>
              <ChevronIcon direction="left" color={theme.text} />
            </TouchableOpacity>
            <View style={styles.chevronDivider} />
            <TouchableOpacity style={styles.chevronButton} onPress={() => shiftMonth(1)} activeOpacity={0.76}>
              <ChevronIcon direction="right" color={theme.text} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.periodToggle, { backgroundColor: theme.pill, borderColor: theme.border }]}>
          <Animated.View
            style={[
              styles.periodActiveSegment,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF',
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#D8D8DE',
                transform: [{ translateX: periodToggleAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 69] }) }]
              }
            ]}
          />
          <TouchableOpacity
            style={styles.periodToggleButton}
            onPress={() => handlePeriodModeChange('month')}
            activeOpacity={0.72}
          >
            <Text style={[styles.periodToggleText, { color: periodMode === 'month' ? theme.text : theme.subtext }]}>Month</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.periodToggleButton}
            onPress={() => handlePeriodModeChange('week')}
            activeOpacity={0.72}
          >
            <Text style={[styles.periodToggleText, { color: periodMode === 'week' ? theme.text : theme.subtext }]}>Week</Text>
          </TouchableOpacity>
        </View>

        {periodMode === 'week' ? (
          <View style={styles.weekMoodBoard}>
            {weeklyMoodItems.map((item) => (
              <View
                key={item.dateKey || item.date}
                style={[
                  styles.weekMoodChip,
                  {
                    backgroundColor: item.mood === MOOD_TYPES.EMPTY ? theme.panelEmpty : theme.panel,
                    borderColor: item.mood === MOOD_TYPES.EMPTY ? theme.border : COLORS.moods[item.mood].line
                  }
                ]}
              >
                <Text style={[styles.weekMoodLabel, { color: theme.subtext }]}>{item.label}</Text>
                <MoodFace type={item.mood} />
              </View>
            ))}
          </View>
        ) : (
          <>
            <View style={styles.daysOfWeekContainer}>
              {DAYS_OF_WEEK.map((day) => (
                <View key={day} style={[styles.dayPill, { backgroundColor: theme.dayPill }]}>
                  <Text style={[styles.dayText, { color: theme.subtext }]}>{day}</Text>
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
                      { backgroundColor: theme.panel, borderColor: theme.border },
                      item.mood === MOOD_TYPES.EMPTY && styles.cellPillEmpty,
                      item.mood === MOOD_TYPES.EMPTY && { backgroundColor: theme.panelEmpty, borderColor: theme.border },
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
                        { color: theme.text },
                        isFaint && styles.dateTextFaint,
                        isFaint && { color: theme.faint },
                        item.mood === MOOD_TYPES.EMPTY && item.isCurrentMonth && styles.dateTextQuiet,
                        item.mood === MOOD_TYPES.EMPTY && item.isCurrentMonth && { color: theme.quietDate },
                        item.isToday && styles.dateTextSelected,
                        item.isToday && { color: isDark ? '#1A1A24' : '#111111' }
                      ]}
                    >
                      {item.date}
                    </Text>
                    <MoodFace type={item.mood} />
                  </View>
                );
              })}
            </View>
          </>
        )}

        <View style={styles.behaviorStatsRow}>
          <Text style={[styles.behaviorStatText, { color: theme.subtext }]}>
            {`${periodStats.cleanDays} clean days | ${formatTime(periodStats.averageMinutes)} avg / day | best streak: ${periodStats.bestStreak}`}
          </Text>
        </View>
        <Text style={[styles.insightLine, { color: isDark ? '#8A93A6' : '#888888' }]}>{insightLine}</Text>
        {periodMode === 'week' ? (
          <View style={styles.weekBentoGrid}>
            <View style={[styles.weekBentoCard, { backgroundColor: theme.panel, borderColor: theme.border }]}>
              <Text style={[styles.weekBentoLabel, { color: theme.subtext }]}>Best decision</Text>
              <Text style={[styles.weekBentoText, { color: theme.text }]}>{bestDecision}</Text>
            </View>
            <View style={[styles.weekBentoCard, { backgroundColor: theme.panel, borderColor: theme.border }]}>
              <Text style={[styles.weekBentoLabel, { color: theme.subtext }]}>Biggest slip</Text>
              <Text style={[styles.weekBentoText, { color: theme.text }]}>{biggestSlip}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.legendRow}>
          {LEGEND_ITEMS.map((mood) => (
            <View key={mood} style={[styles.legendItem, { backgroundColor: theme.dayPill, borderColor: theme.border }]}>
              <View style={[styles.legendDot, { backgroundColor: COLORS.moods[mood].bg, borderColor: COLORS.moods[mood].line }]} />
              <Text style={[styles.legendText, { color: theme.subtext }]}>{MOOD_LABELS[mood]}</Text>
            </View>
          ))}
        </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
};

const CELL_WIDTH = (width - 48 - 42) / 7;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg
  },
  screenGradient: {
    flex: 1
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
    fontFamily: FONT_SANS_SEMIBOLD,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '600',
    color: COLORS.textMain
  },
  brandMark: {
    color: '#6E6E73',
    fontSize: 18,
    lineHeight: 22,
    fontFamily: FONT_SCRIPT,
    fontWeight: '600',
    letterSpacing: 0,
    marginBottom: 2
  },
  monthTitle: {
    marginTop: 4,
    fontSize: 14,
    fontFamily: FONT_SANS,
    fontWeight: '600',
    color: COLORS.textSecondary
  },
  monthSummary: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: FONT_SANS,
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
  periodToggle: {
    width: 150,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    padding: 5,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    position: 'relative'
  },
  periodActiveSegment: {
    position: 'absolute',
    top: 5,
    left: 5,
    width: 69,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2
  },
  periodToggleButton: {
    flex: 1,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1
  },
  periodToggleText: {
    fontFamily: FONT_SANS_SEMIBOLD,
    fontSize: 13,
    fontWeight: '600'
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
    fontFamily: FONT_SANS,
    fontWeight: '500'
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between'
  },
  weekMoodBoard: {
    minHeight: 92,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 18,
    paddingHorizontal: 6
  },
  weekMoodChip: {
    width: CELL_WIDTH,
    height: 66,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  weekMoodLabel: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 7
  },
  behaviorStatsRow: {
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 8
  },
  behaviorStatText: {
    fontFamily: FONT_MONO,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    textAlign: 'center'
  },
  insightLine: {
    fontFamily: FONT_SANS,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
    textAlign: 'center',
    marginBottom: 18
  },
  weekBentoGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    marginBottom: 18
  },
  weekBentoCard: {
    flex: 1,
    minHeight: 104,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    justifyContent: 'space-between'
  },
  weekBentoLabel: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4
  },
  weekBentoText: {
    fontFamily: FONT_SANS,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '500'
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
    fontFamily: FONT_MONO,
    fontWeight: '400',
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
    fontWeight: '500'
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
    fontFamily: FONT_SANS,
    fontWeight: '500'
  },
});

export default HomeScreen;
