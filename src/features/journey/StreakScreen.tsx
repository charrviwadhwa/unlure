import React, { useCallback, useEffect, useState } from 'react';
import { Image, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ScreenTimeService, DailyUsageMap } from '../../services/ScreenTimeService';
import { DailyLimitSnapshots, DailyMoodSnapshots, UserStore } from '../../services/storage';

type StreakAppRow = {
  id: string;
  name: string;
  minutes: number;
  limitMinutes: number;
  iconBase64?: string;
};

type DayMood = 'happy' | 'lightSmile' | 'neutral' | 'dotted';

type DayCell = {
  key: string;
  label: string;
  dayNumber: number;
  completed: boolean;
  mood: DayMood;
};

const moodFace: Record<DayMood, { bg: string; faceColor: string; type: 'smile' | 'neutral' | 'frown' }> = {
  happy: { bg: '#D3D0FF', faceColor: '#5C56B6', type: 'smile' },
  lightSmile: { bg: '#C6E3FF', faceColor: '#528DF5', type: 'smile' },
  neutral: { bg: '#FCEFB4', faceColor: '#C2A320', type: 'neutral' },
  dotted: { bg: '#F8F9FB', faceColor: '#D0933C', type: 'frown' }
};

const FONT_REGULAR = Platform.select({ ios: 'Inter_24pt-Light', android: 'Inter_24pt-Light', default: 'System' });
const FONT_SEMIBOLD = Platform.select({ ios: 'Inter_24pt-Light', android: 'Inter_24pt-Light', default: 'System' });

interface StreakScreenProps {
  onEditApps: () => void;
}

const StreakScreen: React.FC<StreakScreenProps> = ({ onEditApps }) => {
  const [streak, setStreak] = useState(0);
  const [todayApps, setTodayApps] = useState<StreakAppRow[]>([]);
  const [weekCells, setWeekCells] = useState<DayCell[]>([]);
  const [isExceededToday, setIsExceededToday] = useState(false);

  const formatDateKey = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const labelFromPackage = (pkg: string) => {
    const raw = pkg.split('.').pop() || pkg;
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  };

  const getMondayStart = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const resolveMood = useCallback((dayMap: Record<string, number> | undefined, limits: Record<string, number>): DayMood => {
    if (!dayMap) return 'neutral';
    const totalLimit = Object.keys(limits).reduce((acc, pkg) => acc + (limits[pkg] || 0), 0);
    if (totalLimit === 0) return 'neutral';
    const hasExceededApp = Object.keys(limits).some((pkg) => {
      const limit = limits[pkg];
      if (!limit) return false;
      return Math.floor((dayMap[pkg] || 0) / 60000) > limit;
    });
    if (hasExceededApp) return 'dotted';
    const limitedUsage = Object.keys(dayMap).reduce((acc, pkg) => {
      const limit = limits[pkg];
      if (!limit) return acc;
      return acc + Math.floor(dayMap[pkg] / 60000);
    }, 0);
    const ratio = limitedUsage / totalLimit;
    if (ratio <= 0.25) return 'happy';
    if (ratio <= 0.65) return 'lightSmile';
    return 'neutral';
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

  const getMoodForDate = useCallback((
    dateKey: string,
    dayMap: Record<string, number> | undefined,
    limitSnapshots: DailyLimitSnapshots,
    currentLimits: Record<string, number>,
    savedMoods: DailyMoodSnapshots
  ): DayMood => {
    const todayKey = formatDateKey(new Date());
    if (dateKey !== todayKey && savedMoods[dateKey]) return savedMoods[dateKey];
    const limits = getLimitsForDate(dateKey, limitSnapshots, currentLimits);
    return resolveMood(dayMap, limits);
  }, [getLimitsForDate, resolveMood]);

  const calculateStreakFromStats = useCallback((
    stats: DailyUsageMap,
    limitSnapshots: DailyLimitSnapshots,
    currentLimits: Record<string, number>,
    savedMoods: DailyMoodSnapshots
  ) => {
    let count = 0;
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    while (true) {
      const key = formatDateKey(cursor);
      const dayMap = stats[key];
      if (!dayMap) break;
      const mood = getMoodForDate(key, dayMap, limitSnapshots, currentLimits, savedMoods);
      if (mood === 'dotted') break;
      count += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return count;
  }, [getMoodForDate]);

  const load = useCallback(async () => {
    await ScreenTimeService.storeTodayStats();
    const [storedStats, currentStreak, installedApps, limits, limitSnapshots, savedMoods] = await Promise.all([
      ScreenTimeService.getStoredDailyStats(),
      UserStore.getStreak(),
      ScreenTimeService.getInstalledApps(),
      UserStore.getAllLimits(),
      UserStore.getDailyLimitSnapshots(),
      UserStore.getDailyMoods()
    ]);
    await UserStore.saveTodayLimitSnapshot(limits || {});

    const nameMap = installedApps.reduce<Record<string, string>>((acc, app) => {
      acc[app.packageName] = app.appName;
      return acc;
    }, {});

    const todayKey = formatDateKey(new Date());
    const todayMap = (storedStats as DailyUsageMap)[todayKey] || {};
    const todayMood = resolveMood(todayMap, limits || {});
    await UserStore.saveDailyMood(todayKey, todayMood);
    const moodsWithToday = { ...(savedMoods || {}), [todayKey]: todayMood };

    const derivedStreak = calculateStreakFromStats(storedStats as DailyUsageMap, limitSnapshots || {}, limits || {}, moodsWithToday);
    setStreak(currentStreak > 0 ? currentStreak : derivedStreak);

    const rows = Object.keys(todayMap)
      .map((pkg) => ({
        id: pkg,
        name: nameMap[pkg] || labelFromPackage(pkg),
        minutes: Math.floor((todayMap[pkg] || 0) / 60000),
        limitMinutes: limits[pkg] || 0,
        iconBase64: installedApps.find((app) => app.packageName === pkg)?.iconBase64
      }))
      .filter((app) => app.minutes > 0)
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 5);
    setTodayApps(rows);
    setIsExceededToday(rows.some((app) => app.limitMinutes > 0 && app.minutes > app.limitMinutes));

    const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const monday = getMondayStart(new Date());
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    const cells: DayCell[] = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const key = formatDateKey(d);
      const dayMap = (storedStats as DailyUsageMap)[key];
      return {
        key,
        label: labels[i],
        dayNumber: d.getDate(),
        completed: d <= now && Boolean(dayMap),
        mood: getMoodForDate(key, dayMap, limitSnapshots || {}, limits || {}, moodsWithToday)
      };
    });
    setWeekCells(cells);
  }, [calculateStreakFromStats, getMoodForDate, resolveMood]);

  const formatTime = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  };

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.pageTitle}>Streak</Text>
            <Text style={styles.pageDate}>This week</Text>
          </View>
          <TouchableOpacity style={styles.editAppsButton} onPress={onEditApps} activeOpacity={0.86}>
            <Text style={styles.editAppsText}>Edit Apps List</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>{isExceededToday ? 'Needs Recovery' : 'On Track'}</Text>
            </View>
            <Text style={styles.heroMeta}>{`Current streak ${streak}d`}</Text>
          </View>
          <View style={styles.heroBody}>
            <Image
              source={isExceededToday ? require('../../assets/Sad.gif') : require('../../assets/Fire (1).gif')}
              style={styles.heroGif}
              resizeMode="contain"
            />
            <View>
              <Text style={styles.streakNumber}>{streak}</Text>
              <Text style={styles.streakLabel}>Days on fire</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.titleRow}>
            <Text style={styles.cardTitle}>Streak Journey</Text>
            <View style={styles.pill}>
              <Text style={styles.pillText}>Mood Check</Text>
            </View>
          </View>
          <View style={styles.weekStrip}>
            {weekCells.map((cell) => (
              <View key={cell.key} style={styles.weekDay}>
                <Text style={styles.weekLabel}>{cell.label}</Text>
                {cell.completed ? (
                  <View style={[styles.dayBadge, { backgroundColor: moodFace[cell.mood].bg }]}>
                    {cell.mood === 'dotted' && <View style={styles.dottedRing} />}
                    <View style={styles.eyesRow}>
                      <View style={[styles.eye, { backgroundColor: moodFace[cell.mood].faceColor }]} />
                      <View style={[styles.eye, { backgroundColor: moodFace[cell.mood].faceColor }]} />
                    </View>
                    {moodFace[cell.mood].type === 'neutral' ? (
                      <View style={[styles.mouthNeutral, { backgroundColor: moodFace[cell.mood].faceColor }]} />
                    ) : (
                      <View
                        style={[
                          styles.mouthCurve,
                          { borderColor: moodFace[cell.mood].faceColor },
                          moodFace[cell.mood].type === 'frown' && styles.mouthFrown
                        ]}
                      />
                    )}
                  </View>
                ) : (
                  <Text style={styles.dayNumber}>{cell.dayNumber}</Text>
                )}
              </View>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.titleRow}>
            <Text style={styles.cardTitle}>Top Apps</Text>
            <View style={styles.pill}>
              <Text style={styles.pillText}>Today</Text>
            </View>
          </View>
          {todayApps.length === 0 ? (
            <Text style={styles.emptyText}>No tracked usage yet today.</Text>
          ) : (
            todayApps.map((app) => {
              const ratio = app.limitMinutes > 0 ? app.minutes / app.limitMinutes : app.minutes / 120;
              const fillWidth = Math.min(Math.max(ratio * 100, 3), 100);
              const fillColor = ratio >= 1 ? '#101010' : ratio >= 0.8 ? '#4B4B4B' : '#7A7A7A';

              return (
                <View key={app.id} style={styles.appRow}>
                  <View style={styles.appTopRow}>
                    <View style={styles.appNameWrap}>
                      {app.iconBase64 ? (
                        <Image source={{ uri: `data:image/png;base64,${app.iconBase64}` }} style={styles.appIcon} resizeMode="contain" />
                      ) : (
                        <View style={styles.appIconFallback}>
                          <Text style={styles.appIconFallbackText}>{app.name.charAt(0)}</Text>
                        </View>
                      )}
                      <Text style={styles.appName} numberOfLines={1}>{app.name}</Text>
                    </View>
                    <Text style={styles.appMinutes}>
                      {formatTime(app.minutes)}{app.limitMinutes > 0 ? ` / ${formatTime(app.limitMinutes)}` : ''}
                    </Text>
                  </View>
                  <View style={styles.usageTrack}>
                    <View style={[styles.usageFill, { width: `${fillWidth}%`, backgroundColor: fillColor }]} />
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F9' },
  content: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 12 : 16,
    paddingBottom: 120
  },
  pageTitle: { fontSize: 28, color: '#1C1C1E', fontFamily: FONT_SEMIBOLD, fontWeight: '800' },
  pageDate: { marginTop: 2, fontSize: 12, color: '#8E8E93', fontFamily: FONT_REGULAR },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 },
  editAppsButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.58)',
    backgroundColor: 'rgba(255,255,255,0.45)'
  },
  editAppsText: { fontSize: 12, color: '#1C1C1E', fontFamily: FONT_SEMIBOLD },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7E7EC',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10
  },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroBadge: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E2E2',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5
  },
  heroBadgeText: { fontSize: 10, color: '#303030', fontFamily: FONT_REGULAR },
  heroMeta: { fontSize: 12, color: '#5D5D5D', fontFamily: FONT_REGULAR },
  heroBody: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  heroGif: { width: 92, height: 92, marginRight: 10 },
  streakNumber: { fontSize: 40, lineHeight: 42, color: '#121212', fontFamily: FONT_SEMIBOLD },
  streakLabel: { fontSize: 14, color: '#2E2E2E', fontFamily: FONT_REGULAR },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E7E7EC',
    padding: 12,
    backgroundColor: '#FFFFFF',
    marginBottom: 10
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  cardTitle: { fontSize: 14, color: '#1C1C1E', fontFamily: FONT_SEMIBOLD },
  pill: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    backgroundColor: '#F0F1F5',
    borderWidth: 1,
    borderColor: '#E7E7EC'
  },
  pillText: { fontSize: 10, color: '#6E6E73', fontFamily: FONT_REGULAR },
  weekStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E7E7EC',
    paddingVertical: 9,
    paddingHorizontal: 6
  },
  weekDay: { alignItems: 'center', width: '13.7%' },
  weekLabel: { fontSize: 10, color: '#8E8E93', marginBottom: 7, fontFamily: FONT_REGULAR },
  dayBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    position: 'relative'
  },
  dottedRing: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#D6A03D',
    backgroundColor: 'transparent'
  },
  eyesRow: { flexDirection: 'row', gap: 6, marginBottom: 3 },
  eye: { width: 3, height: 3, borderRadius: 2 },
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
    marginTop: 2
  },
  mouthNeutral: {
    width: 8,
    height: 1.5,
    borderRadius: 1,
    marginTop: 2
  },
  dayNumber: { fontSize: 14, color: '#1E1E1E', fontFamily: FONT_REGULAR },
  emptyText: { color: '#6F6F6F', fontFamily: FONT_REGULAR, marginTop: 2 },
  appRow: { borderTopWidth: 1, borderTopColor: '#EDEDED', paddingVertical: 8 },
  appTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  appNameWrap: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  appIcon: { width: 22, height: 22, borderRadius: 6, marginRight: 8 },
  appIconFallback: {
    width: 22,
    height: 22,
    borderRadius: 11,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECECEC'
  },
  appIconFallbackText: { fontSize: 11, color: '#444444', fontFamily: FONT_REGULAR },
  appName: { flex: 1, color: '#1F1F1F', fontSize: 14, fontFamily: FONT_REGULAR },
  appMinutes: { color: '#1F1F1F', fontSize: 14, fontFamily: FONT_SEMIBOLD },
  usageTrack: {
    height: 8,
    width: 110,
    borderRadius: 999,
    backgroundColor: '#E3E3E3',
    overflow: 'hidden',
    marginTop: 6,
    alignSelf: 'flex-end'
  },
  usageFill: { height: '100%', borderRadius: 999 }
});

export default StreakScreen;
