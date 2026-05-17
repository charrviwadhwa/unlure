import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, AppState, Image, InteractionManager, Platform, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenTimeService, DailyUsageMap, FocusModeDecisions, WeeklyUsageInsights } from '../../services/ScreenTimeService';
import { DailyLimitSnapshots, DailyMoodSnapshots, UserStore } from '../../services/storage';
import { useMidnightRefresh } from '../../hooks/useMidnightRefresh';

type StreakAppRow = {
  id: string;
  name: string;
  minutes: number;
  limitMinutes: number;
  opens: number;
  iconBase64?: string;
  protectedToday: boolean;
  bypassedToday: boolean;
};

type DayMood = 'happy' | 'lightSmile' | 'neutral' | 'dotted' | 'empty';

const FONT_REGULAR = Platform.select({ ios: 'Geist-Regular', android: 'Geist-Regular', default: 'System' });
const FONT_SEMIBOLD = Platform.select({ ios: 'Geist-SemiBold', android: 'Geist-SemiBold', default: 'System' });
const FONT_MONO = Platform.select({ ios: 'GeistMono-Regular', android: 'GeistMono-Regular', default: 'monospace' });
const FONT_SCRIPT = Platform.select({ ios: 'PlaywriteDESAS-Light', android: 'PlaywriteDESAS-Light', default: 'System' });
const EMPTY_FOCUS_DECISIONS: FocusModeDecisions = { protectedApps: {}, bypassedApps: {} };
const EMPTY_WEEKLY_INSIGHTS: WeeklyUsageInsights = { firstOpenCounts: {} };

const AnimatedCount = ({
  value,
  style,
  delay = 0
}: {
  value: number;
  style: any;
  delay?: number;
}) => {
  const animated = useRef(new Animated.Value(0)).current;
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const listenerId = animated.addListener(({ value: nextValue }) => {
      setDisplayValue(Math.round(nextValue));
    });
    animated.setValue(0);
    Animated.timing(animated, {
      toValue: value,
      duration: 600,
      delay,
      useNativeDriver: false
    }).start();

    return () => {
      animated.removeListener(listenerId);
    };
  }, [animated, delay, value]);

  return <Text style={style}>{displayValue}</Text>;
};

interface StreakScreenProps {
  active?: boolean;
  onEditApps: () => void;
  onOpenFocusSetup: () => void;
}

const StreakScreen: React.FC<StreakScreenProps> = ({ active = true, onEditApps, onOpenFocusSetup }) => {
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const theme = {
    bg: isDark ? '#121418' : '#FFFFFF',
    surface: isDark ? 'rgba(255,255,255,0.055)' : '#FFFFFF',
    mutedSurface: isDark ? 'rgba(255,255,255,0.06)' : '#F7F4ED',
    text: isDark ? '#FFFFFF' : '#000000',
    textSecondary: isDark ? '#A5ACB8' : '#6F737C',
    border: isDark ? 'rgba(255,255,255,0.08)' : '#EEE8DC'
  };
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [monthCleanDays, setMonthCleanDays] = useState(0);
  const [todayApps, setTodayApps] = useState<StreakAppRow[]>([]);
  const [appNameMap, setAppNameMap] = useState<Record<string, string>>({});
  const [isExceededToday, setIsExceededToday] = useState(false);
  const [hasActiveLimits, setHasActiveLimits] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [weeklyInsights, setWeeklyInsights] = useState<WeeklyUsageInsights>(EMPTY_WEEKLY_INSIGHTS);

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

  const resolveMood = useCallback((
    dayMap: Record<string, number> | undefined,
    limits: Record<string, number>,
    focusDecisions: FocusModeDecisions = EMPTY_FOCUS_DECISIONS
  ): DayMood => {
    if (!dayMap) return 'empty';
    const totalLimit = Object.keys(limits).reduce((acc, pkg) => acc + (limits[pkg] || 0), 0);
    if (totalLimit === 0) return 'empty';
    const hasExceededApp = Object.keys(limits).some((pkg) => {
      const limit = limits[pkg];
      if (!limit) return false;
      const isAtLimit = Math.floor((dayMap[pkg] || 0) / 60000) >= limit;
      if (!isAtLimit) return false;
      if (focusDecisions.bypassedApps[pkg]) return true;
      return !focusDecisions.protectedApps[pkg];
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
    savedMoods: DailyMoodSnapshots,
    focusDecisions: FocusModeDecisions = EMPTY_FOCUS_DECISIONS
  ): DayMood => {
    const todayKey = formatDateKey(new Date());
    const limits = getLimitsForDate(dateKey, limitSnapshots, currentLimits);
    const hasLimits = Object.values(limits).some((limit) => limit > 0);
    if (!hasLimits) return 'empty';
    if (dateKey !== todayKey && savedMoods[dateKey]) return savedMoods[dateKey];
    return resolveMood(dayMap, limits, dateKey === todayKey ? focusDecisions : EMPTY_FOCUS_DECISIONS);
  }, [getLimitsForDate, resolveMood]);

  const calculateStreakFromStats = useCallback((
    stats: DailyUsageMap,
    limitSnapshots: DailyLimitSnapshots,
    currentLimits: Record<string, number>,
    savedMoods: DailyMoodSnapshots,
    focusDecisions: FocusModeDecisions,
    trackingStartDate: string
  ) => {
    let count = 0;
    const startMs = new Date(`${trackingStartDate}T00:00:00`).getTime();
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    while (true) {
      if (cursor.getTime() < startMs) break;
      const key = formatDateKey(cursor);
      const dayMap = stats[key];
      if (!dayMap) break;
      const mood = getMoodForDate(key, dayMap, limitSnapshots, currentLimits, savedMoods, focusDecisions);
      if (mood === 'dotted' || mood === 'empty') break;
      count += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return count;
  }, [getMoodForDate]);

  const calculateStreakMilestones = useCallback((
    stats: DailyUsageMap,
    limitSnapshots: DailyLimitSnapshots,
    currentLimits: Record<string, number>,
    savedMoods: DailyMoodSnapshots,
    focusDecisions: FocusModeDecisions,
    trackingStartDate: string
  ) => {
    let best = 0;
    let running = 0;
    let monthClean = 0;
    const start = new Date(`${trackingStartDate}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    for (const cursor = new Date(start); cursor <= today; cursor.setDate(cursor.getDate() + 1)) {
      const key = formatDateKey(cursor);
      const mood = getMoodForDate(key, stats[key], limitSnapshots, currentLimits, savedMoods, focusDecisions);
      const isClean = mood !== 'dotted' && mood !== 'empty';
      if (isClean) {
        running += 1;
        best = Math.max(best, running);
        if (cursor.getMonth() === currentMonth && cursor.getFullYear() === currentYear) monthClean += 1;
      } else {
        running = 0;
      }
    }

    return { best, monthClean };
  }, [getMoodForDate]);

  const load = useCallback(async () => {
    await ScreenTimeService.storeTodayStats();
    const [storedStats, storedOpenCounts, installedApps, limits, limitSnapshots, savedMoods, trackingStartDate, loadedInsights] = await Promise.all([
      ScreenTimeService.getStoredDailyStats(),
      ScreenTimeService.getStoredDailyOpenCounts(),
      ScreenTimeService.getInstalledApps(),
      UserStore.getAllLimits(),
      UserStore.getDailyLimitSnapshots(),
      UserStore.getDailyMoods(),
      UserStore.ensureTrackingStartDate(),
      ScreenTimeService.getWeeklyUsageInsights()
    ]);
    const focusDecisions = await ScreenTimeService.getTodayFocusModeDecisions();

    const nameMap = installedApps.reduce<Record<string, string>>((acc, app) => {
      acc[app.packageName] = app.appName;
      return acc;
    }, {});
    setAppNameMap(nameMap);
    const iconMap = installedApps.reduce<Record<string, string | undefined>>((acc, app) => {
      acc[app.packageName] = app.iconBase64;
      return acc;
    }, {});
    const installedPackages = new Set(installedApps.map((app) => app.packageName));
    const activeLimits = Object.entries(limits || {}).reduce<Record<string, number>>((acc, [pkg, minutes]) => {
      if (installedPackages.has(pkg)) acc[pkg] = minutes;
      return acc;
    }, {});
    if (Object.keys(activeLimits).length !== Object.keys(limits || {}).length) {
      await UserStore.saveAllLimits(activeLimits);
      await ScreenTimeService.syncFocusModeConfig(activeLimits, nameMap);
    } else {
      await UserStore.saveTodayLimitSnapshot(activeLimits);
    }
    setHasActiveLimits(Object.values(activeLimits).some((limit) => limit > 0));

    const todayKey = formatDateKey(new Date());
    const todayMap = (storedStats as DailyUsageMap)[todayKey] || {};
    const todayOpenMap = storedOpenCounts[todayKey] || {};
    const todayMood = resolveMood(todayMap, activeLimits, focusDecisions);
    await UserStore.saveDailyMood(todayKey, todayMood);
    const moodsWithToday = { ...(savedMoods || {}), [todayKey]: todayMood };

    const derivedStreak = calculateStreakFromStats(storedStats as DailyUsageMap, limitSnapshots || {}, activeLimits, moodsWithToday, focusDecisions, trackingStartDate);
    const milestones = calculateStreakMilestones(storedStats as DailyUsageMap, limitSnapshots || {}, activeLimits, moodsWithToday, focusDecisions, trackingStartDate);
    setStreak(derivedStreak);
    setBestStreak(milestones.best);
    setMonthCleanDays(milestones.monthClean);
    setWeeklyInsights(loadedInsights);

    const rows = Object.keys(activeLimits)
      .filter((pkg) => (activeLimits[pkg] || 0) > 0)
      .map((pkg) => ({
        id: pkg,
        name: nameMap[pkg] || labelFromPackage(pkg),
        minutes: Math.floor((todayMap[pkg] || 0) / 60000),
        limitMinutes: activeLimits[pkg] || 0,
        opens: todayOpenMap[pkg] || 0,
        iconBase64: iconMap[pkg],
        protectedToday: Boolean(focusDecisions.protectedApps[pkg]),
        bypassedToday: Boolean(focusDecisions.bypassedApps[pkg])
      }))
      .sort((a, b) => {
        const aRatio = a.limitMinutes > 0 ? a.minutes / a.limitMinutes : 0;
        const bRatio = b.limitMinutes > 0 ? b.minutes / b.limitMinutes : 0;
        return bRatio - aRatio || b.minutes - a.minutes;
      })
      .slice(0, 6);
    setTodayApps(rows);
    setIsExceededToday(rows.some((app) => (
      app.limitMinutes > 0 &&
      app.minutes >= app.limitMinutes &&
      (focusDecisions.bypassedApps[app.id] || !focusDecisions.protectedApps[app.id])
    )));
  }, [calculateStreakFromStats, calculateStreakMilestones, resolveMood]);

  const formatTime = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  };

  const firstOpenInsight = (() => {
    const top = Object.entries(weeklyInsights.firstOpenCounts || {})
      .sort((a, b) => b[1] - a[1])[0];
    if (!top || top[1] <= 0) return '';
    return `This week you started ${top[1]} morning${top[1] === 1 ? '' : 's'} with ${appNameMap[top[0]] || labelFromPackage(top[0])}.`;
  })();

  useEffect(() => {
    if (!active) return;
    const task = InteractionManager.runAfterInteractions(load);
    return () => task.cancel();
  }, [active, load]);

  useEffect(() => {
    if (!active) return;
    const interval = setInterval(load, 30000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        load();
      }
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [active, load]);

  useMidnightRefresh(load);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const heroStreakLabel = !hasActiveLimits
    ? 'Set a limit to start'
    : isExceededToday
      ? 'A limited app crossed its cap'
      : streak <= 0
        ? 'Momentum starts today.'
        : streak === 1
          ? 'Momentum started.'
          : 'Your streak is alive.';
  const streakProgressLabel = !hasActiveLimits
    ? 'No streak is counted until a limit is active'
    : isExceededToday
      ? 'Bring today back under limit'
      : streak > 0
        ? streak === 1
          ? 'One focused day. Keep protecting it.'
          : 'Discipline compounds daily.'
        : 'Choose one app limit and protect today.';
  const screenGradientColors = isDark
    ? ['#121418', '#14171A', '#171A16', '#121418']
    : ['#FFFFFF', '#FFFCF6', '#FFFFFF'];
  const heroCardColors = ['#171C24', '#191E24', '#242116'];
  const statsCardColors = isDark ? ['#171C24', '#151A20'] : ['#FFFFFF', '#F7F4ED'];
  const statsTextColor = isDark ? '#FFFFFF' : '#151515';
  const statsLabelColor = isDark ? 'rgba(255,255,255,0.48)' : '#7A756B';
  const statsUnitColor = isDark ? 'rgba(255,255,255,0.42)' : '#8B867C';
  const statsBorderColor = isDark ? 'rgba(255,255,255,0.08)' : '#EEE8DC';
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <LinearGradient colors={screenGradientColors} style={styles.screenGradient}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: insets.top + 15,
              paddingBottom: Math.max(insets.bottom, 0) + 176
            }
          ]}
          showsVerticalScrollIndicator={false}
          overScrollMode="never"
          bounces={false}
          alwaysBounceVertical={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#111111" />}
        >
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={[styles.brandMark, { color: isDark ? '#AAB0BD' : '#6E6E73' }]}>unlure</Text>
            <Text style={[styles.pageTitle, { color: theme.text }]}>Streak</Text>
            <Text style={[styles.pageDate, { color: theme.textSecondary }]}>Progress</Text>
          </View>
          <TouchableOpacity style={[styles.focusSetupButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.74)', borderColor: theme.border }]} onPress={onOpenFocusSetup} activeOpacity={0.76}>
            <Image source={require('../../assets/image.png')} style={[styles.focusSetupImage, { tintColor: theme.text }]} resizeMode="contain" />
            <Text style={[styles.focusSetupText, { color: theme.text }]}>Focus</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.heroStack}>
          <View style={[styles.heroBackplate, { backgroundColor: isDark ? 'rgba(255,255,255,0.045)' : '#F7F1E4' }]} />
          <LinearGradient
            colors={isDark ? ['#3A414B', '#181D24', '#55523F'] : ['#F7F1E4', '#E8DDCB', '#F7F1E4']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCardBorder}
          >
            <LinearGradient
              colors={heroCardColors}
              start={{ x: 0, y: 0.15 }}
              end={{ x: 1, y: 0.9 }}
              style={styles.heroCard}
            >
              <View style={styles.heroTopRow}>
                <Text style={styles.heroKicker}>{!hasActiveLimits ? 'No active limits' : isExceededToday ? 'Needs recovery' : 'On track today'}</Text>
                <Text style={styles.heroMeta}>{`${streak} day streak`}</Text>
              </View>
              <View style={styles.heroBody}>
                <View style={styles.heroCopy}>
                  <View style={styles.streakNumberWrap}>
                    <AnimatedCount value={streak} style={styles.streakNumberEcho} />
                    <AnimatedCount value={streak} style={styles.streakNumber} />
                  </View>
                  <Text style={styles.streakLabel}>{heroStreakLabel}</Text>
                  <Text style={styles.streakSubLabel}>{streakProgressLabel}</Text>
                </View>
                <Image
                  source={isExceededToday ? require('../../assets/Sad.gif') : require('../../assets/Fire (1).gif')}
                  style={styles.heroGif}
                  resizeMode="contain"
                />
              </View>
            </LinearGradient>
          </LinearGradient>
        </View>

        <LinearGradient
          colors={statsCardColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.trophyStatsRow, { borderColor: statsBorderColor }]}
        >
          {[
            { label: 'Current Streak', value: streak, unit: 'days', delay: 0, accent: '#7ACB67' },
            { label: 'Best Streak', value: bestStreak, unit: 'days', delay: 100, accent: '#E4A62A' },
            { label: 'Clean Days', value: monthCleanDays, unit: 'this month', delay: 200, accent: '#6EA8FF' }
          ].map((item, index) => (
            <View
              key={item.label}
              style={[
                styles.trophyStat,
                index > 0 && styles.trophyStatDivider,
                index > 0 && { borderLeftColor: statsBorderColor }
              ]}
            >
              <View style={styles.trophyStatLabelRow}>
                <View style={[styles.trophyAccent, { backgroundColor: item.accent }]} />
                <Text style={[styles.trophyStatLabel, { color: statsLabelColor }]}>{item.label}</Text>
              </View>
              <AnimatedCount value={item.value} delay={item.delay} style={[styles.trophyStatValue, { color: statsTextColor }]} />
              <Text style={[styles.trophyStatUnit, { color: statsUnitColor }]}>{item.unit}</Text>
            </View>
          ))}
        </LinearGradient>

        {firstOpenInsight ? (
          <Text style={[styles.behaviorInsight, { color: theme.textSecondary }]}>{firstOpenInsight}</Text>
        ) : null}

        <View style={styles.sectionBlock}>
          <View style={styles.titleRow}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Limited Apps</Text>
            <TouchableOpacity style={styles.editAppsButton} onPress={onEditApps} activeOpacity={0.76}>
              <Text style={styles.editAppsText}>Edit</Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.limitedList, { borderTopColor: theme.border }]}>
            {todayApps.length === 0 ? (
              <View style={styles.emptyState}>
                <Image
                  source={require('../../assets/share-paper-plane.png')}
                  style={styles.emptyIllustration}
                  resizeMode="contain"
                />
                <Text style={[styles.emptyTitle, { color: theme.text }]}>No limits yet</Text>
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Pick the apps you want to control, then they will appear here.</Text>
              </View>
            ) : (
              todayApps.map((app) => {
                const ratio = app.limitMinutes > 0 ? app.minutes / app.limitMinutes : 0;
                const fillWidth = app.minutes > 0 ? Math.min(Math.max(ratio * 100, 4), 100) : 0;
                const isBroken = ratio >= 1 && (app.bypassedToday || !app.protectedToday);
                const isProtected = ratio >= 1 && app.protectedToday;
                const isNearLimit = ratio >= 0.8;
                const fillColor = isBroken
                  ? '#D65A5A'
                  : isProtected
                    ? '#E4A62A'
                    : isNearLimit
                      ? '#E4A62A'
                      : app.minutes === 0
                        ? '#D7D7DC'
                        : '#7ACB67';

                return (
                  <View key={app.id} style={[styles.appRow, { borderBottomColor: theme.border }]}>
                    <View style={styles.appTopRow}>
                      <View style={styles.appNameWrap}>
                        {app.iconBase64 ? (
                          <Image source={{ uri: `data:image/png;base64,${app.iconBase64}` }} style={styles.appIcon} resizeMode="cover" />
                        ) : (
                          <View style={styles.appIconFallback}>
                            <Text style={styles.appIconFallbackText}>{app.name.charAt(0).toUpperCase()}</Text>
                          </View>
                        )}
                        <View style={styles.appNameTextWrap}>
                          <Text style={[styles.appName, { color: theme.text }]} numberOfLines={1}>{app.name}</Text>
                        </View>
                      </View>
                      <View style={styles.appUsageRight}>
                        <Text
                          style={[styles.appMinutes, { color: theme.text }, app.minutes === 0 && styles.appMinutesUnused]}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.78}
                        >
                          {`${formatTime(app.minutes)} / ${formatTime(app.limitMinutes)}`}
                        </Text>
                        <View style={styles.usageTrack}>
                          <View style={[styles.usageFill, { width: `${fillWidth}%`, backgroundColor: fillColor }]} />
                        </View>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  screenGradient: {
    flex: 1
  },
  scrollView: {
    flex: 1
  },
  content: {
    paddingHorizontal: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 22
  },
  headerCopy: {
    flex: 1
  },
  pageTitle: {
    fontSize: 28,
    lineHeight: 32,
    color: '#000000',
    fontFamily: FONT_SEMIBOLD,
    fontWeight: '600'
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
  pageDate: {
    marginTop: 4,
    fontSize: 14,
    color: '#8E8E93',
    fontFamily: FONT_REGULAR,
    fontWeight: '500'
  },
  focusSetupButton: {
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F7F7FA',
    borderWidth: 1,
    borderColor: '#ECECF2',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingLeft: 9,
    paddingRight: 12,
    marginLeft: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 1
  },
  focusSetupImage: {
    width: 17,
    height: 17,
    marginRight: 6
  },
  focusSetupText: {
    color: '#1C1C1E',
    fontSize: 12,
    fontFamily: FONT_REGULAR,
    fontWeight: '500'
  },
  editAppsButton: {
    height: 30,
    paddingHorizontal: 0,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent'
  },
  editAppsText: {
    fontSize: 12,
    color: '#007AFF',
    fontFamily: FONT_SEMIBOLD,
    fontWeight: '600'
  },
  heroStack: {
    minHeight: 174,
    marginBottom: 30,
    position: 'relative'
  },
  heroBackplate: {
    position: 'absolute',
    left: 10,
    right: 10,
    top: 16,
    bottom: 0,
    borderRadius: 30,
    backgroundColor: '#F2F2F7'
  },
  heroCardBorder: {
    borderRadius: 31,
    padding: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.14,
    shadowRadius: 26,
    elevation: 9
  },
  heroCard: {
    minHeight: 156,
    borderRadius: 30,
    padding: 20,
    backgroundColor: '#111111'
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  heroKicker: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.72)',
    fontFamily: FONT_REGULAR,
    fontWeight: '500'
  },
  heroMeta: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.58)',
    fontFamily: FONT_MONO,
    fontWeight: '600'
  },
  heroBody: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12
  },
  heroCopy: {
    flex: 1,
    paddingRight: 14
  },
  heroGif: {
    width: 118,
    height: 118,
    zIndex: 1
  },
  streakNumberWrap: {
    alignSelf: 'flex-start',
    position: 'relative'
  },
  streakNumberEcho: {
    position: 'absolute',
    left: 0,
    top: 5,
    fontSize: 68,
    lineHeight: 72,
    color: 'rgba(255,255,255,0.22)',
    fontFamily: FONT_MONO,
    fontWeight: '500'
  },
  streakNumber: {
    fontSize: 68,
    lineHeight: 72,
    color: '#FFFFFF',
    fontFamily: FONT_MONO,
    fontWeight: '500'
  },
  streakLabel: {
    marginTop: 2,
    fontSize: 15,
    color: 'rgba(255,255,255,0.76)',
    fontFamily: FONT_REGULAR,
    fontWeight: '500'
  },
  streakSubLabel: {
    marginTop: 5,
    fontSize: 12,
    color: 'rgba(255,255,255,0.48)',
    fontFamily: FONT_REGULAR,
    fontWeight: '600'
  },
  sectionBlock: {
    marginBottom: 30
  },
  trophyStatsRow: {
    flexDirection: 'row',
    marginTop: -2,
    marginBottom: 22,
    minHeight: 58,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.065,
    shadowRadius: 20,
    elevation: 3
  },
  behaviorInsight: {
    marginTop: -16,
    marginBottom: 30,
    fontFamily: FONT_REGULAR,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500'
  },
  trophyStat: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 11
  },
  trophyStatDivider: {
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.08)'
  },
  trophyStatLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2
  },
  trophyAccent: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginRight: 5
  },
  trophyStatValue: {
    fontFamily: FONT_MONO,
    fontSize: 20,
    lineHeight: 23,
    fontWeight: '500'
  },
  trophyStatLabel: {
    fontFamily: FONT_REGULAR,
    fontSize: 8,
    lineHeight: 10,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.45,
    color: 'rgba(255,255,255,0.48)'
  },
  trophyStatUnit: {
    fontFamily: FONT_REGULAR,
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '500',
    marginTop: 1,
    color: 'rgba(255,255,255,0.42)'
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  sectionTitle: {
    fontSize: 14,
    color: '#000000',
    fontFamily: FONT_REGULAR,
    fontWeight: '500'
  },
  limitedList: {
    borderTopWidth: 1,
    borderTopColor: '#EFEFF4'
  },
  emptyState: {
    paddingVertical: 18,
    alignItems: 'center'
  },
  emptyIllustration: {
    width: 84,
    height: 84,
    opacity: 0.22,
    marginBottom: 6
  },
  emptyTitle: {
    color: '#1C1C1E',
    fontSize: 15,
    fontFamily: FONT_SEMIBOLD,
    fontWeight: '600',
    marginBottom: 4
  },
  emptyText: {
    color: '#8E8E93',
    fontSize: 13,
    lineHeight: 18,
    fontFamily: FONT_REGULAR
  },
  appRow: {
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFF4'
  },
  appTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  appNameWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 14
  },
  appIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    marginRight: 11
  },
  appIconFallback: {
    width: 30,
    height: 30,
    borderRadius: 8,
    marginRight: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F2F7'
  },
  appIconFallbackText: {
    fontSize: 12,
    color: '#6E6E73',
    fontFamily: FONT_SEMIBOLD,
    fontWeight: '600'
  },
  appName: {
    color: '#000000',
    fontSize: 15,
    fontFamily: FONT_REGULAR,
    fontWeight: '500'
  },
  appNameTextWrap: {
    flex: 1,
    minWidth: 0
  },
  appMinutes: {
    color: '#000000',
    fontSize: 16,
    fontFamily: FONT_MONO,
    fontWeight: '500'
  },
  appMinutesUnused: {
    color: '#8E8E93',
    fontWeight: '600'
  },
  appUsageRight: {
    width: 150,
    alignItems: 'flex-end'
  },
  usageTrack: {
    width: 120,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#E5E5EA',
    overflow: 'hidden',
    marginTop: 8
  },
  usageFill: {
    height: '100%',
    borderRadius: 999
  }
});

export default StreakScreen;
