import React, { useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ScreenTimeService, DailyUsageMap } from '../../services/ScreenTimeService';
import { UserStore } from '../../services/storage';

type MonthCell = {
  key: string;
  day: number | null;
  state: 'happy' | 'lightSmile' | 'neutral' | 'angry' | 'broken' | 'empty';
};

export const HomeScreen = () => {
  const [monthDate, setMonthDate] = useState(new Date());
  const [monthLabel, setMonthLabel] = useState('');
  const [days, setDays] = useState<MonthCell[]>([]);

  const formatDateKey = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const buildMonth = (
    date: Date,
    stats: DailyUsageMap,
    limits: Record<string, number>
  ): MonthCell[] => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);

    const totalDays = last.getDate();
    const startWeekday = first.getDay();
    const items: MonthCell[] = [];

    for (let i = 0; i < startWeekday; i += 1) {
      items.push({ key: `blank-${i}`, day: null, state: 'empty' });
    }

    const totalLimit = Object.keys(limits).reduce((acc, pkg) => acc + (limits[pkg] || 0), 0);

    for (let day = 1; day <= totalDays; day += 1) {
      const key = formatDateKey(new Date(year, month, day));
      const dayMap = stats[key];

      if (!dayMap) {
        items.push({ key, day, state: 'empty' });
        continue;
      }

      if (totalLimit === 0) {
        items.push({ key, day, state: 'neutral' });
        continue;
      }

      const limitedUsage = Object.keys(dayMap).reduce((acc, pkg) => {
        const limit = limits[pkg];
        if (!limit) return acc;
        return acc + Math.floor(dayMap[pkg] / 60000);
      }, 0);

      const ratio = limitedUsage / totalLimit;
      if (ratio > 1) {
        items.push({ key, day, state: 'angry' });
      } else if (ratio <= 0.3) {
        items.push({ key, day, state: 'happy' });
      } else if (ratio <= 1) {
        items.push({ key, day, state: 'lightSmile' });
      } else {
        items.push({ key, day, state: 'neutral' });
      }
    }

    const rem = items.length % 7;
    if (rem !== 0) {
      for (let i = 0; i < 7 - rem; i += 1) {
        items.push({ key: `tail-${i}`, day: null, state: 'empty' });
      }
    }

    return items;
  };

  const loadMonth = async (targetDate: Date) => {
    await ScreenTimeService.storeTodayStats();
    const [stats, limits] = await Promise.all([
      ScreenTimeService.getStoredDailyStats(),
      UserStore.getAllLimits()
    ]);

    setMonthLabel(targetDate.toLocaleString('en-US', { month: 'long', year: 'numeric' }));
    setDays(buildMonth(targetDate, stats as DailyUsageMap, limits || {}));
  };

  useEffect(() => {
    loadMonth(monthDate);
  }, [monthDate]);

  const shiftMonth = (delta: number) => {
    const next = new Date(monthDate);
    next.setMonth(next.getMonth() + delta);
    setMonthDate(next);
  };

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date();

  const lightenHex = (hex: string, amount = 0.35) => {
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

  const moodConfig: Record<Exclude<MonthCell['state'], 'empty'>, { mouth: string; bg: string; faceColor: string; eyebrow?: boolean; dotted?: boolean }> = {
    happy: { mouth: '﹀', bg: '#BDE8FF', faceColor: '#2E6279' },
    lightSmile: { mouth: '◡', bg: '#D6CBFF', faceColor: '#5A43A7' },
    neutral: { mouth: '—', bg: '#F9E38D', faceColor: '#6B5E24' },
    angry: { mouth: '︵', bg: '#F7B7BF', faceColor: '#8F1F2D' },
    broken: { mouth: '—', bg: 'transparent', faceColor: '#9E6324', dotted: true }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.monthNav}>
          <TouchableOpacity style={styles.arrowBtn} onPress={() => shiftMonth(-1)}>
            <Text style={styles.arrow}>{'\u2039'}</Text>
          </TouchableOpacity>
          <Text style={styles.monthLabel}>{monthLabel}</Text>
          <TouchableOpacity style={styles.arrowBtn} onPress={() => shiftMonth(1)}>
            <Text style={styles.arrow}>{'\u203A'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.weekRow}>
          {weekdays.map((d) => (
            <View key={d} style={styles.weekChip}>
              <Text style={styles.weekChipText}>{d}</Text>
            </View>
          ))}
        </View>
        <View style={styles.grid}>
          {days.map((cell) => {
            const isBlank = cell.day === null;
            const isToday =
              !isBlank &&
              monthDate.getFullYear() === today.getFullYear() &&
              monthDate.getMonth() === today.getMonth() &&
              cell.day === today.getDate();
            const todayMood =
              !isBlank && cell.state !== 'empty' ? moodConfig[cell.state] : null;
            return (
              <View
                key={cell.key}
                style={[
                  styles.cell,
                  isBlank && styles.blankCell,
                  isToday && styles.todayCell,
                  isToday && todayMood ? { backgroundColor: lightenHex(todayMood.bg, 0.42) } : null
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    isBlank && styles.blankDayText,
                    isToday && styles.todayDayText,
                    isToday && todayMood ? { color: todayMood.faceColor } : null
                  ]}
                >
                  {cell.day ?? ''}
                </Text>
                {!isBlank && (
                  cell.state === 'empty' ? (
                    <View style={[styles.emptyCircle, isToday && styles.todayEmptyCircle]} />
                  ) : (
                    <View
                      style={[
                        styles.iconWrap,
                        { backgroundColor: moodConfig[cell.state].bg },
                        isToday && styles.todayIconWrap,
                        isToday ? { borderColor: moodConfig[cell.state].faceColor } : null
                      ]}
                    >
                      {moodConfig[cell.state].dotted && <View style={styles.dottedRing} />}
                      {moodConfig[cell.state].eyebrow && (
                        <View style={styles.browRow}>
                          <Text style={[styles.browLeft, { color: moodConfig[cell.state].faceColor }]}>{'╲'}</Text>
                          <Text style={[styles.browRight, { color: moodConfig[cell.state].faceColor }]}>{'╱'}</Text>
                        </View>
                      )}
                      <View style={styles.eyesRow}>
                        <View style={[styles.eye, { backgroundColor: moodConfig[cell.state].faceColor }]} />
                        <View style={[styles.eye, { backgroundColor: moodConfig[cell.state].faceColor }]} />
                      </View>
                      <Text style={[styles.mouth, { color: moodConfig[cell.state].faceColor }]}>
                        {moodConfig[cell.state].mouth}
                      </Text>
                    </View>
                  )
                )}
              </View>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ECEFFA' },
  content: { paddingHorizontal: 18, paddingTop: 44, paddingBottom: 120 },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16
  },
  arrowBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DCE4F1'
  },
  arrow: { fontSize: 26, color: '#1A1A1A', marginTop: -2 },
  monthLabel: {
    fontSize: 22,
    fontWeight: '300',
    color: '#141414',
    fontFamily: 'Montserrat-Light'
  },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  weekChip: {
    width: '13.7%',
    height: 40,
    borderRadius: 18,
    backgroundColor: '#D9E0EE',
    alignItems: 'center',
    justifyContent: 'center'
  },
  weekChipText: { color: '#59647A', fontWeight: '300', fontFamily: 'Montserrat-Light', fontSize: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  cell: {
    width: '13.7%',
    minHeight: 104,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D9E2F1',
    marginBottom: 9,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    shadowColor: '#9AA8C5',
    shadowOpacity: 0.12,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1
  },
  blankCell: {
    backgroundColor: '#E7EBF3',
    borderColor: '#E7EBF3'
  },
  todayCell: {
    borderColor: '#9AAAFB',
    backgroundColor: '#EEF1FF',
    shadowColor: '#7488FF',
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3
  },
  dayText: { fontSize: 15, color: '#242424', fontWeight: '300', fontFamily: 'Montserrat-Light' },
  todayDayText: { color: '#3D4FB5', fontWeight: '700' },
  blankDayText: { color: '#C4CAD6' },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F5FA',
    marginBottom: 2
  },
  todayIconWrap: {
    borderWidth: 1,
    borderColor: '#CFD8FF'
  },
  eyesRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 2
  },
  browRow: {
    flexDirection: 'row',
    gap: 8,
    position: 'absolute',
    top: 5
  },
  browLeft: {
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 9
  },
  browRight: {
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 9
  },
  eye: {
    width: 4,
    height: 4,
    borderRadius: 2
  },
  mouth: {
    fontSize: 11,
    lineHeight: 12,
    fontFamily: 'Montserrat-Light'
  },
  emptyCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#C8CFDA'
  },
  todayEmptyCircle: {
    backgroundColor: '#8FA2FF'
  },
  dottedRing: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#D6A03D',
    backgroundColor: 'transparent'
  }
});
