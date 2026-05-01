import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  Dimensions,
  Platform,
  StatusBar
} from 'react-native';
import { ScreenTimeService, DailyUsageMap } from '../../services/ScreenTimeService';
import { DailyLimitSnapshots, DailyMoodSnapshots, StoredMood, UserStore } from '../../services/storage';

const { width } = Dimensions.get('window');

const COLORS = {
  bg: '#F5F6F9',
  cardBg: '#FFFFFF',
  textMain: '#1C1C1E',
  textSecondary: '#8E8E93',
  textFaint: '#D1D1D6',
  pillBg: '#F0F1F5',
  selectedCellBg: '#E7E5FF',
  moods: {
    great: { bg: '#D3D0FF', line: '#5C56B6' },
    good: { bg: '#C6E3FF', line: '#528DF5' },
    neutral: { bg: '#FCEFB4', line: '#C2A320' },
    bad: { bg: '#FCE1B9', line: '#D0933C' },
    awful: { bg: '#F8F9FB', line: '#D0933C' },
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
type CalendarItem = { date: string; isCurrentMonth: boolean; mood: MoodType; isSelected?: boolean };

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const MoodFace = ({ type }: { type: MoodType }) => {
  const theme = COLORS.moods[type];

  if (type === MOOD_TYPES.EMPTY) {
    return (
      <View style={[styles.faceContainer, styles.transparentFace]}>
        <View style={styles.emptyDot} />
      </View>
    );
  }

  const isFrown = type === MOOD_TYPES.AWFUL;
  const isNeutral = type === MOOD_TYPES.NEUTRAL;
  const isDotted = type === MOOD_TYPES.AWFUL;

  return (
    <View style={[styles.faceContainer, { backgroundColor: theme.bg }, !isDotted && { borderColor: theme.line, borderWidth: 1 }]}>
      {isDotted ? <View style={[styles.dottedFaceRing, { borderColor: theme.line }]} /> : null}
      <View style={styles.eyesContainer}>
        <View>
          <View style={[styles.eye, { backgroundColor: theme.line }]} />
        </View>
        <View>
          <View style={[styles.eye, { backgroundColor: theme.line }]} />
        </View>
      </View>
      {isNeutral ? (
        <View style={[styles.mouthNeutral, { backgroundColor: theme.line }]} />
      ) : (
        <View
          style={[
            styles.mouthCurve,
            { borderColor: theme.line },
            isFrown && styles.mouthFrown
          ]}
        />
      )}
    </View>
  );
};

export const HomeScreen = () => {
  const [monthDate, setMonthDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState<CalendarItem[]>([]);

  const formatDateKey = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const resolveMood = useCallback((dayMap: Record<string, number> | undefined, limits: Record<string, number>): MoodType => {
    if (!dayMap) return MOOD_TYPES.EMPTY;
    const totalLimit = Object.keys(limits).reduce((acc, pkg) => acc + (limits[pkg] || 0), 0);
    if (totalLimit === 0) return MOOD_TYPES.NEUTRAL;
    const hasExceededApp = Object.keys(limits).some((pkg) => {
      const limit = limits[pkg];
      if (!limit) return false;
      return Math.floor((dayMap[pkg] || 0) / 60000) > limit;
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

  const resolveStoredMood = useCallback((dayMap: Record<string, number> | undefined, limits: Record<string, number>): StoredMood => {
    const mood = resolveMood(dayMap, limits);
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
    const num = parseInt(full, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
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
    savedMoods: DailyMoodSnapshots
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

    for (let day = 1; day <= totalDays; day += 1) {
      const dateObj = new Date(year, month, day);
      const dateKey = formatDateKey(dateObj);
      const dayMap = stats[dateKey];
      const dayLimits = getLimitsForDate(dateKey, snapshots, currentLimits);
      const isToday = isCurrentVisibleMonth && today.getDate() === day;
      const mood = !isToday && savedMoods[dateKey]
        ? moodFromStored(savedMoods[dateKey])
        : resolveMood(dayMap, dayLimits);
      items.push({
        date: String(day),
        isCurrentMonth: true,
        mood,
        isSelected: isToday
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
    const [stats, limits, limitSnapshots, savedMoods] = await Promise.all([
      ScreenTimeService.getStoredDailyStats(),
      UserStore.getAllLimits(),
      UserStore.getDailyLimitSnapshots(),
      UserStore.getDailyMoods()
    ]);
    await UserStore.saveTodayLimitSnapshot(limits || {});
    const todayKey = formatDateKey(new Date());
    const todayMood = resolveStoredMood((stats as DailyUsageMap)[todayKey], limits || {});
    await UserStore.saveDailyMood(todayKey, todayMood);
    buildCalendar(targetDate, stats as DailyUsageMap, limitSnapshots || {}, limits || {}, { ...(savedMoods || {}), [todayKey]: todayMood });
  }, [buildCalendar, resolveStoredMood]);

  useEffect(() => {
    load(monthDate);
  }, [load, monthDate]);

  const monthTitle = useMemo(
    () => monthDate.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
    [monthDate]
  );

  const shiftMonth = (delta: number) => {
    setMonthDate((prev) => {
      const next = new Date(prev);
      next.setMonth(next.getMonth() + delta);
      return next;
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.chevronButton} onPress={() => shiftMonth(-1)}>
            <Text style={styles.chevron}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.monthTitle}>{monthTitle}</Text>
          <TouchableOpacity style={styles.chevronButton} onPress={() => shiftMonth(1)}>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
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
                  item.isSelected ? styles.cellPillSelected : null,
                  item.isSelected
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
                    item.isSelected && styles.dateTextSelected
                  ]}
                >
                  {item.date}
                </Text>
                <MoodFace type={item.mood} />
              </View>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
};

const CELL_WIDTH = (width - 48 - 36) / 7;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg
  },
  container: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 12 : 16
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textMain
  },
  chevronButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.cardBg,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2
  },
  chevron: {
    fontSize: 24,
    color: COLORS.textMain,
    lineHeight: 26,
    marginLeft: 1
  },
  daysOfWeekContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16
  },
  dayPill: {
    width: CELL_WIDTH,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.pillBg,
    justifyContent: 'center',
    alignItems: 'center'
  },
  dayText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500'
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between'
  },
  cellPill: {
    width: CELL_WIDTH,
    height: 75,
    borderRadius: 22,
    backgroundColor: COLORS.cardBg,
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
    marginBottom: 10
  },
  cellPillSelected: {
    backgroundColor: COLORS.selectedCellBg
  },
  dateText: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.textMain,
    marginBottom: 8
  },
  dateTextFaint: {
    color: COLORS.textFaint
  },
  dateTextSelected: {
    fontWeight: '700'
  },
  faceContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center'
  },
  transparentFace: {
    backgroundColor: 'transparent'
  },
  emptyQuestionMark: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textFaint
  },
  emptyDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#C5C6CC'
  },
  eyesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 12,
    marginBottom: 3,
    marginTop: 2
  },
  eye: {
    width: 3,
    height: 3,
    borderRadius: 1.5
  },
  dottedFaceRing: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    backgroundColor: 'transparent'
  },
  mouthCurve: {
    width: 10,
    height: 5,
    borderBottomWidth: 1.5,
    borderLeftWidth: 1.5,
    borderRightWidth: 1.5,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6
  },
  mouthFrown: {
    transform: [{ rotate: '180deg' }],
    marginTop: 2,
    borderBottomWidth: 1.5,
    borderLeftWidth: 1.5,
    borderRightWidth: 1.5
  },
  mouthNeutral: {
    width: 8,
    height: 1.5,
    borderRadius: 1,
    marginTop: 2
  }
});

export default HomeScreen;
