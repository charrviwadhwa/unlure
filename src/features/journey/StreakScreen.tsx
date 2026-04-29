import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  LayoutAnimation,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View
} from 'react-native';
import { ScreenTimeService, DailyUsageMap } from '../../services/ScreenTimeService';
import { UserStore } from '../../services/storage';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type StreakAppRow = {
  id: string;
  name: string;
  minutes: number;
  iconBase64?: string;
  limitMinutes: number;
};

type MoodState = 'happy' | 'lightSmile' | 'neutral' | 'sad' | 'empty';

type WeekDayMood = {
  dayLabel: string;
  mood: MoodState;
};

const moodConfig: Record<Exclude<MoodState, 'empty'>, { mouth: string; bg: string; faceColor: string }> = {
  happy: { mouth: '◡', bg: '#BDE8FF', faceColor: '#2E6279' },
  lightSmile: { mouth: '﹀', bg: '#D6CBFF', faceColor: '#5A43A7' },
  neutral: { mouth: '—', bg: '#F9E38D', faceColor: '#6B5E24' },
  sad: { mouth: '︵', bg: '#F7B7BF', faceColor: '#8F1F2D' }
};

const getWeekStart = (date: Date, weekOffset = 0) => {
  const current = new Date(date);
  const day = current.getDay();
  current.setDate(current.getDate() - day + weekOffset * 7);
  current.setHours(0, 0, 0, 0);
  return current;
};

const formatRange = (startDate: Date) => {
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);
  const startDay = startDate.getDate();
  const endDay = endDate.getDate();
  const month = endDate.toLocaleString('en-US', { month: 'short' });
  const year = endDate.getFullYear();
  return `${startDay} - ${endDay} ${month} ${year}`;
};

const StreakScreen: React.FC = () => {
  const [streak, setStreak] = useState(0);
  const [weekOffset, setWeekOffset] = useState(0);
  const [weekMoods, setWeekMoods] = useState<WeekDayMood[]>([]);
  const [todayApps, setTodayApps] = useState<StreakAppRow[]>([]);

  const heroAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;

  const weekStart = useMemo(() => getWeekStart(new Date(), weekOffset), [weekOffset]);
  const weekRangeText = useMemo(() => formatRange(weekStart), [weekStart]);

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

  const resolveMood = (dayMap: Record<string, number> | undefined, limits: Record<string, number>): MoodState => {
    if (!dayMap) return 'empty';
    const totalLimit = Object.keys(limits).reduce((acc, pkg) => acc + (limits[pkg] || 0), 0);
    if (totalLimit === 0) return 'neutral';

    const limitedUsage = Object.keys(dayMap).reduce((acc, pkg) => {
      const limit = limits[pkg];
      if (!limit) return acc;
      return acc + Math.floor(dayMap[pkg] / 60000);
    }, 0);

    const ratio = limitedUsage / totalLimit;
    if (ratio > 1) return 'sad';
    if (ratio <= 0.3) return 'happy';
    if (ratio <= 1) return 'lightSmile';
    return 'neutral';
  };

  const load = async () => {
    await ScreenTimeService.storeTodayStats();
    const [limits, storedStats, currentStreak, installedApps] = await Promise.all([
      UserStore.getAllLimits(),
      ScreenTimeService.getStoredDailyStats(),
      UserStore.getStreak(),
      ScreenTimeService.getInstalledApps()
    ]);

    setStreak(currentStreak);

    const nameMap = installedApps.reduce<Record<string, string>>((acc, app) => {
      acc[app.packageName] = app.appName;
      return acc;
    }, {});

    const labels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    const moods = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      const key = formatDateKey(d);
      const dayMap = (storedStats as DailyUsageMap)[key];
      return { dayLabel: labels[i], mood: resolveMood(dayMap, limits || {}) };
    });
    setWeekMoods(moods);

    const todayKey = formatDateKey(new Date());
    const todayMap = (storedStats as DailyUsageMap)[todayKey] || {};

    const rows = Object.keys(todayMap)
      .map((pkg) => ({
        id: pkg,
        name: nameMap[pkg] || labelFromPackage(pkg),
        minutes: Math.floor((todayMap[pkg] || 0) / 60000),
        iconBase64: installedApps.find((app) => app.packageName === pkg)?.iconBase64,
        limitMinutes: limits[pkg] || 0
      }))
      .filter((app) => app.minutes > 0)
      .sort((a, b) => b.minutes - a.minutes);

    setTodayApps(rows.slice(0, 5));
  };

  const moveWeek = (direction: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setWeekOffset((prev) => prev + direction);
  };

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroAnim, {
        toValue: 1,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }),
      Animated.timing(cardAnim, {
        toValue: 1,
        duration: 430,
        delay: 90,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      })
    ]).start();
  }, [cardAnim, heroAnim]);

  useEffect(() => {
    load();
  }, [weekOffset]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View
          style={[
            styles.hero,
            {
              opacity: heroAnim,
              transform: [{ translateY: heroAnim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }]
            }
          ]}
        >
          <Image source={require('../../assets/fire.gif')} style={styles.fireGif} resizeMode="contain" />
          <Text style={styles.streakNumber}>{streak}</Text>
          <Text style={styles.streakLabel}>Days on Fire!</Text>
          <Text style={styles.currentStreak}>{`🔥 Current Streak: ${streak} Days`}</Text>
        </Animated.View>

        <Animated.View
          style={[
            styles.card,
            {
              opacity: cardAnim,
              transform: [{ translateY: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) }]
            }
          ]}
        >
          <View style={styles.weekHeader}>
            <Text style={styles.weekDateRange}>{weekRangeText}</Text>
            <View style={styles.arrowControls}>
              <TouchableOpacity style={styles.arrowBtn} onPress={() => moveWeek(-1)} activeOpacity={0.85}>
                <Text style={styles.arrowText}>{'‹'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.arrowBtn} onPress={() => moveWeek(1)} activeOpacity={0.85}>
                <Text style={styles.arrowText}>{'›'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.weekRow}>
            {weekMoods.map((item, index) => {
              const mood = item.mood === 'empty' ? 'empty' : (moodConfig[item.mood] ? item.mood : 'neutral');
              return (
                <View key={`${item.dayLabel}-${index}`} style={styles.weekDayWrap}>
                  <Text style={styles.weekLabel}>{item.dayLabel}</Text>
                  {mood === 'empty' ? (
                    <View style={styles.emptyCircle} />
                  ) : (
                    <View style={[styles.iconWrap, { backgroundColor: moodConfig[mood].bg }]}>
                      <View style={styles.eyesRow}>
                        <View style={[styles.eye, { backgroundColor: moodConfig[mood].faceColor }]} />
                        <View style={[styles.eye, { backgroundColor: moodConfig[mood].faceColor }]} />
                      </View>
                      <Text style={[styles.mouth, { color: moodConfig[mood].faceColor }]}>{moodConfig[mood].mouth}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </Animated.View>

        <Animated.View
          style={[
            styles.card,
            {
              opacity: cardAnim,
              transform: [{ translateY: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) }]
            }
          ]}
        >
          <View style={styles.appsHeadRow}>
            <Text style={styles.cardTitle}>Top used apps</Text>
          </View>
          {todayApps.length === 0 ? (
            <Text style={styles.emptyText}>No usage data yet today.</Text>
          ) : (
            todayApps.map((app) => {
              const ratio = app.limitMinutes > 0 ? app.minutes / app.limitMinutes : app.minutes / 120;
              const fillWidth = Math.min(Math.max(ratio * 100, 3), 100);
              const fillColor = ratio >= 1 ? '#E5484D' : ratio >= 0.8 ? '#E9A23B' : '#35B46A';

              return (
                <View key={app.id} style={styles.appBlock}>
                  <View style={styles.appRow}>
                    <View style={styles.appLeft}>
                      {app.iconBase64 ? (
                        <Image
                          source={{ uri: `data:image/png;base64,${app.iconBase64}` }}
                          style={styles.appIcon}
                          resizeMode="contain"
                        />
                      ) : (
                        <View style={styles.appIconFallback}>
                          <Text style={styles.appIconFallbackText}>{app.name.charAt(0)}</Text>
                        </View>
                      )}
                      <Text style={styles.appName}>{app.name}</Text>
                    </View>
                    <View style={styles.rightUsage}>
                      <Text style={styles.appTime}>{app.minutes}m{app.limitMinutes > 0 ? ` / ${app.limitMinutes}m` : ''}</Text>
                      <View style={styles.usageTrack}>
                        <View style={[styles.usageFill, { width: `${fillWidth}%`, backgroundColor: fillColor }]} />
                      </View>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { padding: 16, paddingBottom: 110 },
  hero: {
    backgroundColor: '#FFFEFC',
    borderRadius: 22,
    alignItems: 'center',
    paddingVertical: 20,
    marginBottom: 14
  },
  fireGif: { width: 160, height: 160, marginBottom: -8 },
  streakNumber: { fontSize: 56, color: '#151923', lineHeight: 62, marginTop: -4, fontFamily: 'Montserrat-Light' },
  streakLabel: { fontSize: 34, color: '#151923', marginTop: 2, fontFamily: 'Montserrat-Light' },
  currentStreak: { marginTop: 10, fontSize: 30, fontWeight: '600', color: '#202531', fontFamily: 'Montserrat-Light' },
  card: {
    backgroundColor: '#FFFEFC',
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#EEE8DD'
  },
  weekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  weekDateRange: { fontSize: 20, fontWeight: '700', color: '#212735', fontFamily: 'Montserrat-Light' },
  arrowControls: { flexDirection: 'row', gap: 8 },
  arrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D4DAE5',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAFBFD'
  },
  arrowText: { fontSize: 24, color: '#252A33', marginTop: -2 },
  cardTitle: { fontSize: 22, fontWeight: '700', color: '#171B24', marginBottom: 8, fontFamily: 'Montserrat-Light' },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  weekDayWrap: { alignItems: 'center', width: '13.7%' },
  weekLabel: { color: '#7A8295', marginBottom: 8, fontSize: 14, fontFamily: 'Montserrat-Light' },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center'
  },
  eyesRow: { flexDirection: 'row', gap: 8, marginBottom: 2 },
  eye: { width: 4, height: 4, borderRadius: 2 },
  mouth: { fontSize: 11, lineHeight: 12, fontFamily: 'Montserrat-Light' },
  emptyCircle: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#C8CFDA' },
  emptyText: { color: '#667085', fontFamily: 'Montserrat-Light' },
  appsHeadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  appBlock: {
    borderBottomWidth: 1,
    borderBottomColor: '#EDF0F6',
    paddingBottom: 10
  },
  appRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
    paddingBottom: 8
  },
  appLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  rightUsage: { width: 118, alignItems: 'flex-end' },
  appIcon: { width: 24, height: 24, borderRadius: 6, marginRight: 10 },
  appIconFallback: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E9EDF6'
  },
  appIconFallbackText: { fontSize: 12, color: '#42526B', fontWeight: '700', fontFamily: 'Montserrat-Light' },
  appName: { color: '#1A1A1A', fontWeight: '600', flex: 1, marginRight: 8, fontFamily: 'Montserrat-Light' },
  appTime: { color: '#344054', fontWeight: '700', fontFamily: 'Montserrat-Light' },
  usageTrack: {
    height: 6,
    width: 110,
    borderRadius: 999,
    backgroundColor: '#E8EDF5',
    overflow: 'hidden',
    marginTop: 5
  },
  usageFill: {
    height: '100%',
    borderRadius: 999
  }
});

export default StreakScreen;
