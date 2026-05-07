import React, { useCallback, useEffect, useState } from 'react';
import { Image, InteractionManager, Platform, RefreshControl, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { ScreenTimeService, DailyUsageMap, FocusModeDecisions } from '../../services/ScreenTimeService';
import { DailyLimitSnapshots, DailyMoodSnapshots, UserStore } from '../../services/storage';
import { useMidnightRefresh } from '../../hooks/useMidnightRefresh';

type StreakAppRow = {
  id: string;
  name: string;
  minutes: number;
  limitMinutes: number;
  iconBase64?: string;
  protectedToday: boolean;
  bypassedToday: boolean;
};

type DayMood = 'happy' | 'lightSmile' | 'neutral' | 'dotted' | 'empty';

type DayCell = {
  key: string;
  label: string;
  dayNumber: number;
  completed: boolean;
  mood: DayMood;
};

const moodFace: Record<Exclude<DayMood, 'empty'>, { bg: string; faceColor: string; type: 'smile' | 'neutral' | 'frown' }> = {
  happy: { bg: '#D3D0FF', faceColor: '#5C56B6', type: 'smile' },
  lightSmile: { bg: '#C6E3FF', faceColor: '#528DF5', type: 'smile' },
  neutral: { bg: '#FCEFB4', faceColor: '#C2A320', type: 'neutral' },
  dotted: { bg: '#FCE1B9', faceColor: '#D0933C', type: 'frown' }
};

const FONT_REGULAR = Platform.select({ ios: 'Geist-Regular', android: 'Geist-Regular', default: 'System' });
const FONT_SEMIBOLD = Platform.select({ ios: 'Geist-SemiBold', android: 'Geist-SemiBold', default: 'System' });
const FONT_MONO = Platform.select({ ios: 'GeistMono-Regular', android: 'GeistMono-Regular', default: 'monospace' });
const FONT_SCRIPT = Platform.select({ ios: 'PlaywriteDESAS-Light', android: 'PlaywriteDESAS-Light', default: 'System' });
const EMPTY_FOCUS_DECISIONS: FocusModeDecisions = { protectedApps: {}, bypassedApps: {} };

interface StreakScreenProps {
  active?: boolean;
  onEditApps: () => void;
  onOpenFocusSetup: () => void;
}

const StreakScreen: React.FC<StreakScreenProps> = ({ active = true, onEditApps, onOpenFocusSetup }) => {
  const isDark = useColorScheme() === 'dark';
  const theme = {
    bg: isDark ? '#121418' : '#FFFFFF',
    surface: isDark ? 'rgba(255,255,255,0.055)' : '#FFFFFF',
    mutedSurface: isDark ? 'rgba(255,255,255,0.06)' : '#F7F4ED',
    text: isDark ? '#FFFFFF' : '#000000',
    textSecondary: isDark ? '#A5ACB8' : '#6F737C',
    border: isDark ? 'rgba(255,255,255,0.08)' : '#EEE8DC'
  };
  const [streak, setStreak] = useState(0);
  const [todayApps, setTodayApps] = useState<StreakAppRow[]>([]);
  const [weekCells, setWeekCells] = useState<DayCell[]>([]);
  const [isExceededToday, setIsExceededToday] = useState(false);
  const [hasActiveLimits, setHasActiveLimits] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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

  const load = useCallback(async () => {
    await ScreenTimeService.storeTodayStats();
    const [storedStats, installedApps, limits, limitSnapshots, savedMoods, trackingStartDate] = await Promise.all([
      ScreenTimeService.getStoredDailyStats(),
      ScreenTimeService.getInstalledApps(),
      UserStore.getAllLimits(),
      UserStore.getDailyLimitSnapshots(),
      UserStore.getDailyMoods(),
      UserStore.ensureTrackingStartDate()
    ]);
    const focusDecisions = await ScreenTimeService.getTodayFocusModeDecisions();

    const nameMap = installedApps.reduce<Record<string, string>>((acc, app) => {
      acc[app.packageName] = app.appName;
      return acc;
    }, {});
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
    const todayMood = resolveMood(todayMap, activeLimits, focusDecisions);
    await UserStore.saveDailyMood(todayKey, todayMood);
    const moodsWithToday = { ...(savedMoods || {}), [todayKey]: todayMood };

    const derivedStreak = calculateStreakFromStats(storedStats as DailyUsageMap, limitSnapshots || {}, activeLimits, moodsWithToday, focusDecisions, trackingStartDate);
    setStreak(derivedStreak);
    await ScreenTimeService.syncStreakShield(derivedStreak);

    const rows = Object.keys(activeLimits)
      .filter((pkg) => (activeLimits[pkg] || 0) > 0)
      .map((pkg) => ({
        id: pkg,
        name: nameMap[pkg] || labelFromPackage(pkg),
        minutes: Math.floor((todayMap[pkg] || 0) / 60000),
        limitMinutes: activeLimits[pkg] || 0,
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

    const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const monday = getMondayStart(new Date());
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    const trackingStartMs = new Date(`${trackingStartDate}T00:00:00`).getTime();
    const cells: DayCell[] = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const key = formatDateKey(d);
      const dayMap = (storedStats as DailyUsageMap)[key];
      const isBeforeTrackingStart = d.getTime() < trackingStartMs;
      const mood = isBeforeTrackingStart ? 'empty' : getMoodForDate(key, dayMap, limitSnapshots || {}, activeLimits, moodsWithToday, focusDecisions);
      return {
        key,
        label: labels[i],
        dayNumber: d.getDate(),
        completed: !isBeforeTrackingStart && d <= now && mood !== 'empty',
        mood
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
    if (!active) return;
    const task = InteractionManager.runAfterInteractions(load);
    return () => task.cancel();
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

  const heroStreakLabel = !hasActiveLimits ? 'Set a limit to start' : streak === 1 ? 'Day on fire' : 'Days on fire';
  const weekProgressCount = weekCells.filter((cell) => cell.completed && cell.mood !== 'dotted').length;
  const weekProgressLabel = !hasActiveLimits ? 'No streak is counted until a limit is active' : isExceededToday ? 'Bring today back under limit' : `${weekProgressCount} of 7 days this week`;
  const screenGradientColors = isDark
    ? ['#121418', '#14171A', '#171A16', '#121418']
    : ['#FFFFFF', '#FFFCF6', '#FFFFFF'];
  const heroCardColors = ['#171C24', '#191E24', '#242116'];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <LinearGradient colors={screenGradientColors} style={styles.screenGradient}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
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
            <Text style={[styles.pageDate, { color: theme.textSecondary }]}>This week</Text>
          </View>
          <TouchableOpacity style={[styles.focusSetupButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.74)', borderColor: theme.border }]} onPress={onOpenFocusSetup} activeOpacity={0.76}>
            <Image source={require('../../assets/image.png')} style={[styles.focusSetupImage, { tintColor: theme.text }]} resizeMode="contain" />
            <Text style={[styles.focusSetupText, { color: theme.text }]}>Focus</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.heroStack}>
          <View style={[styles.heroBackplate, { backgroundColor: isDark ? 'rgba(255,255,255,0.045)' : '#F7F1E4' }]} />
          <LinearGradient
            colors={heroCardColors}
            start={{ x: 0, y: 0.15 }}
            end={{ x: 1, y: 0.9 }}
            style={[styles.heroCard, isDark && { borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1 }]}
          >
            <View style={styles.heroTopRow}>
              <Text style={styles.heroKicker}>{!hasActiveLimits ? 'No active limits' : isExceededToday ? 'Needs recovery' : 'On track today'}</Text>
              <Text style={styles.heroMeta}>{`${streak} day streak`}</Text>
            </View>
            <View style={styles.heroBody}>
              <View style={styles.heroCopy}>
                <View style={styles.streakNumberWrap}>
                  <Text style={styles.streakNumberEcho}>{streak}</Text>
                  <Text style={styles.streakNumber}>{streak}</Text>
                </View>
                <Text style={styles.streakLabel}>{isExceededToday ? 'A limited app crossed its cap' : heroStreakLabel}</Text>
                <Text style={styles.streakSubLabel}>{weekProgressLabel}</Text>
              </View>
              <Image
                source={isExceededToday ? require('../../assets/Sad.gif') : require('../../assets/Fire (1).gif')}
                style={styles.heroGif}
                resizeMode="contain"
              />
            </View>
          </LinearGradient>
        </View>

        <View style={styles.sectionBlock}>
          <View style={styles.titleRow}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Streak Journey</Text>
            <Text style={[styles.sectionMeta, { color: theme.textSecondary }]}>daily check</Text>
          </View>
          <View style={[styles.weekStrip, { borderColor: theme.border }]}>
            {weekCells.map((cell) => (
              <View key={cell.key} style={styles.weekDay}>
                <Text style={styles.weekLabel}>{cell.label}</Text>
                {cell.completed && cell.mood !== 'empty' ? (
                  <View style={[styles.dayBadge, { backgroundColor: moodFace[cell.mood].bg }]}>
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
                  <Text style={[styles.dayNumber, { color: theme.text }]}>{cell.dayNumber}</Text>
                )}
              </View>
            ))}
          </View>
        </View>

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
                        <Text style={[styles.appName, { color: theme.text }]} numberOfLines={1}>{app.name}</Text>
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
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 15 : 15,
    paddingBottom: 176
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
  heroCard: {
    minHeight: 156,
    borderRadius: 30,
    padding: 20,
    backgroundColor: '#111111',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.14,
    shadowRadius: 26,
    elevation: 9
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
  sectionMeta: {
    fontSize: 12,
    color: '#8E8E93',
    fontFamily: FONT_REGULAR,
    fontWeight: '500',
    textTransform: 'lowercase'
  },
  weekStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#EFEFF4',
    paddingVertical: 14,
    position: 'relative'
  },
  weekDay: {
    alignItems: 'center',
    width: '13.7%',
    zIndex: 1
  },
  weekLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 10,
    fontFamily: FONT_REGULAR,
    fontWeight: '500'
  },
  dayBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  },
  eyesRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 3
  },
  eye: {
    width: 3,
    height: 3,
    borderRadius: 2
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
    marginTop: 2
  },
  mouthNeutral: {
    width: 8,
    height: 1.5,
    borderRadius: 1,
    marginTop: 2
  },
  dayNumber: {
    fontSize: 17,
    color: '#1C1C1E',
    fontFamily: FONT_MONO,
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
    flex: 1,
    color: '#000000',
    fontSize: 15,
    fontFamily: FONT_REGULAR,
    fontWeight: '500'
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
