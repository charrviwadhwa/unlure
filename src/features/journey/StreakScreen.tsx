import React, { useEffect, useState } from 'react';
import { Image, Platform, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { ScreenTimeService, DailyUsageMap } from '../../services/ScreenTimeService';
import { UserStore } from '../../services/storage';

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

const moodFace: Record<DayMood, { mouth: string; bg: string; faceColor: string }> = {
  happy: { mouth: '\uFE40', bg: '#BDE8FF', faceColor: '#2E6279' },
  lightSmile: { mouth: '\u25E1', bg: '#D6CBFF', faceColor: '#5A43A7' },
  neutral: { mouth: '\u2014', bg: '#F9E38D', faceColor: '#6B5E24' },
  dotted: { mouth: '\u2014', bg: 'transparent', faceColor: '#9E6324' }
};

const FONT_REGULAR = Platform.select({ ios: 'Inter_24pt-Light', android: 'Inter_24pt-Light', default: 'System' });
const FONT_SEMIBOLD = Platform.select({ ios: 'Inter_24pt-Light', android: 'Inter_24pt-Light', default: 'System' });

const StreakScreen: React.FC = () => {
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

  const resolveMood = (dayMap: Record<string, number> | undefined, limits: Record<string, number>): DayMood => {
    if (!dayMap) return 'neutral';
    const totalLimit = Object.keys(limits).reduce((acc, pkg) => acc + (limits[pkg] || 0), 0);
    if (totalLimit === 0) return 'neutral';
    const limitedUsage = Object.keys(dayMap).reduce((acc, pkg) => {
      const limit = limits[pkg];
      if (!limit) return acc;
      return acc + Math.floor(dayMap[pkg] / 60000);
    }, 0);
    const ratio = limitedUsage / totalLimit;
    if (ratio > 1) return 'dotted';
    if (ratio <= 0.3) return 'happy';
    if (ratio <= 1) return 'lightSmile';
    return 'neutral';
  };

  const calculateStreakFromStats = (stats: DailyUsageMap, limits: Record<string, number>) => {
    let count = 0;
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    while (true) {
      const key = formatDateKey(cursor);
      const dayMap = stats[key];
      if (!dayMap) break;
      const mood = resolveMood(dayMap, limits || {});
      if (mood === 'dotted') break;
      count += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return count;
  };

  const load = async () => {
    await ScreenTimeService.storeTodayStats();
    const [storedStats, currentStreak, installedApps, limits] = await Promise.all([
      ScreenTimeService.getStoredDailyStats(),
      UserStore.getStreak(),
      ScreenTimeService.getInstalledApps(),
      UserStore.getAllLimits()
    ]);

    const derivedStreak = calculateStreakFromStats(storedStats as DailyUsageMap, limits || {});
    setStreak(currentStreak > 0 ? currentStreak : derivedStreak);

    const nameMap = installedApps.reduce<Record<string, string>>((acc, app) => {
      acc[app.packageName] = app.appName;
      return acc;
    }, {});

    const todayKey = formatDateKey(new Date());
    const todayMap = (storedStats as DailyUsageMap)[todayKey] || {};
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
        mood: resolveMood(dayMap, limits || {})
      };
    });
    setWeekCells(cells);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <LinearGradient
      colors={['#FFC46B', '#FFE2A7', '#FFF7E7', '#F4F7FF']}
      locations={[0, 0.2, 0.45, 0.72]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.container}
    >
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.heroSection}>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>{isExceededToday ? 'Needs Recovery' : 'On Track'}</Text>
            </View>
            <Image
              source={isExceededToday ? require('../../assets/Sad.gif') : require('../../assets/Fire (1).gif')}
              style={styles.heroGif}
              resizeMode="contain"
            />
            <Text style={styles.streakNumber}>{streak}</Text>
            <Text style={styles.streakLabel}>Days on Fire!</Text>
            <Text style={styles.streakSub}>{`🔥 Current Streak: ${streak} Days`}</Text>
          </View>

          <LinearGradient colors={['#FFFFFF', '#F8FBFF']} style={styles.card}>
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
                      <Text style={[styles.dayMouth, { color: moodFace[cell.mood].faceColor }]}>
                        {moodFace[cell.mood].mouth}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.dayNumber}>{cell.dayNumber}</Text>
                  )}
                </View>
              ))}
            </View>
          </LinearGradient>

          <LinearGradient colors={['#FFFFFF', '#FBFCFF']} style={styles.card}>
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
                const fillColor = ratio >= 1 ? '#E5484D' : ratio >= 0.8 ? '#E9A23B' : '#35B46A';

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
                        {app.minutes}m{app.limitMinutes > 0 ? ` / ${app.limitMinutes}m` : ''}
                      </Text>
                    </View>
                    <View style={styles.usageTrack}>
                      <View style={[styles.usageFill, { width: `${fillWidth}%`, backgroundColor: fillColor }]} />
                    </View>
                  </View>
                );
              })
            )}
          </LinearGradient>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 34, paddingBottom: 120, gap: 14 },
  heroSection: { alignItems: 'center', paddingTop: 8, paddingBottom: 10 },
  heroBadge: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E3E8F2',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 8
  },
  heroBadgeText: { fontSize: 11, color: '#3F4A5A', fontFamily: FONT_REGULAR },
  heroGif: { width: 120, height: 120, marginTop: 6 },
  streakNumber: { fontSize: 58, lineHeight: 60, color: '#171C26', fontFamily: FONT_REGULAR },
  streakLabel: { fontSize: 21, color: '#151A25', fontFamily: FONT_REGULAR },
  streakSub: { marginTop: 4, fontSize: 12, color: '#2C3039', fontFamily: FONT_SEMIBOLD },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#D9E3F4',
    padding: 14,
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 3
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  cardTitle: { fontSize: 16, color: '#151A25', fontFamily: FONT_SEMIBOLD },
  pill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#F3F7FF',
    borderWidth: 1,
    borderColor: '#DDE7F8'
  },
  pillText: { fontSize: 10, color: '#3F5A84', fontFamily: FONT_REGULAR },
  weekStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F7FAFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2EAF8',
    paddingVertical: 11,
    paddingHorizontal: 8
  },
  weekDay: { alignItems: 'center', width: '13.7%' },
  weekLabel: { fontSize: 11, color: '#7A859D', marginBottom: 8, fontFamily: FONT_REGULAR },
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
  eyesRow: { flexDirection: 'row', gap: 6, marginBottom: 1 },
  eye: { width: 3, height: 3, borderRadius: 2 },
  dayMouth: { fontSize: 10, lineHeight: 11, fontFamily: FONT_REGULAR },
  dayNumber: { fontSize: 16, color: '#1E2430', fontFamily: FONT_REGULAR },
  emptyText: { color: '#6F7685', fontFamily: FONT_REGULAR, marginTop: 2 },
  appRow: { borderTopWidth: 1, borderTopColor: '#EFF2F8', paddingVertical: 8 },
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
    backgroundColor: '#E9EDF6'
  },
  appIconFallbackText: { fontSize: 11, color: '#42526B', fontFamily: FONT_REGULAR },
  appName: { flex: 1, color: '#232A35', fontSize: 14, fontFamily: FONT_REGULAR },
  appMinutes: { color: '#232A35', fontSize: 14, fontFamily: FONT_SEMIBOLD },
  usageTrack: {
    height: 8,
    width: 110,
    borderRadius: 999,
    backgroundColor: '#DEE6F2',
    overflow: 'hidden',
    marginTop: 6,
    alignSelf: 'flex-end'
  },
  usageFill: { height: '100%', borderRadius: 999 }
});

export default StreakScreen;





