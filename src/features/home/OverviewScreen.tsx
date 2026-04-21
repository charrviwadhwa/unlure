import React, { useEffect, useState } from 'react';
import {
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Circle, Path, Polygon, Rect } from 'react-native-svg';
import { ScreenTimeService, DailyUsageMap } from '../../services/ScreenTimeService';
import { UserStore } from '../../services/storage';

interface OverviewScreenProps {
  userName: string;
}

type TopApp = {
  id: string;
  name: string;
  iconBase64?: string;
  minutes: number;
  dailyAverage: number;
};

type AppKind = 'instagram' | 'youtube' | 'music' | 'settings' | 'generic';

const APP_TINTS = ['#EEF1FF', '#FFF1F2', '#FFF9EA'];
const RANK_TINTS = ['#5A6BFF', '#EB6F78', '#CCA437'];
const FONT = {
  title: 'PlayfairDisplay-Bold',
  heading: 'PlayfairDisplay-SemiBold',
  body: 'sans-serif',
  regular: 'sans-serif'
};

const FlameIcon = () => (
  <Svg width={54} height={54} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12.2 2.5C9.9 5.1 9.2 7.1 9.6 8.9C9.8 9.7 10.2 10.4 10.6 11C11.1 10.3 11.8 9.3 12.1 8.1C12.3 7.3 12.4 6.2 12 4.9C15.8 7.2 18.8 11.1 17.8 15C17 18 14.6 20 11.9 20C8.6 20 6 17.3 6 14C6 10.6 8.5 6.2 12.2 2.5Z"
      fill="#FF944D"
    />
    <Path
      d="M12.3 10.2C10.8 11.5 10.3 12.8 10.5 13.9C10.7 14.9 11.4 15.7 12.4 16C13.7 16.4 15.1 15.7 15.6 14.5C16.1 13.2 15.6 11.8 14.5 10.7C14.3 11.5 13.5 12.4 12.3 10.2Z"
      fill="#FFE4CC"
    />
  </Svg>
);

const detectAppKind = (id: string, name: string): AppKind => {
  const value = `${id} ${name}`.toLowerCase();
  if (value.includes('instagram')) return 'instagram';
  if (value.includes('youtube')) return 'youtube';
  if (value.includes('spotify') || value.includes('music') || value.includes('tiktok')) return 'music';
  if (value.includes('setting')) return 'settings';
  return 'generic';
};

const AppGlyph = ({ kind, color }: { kind: AppKind; color: string }) => {
  if (kind === 'instagram') {
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Rect x={4} y={4} width={16} height={16} rx={5} stroke={color} strokeWidth={2} />
        <Circle cx={12} cy={12} r={3.5} stroke={color} strokeWidth={2} />
        <Circle cx={17} cy={7} r={1.2} fill={color} />
      </Svg>
    );
  }

  if (kind === 'youtube') {
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Rect x={3} y={6} width={18} height={12} rx={4} stroke={color} strokeWidth={2} />
        <Polygon points="10,9 16,12 10,15" fill={color} />
      </Svg>
    );
  }

  if (kind === 'music') {
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Path d="M15 6V14.5C15 16 13.8 17.2 12.3 17.2C10.8 17.2 9.6 16 9.6 14.5C9.6 13 10.8 11.8 12.3 11.8C12.9 11.8 13.5 12 14 12.3V8.3L18 7V13.7C18 15.2 16.8 16.4 15.3 16.4C14.1 16.4 13.1 15.7 12.7 14.7" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    );
  }

  if (kind === 'settings') {
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={2} />
        <Path d="M12 4.5V7M12 17V19.5M19.5 12H17M7 12H4.5M17.3 6.7L15.6 8.4M8.4 15.6L6.7 17.3M17.3 17.3L15.6 15.6M8.4 8.4L6.7 6.7" stroke={color} strokeWidth={2} strokeLinecap="round" />
      </Svg>
    );
  }

  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Rect x={5} y={5} width={6} height={6} rx={1.4} stroke={color} strokeWidth={2} />
      <Rect x={13} y={5} width={6} height={6} rx={1.4} stroke={color} strokeWidth={2} />
      <Rect x={5} y={13} width={6} height={6} rx={1.4} stroke={color} strokeWidth={2} />
      <Rect x={13} y={13} width={6} height={6} rx={1.4} stroke={color} strokeWidth={2} />
    </Svg>
  );
};

export const OverviewScreen: React.FC<OverviewScreenProps> = ({ userName }) => {
  const [streak, setStreak] = useState(0);
  const [topApps, setTopApps] = useState<TopApp[]>([]);
  const [goalLabel, setGoalLabel] = useState('Set app limits to track your goal');
  const [goalPercent, setGoalPercent] = useState(0);
  const [goalHint, setGoalHint] = useState('Add one app limit from your profile to unlock goal tracking.');
  const [todayTotalMinutes, setTodayTotalMinutes] = useState(0);

  const formatDateKey = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const formatTime = (totalMinutes: number) => {
    const h = Math.floor(totalMinutes / 60);
    const m = Math.round(totalMinutes % 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const normalizeName = (text: string) => {
    if (!text) return 'Unknown app';
    if (!text.includes('.')) return text;
    const raw = text.split('.').pop() || text;
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  };

  useEffect(() => {
    const load = async () => {
      await ScreenTimeService.storeTodayStats();

      const [storedStats, limits, currentStreak, installedApps] = await Promise.all([
        ScreenTimeService.getStoredDailyStats(),
        UserStore.getAllLimits(),
        UserStore.getStreak(),
        ScreenTimeService.getInstalledApps()
      ]);

      setStreak(currentStreak);

      const nameMap = installedApps.reduce<Record<string, string>>((acc, app) => {
        acc[app.packageName] = app.appName;
        return acc;
      }, {});
      const iconMap = installedApps.reduce<Record<string, string>>((acc, app) => {
        if (app.iconBase64) acc[app.packageName] = app.iconBase64;
        return acc;
      }, {});

      const todayKey = formatDateKey(new Date());
      const todayMap = (storedStats as DailyUsageMap)[todayKey] || {};
      const todayEntries = Object.keys(todayMap).map((pkg) => ({
        id: pkg,
        minutes: Math.floor(todayMap[pkg] / 60000)
      }));

      const sortedToday = todayEntries.sort((a, b) => b.minutes - a.minutes);
      setTodayTotalMinutes(sortedToday.reduce((acc, item) => acc + item.minutes, 0));

      const topThree = sortedToday.slice(0, 3).map((item) => {
        const now = new Date();
        let weekTotal = 0;
        for (let i = 0; i < 7; i += 1) {
          const day = new Date(now);
          day.setDate(now.getDate() - i);
          const key = formatDateKey(day);
          const map = (storedStats as DailyUsageMap)[key] || {};
          weekTotal += Math.floor((map[item.id] || 0) / 60000);
        }

        return {
          id: item.id,
          name: nameMap[item.id] || normalizeName(item.id),
          iconBase64: iconMap[item.id],
          minutes: item.minutes,
          dailyAverage: Math.round(weekTotal / 7)
        };
      });
      setTopApps(topThree);

      const strongestGoalApp = Object.keys(limits || {}).sort((a, b) => (limits[b] || 0) - (limits[a] || 0))[0];
      if (!strongestGoalApp) {
        setGoalLabel('Set app limits to track your goal');
        setGoalPercent(0);
        setGoalHint('Add one app limit from your profile to unlock goal tracking.');
        return;
      }

      const limit = limits[strongestGoalApp] || 0;
      const used = Math.floor((todayMap[strongestGoalApp] || 0) / 60000);
      const percent = limit > 0 ? Math.min(Math.round((used / limit) * 100), 100) : 0;
      const remaining = Math.max(limit - used, 0);

      setGoalLabel(`Keep ${nameMap[strongestGoalApp] || normalizeName(strongestGoalApp)} under ${limit}m`);
      setGoalPercent(percent);
      setGoalHint(remaining > 0 ? `${remaining}m left for today` : 'Goal reached for today. Great control!');
    };

    load();
  }, []);

  const streakProgress = `${Math.min((todayTotalMinutes / 240) * 100, 100)}%` as `${number}%`;
  const goalWidth = `${goalPercent}%` as `${number}%`;

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#F8FAFF', '#FFFFFF']} style={styles.gradientBg}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={styles.streakCard}>
            <View style={styles.flameWrap}>
              <FlameIcon />
            </View>
            <Text style={styles.streakNumber}>{streak}</Text>
            <Text style={styles.streakTitle}>Day Streak</Text>
            <Text style={styles.streakSubtitle}>You are doing really great, {userName || 'friend'}.</Text>

            <View style={styles.todayUsageRow}>
              <View style={styles.todayUsageTrack}>
                <View style={[styles.todayUsageFill, { width: streakProgress }]} />
              </View>
              <Text style={styles.todayUsageText}>{formatTime(todayTotalMinutes)}</Text>
            </View>
          </View>

          <View style={styles.appsCard}>
            <Text style={styles.sectionTitle}>Top 3 apps today</Text>
            {topApps.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No usage data yet for today.</Text>
              </View>
            ) : (
              topApps.map((app, index) => {
                const rankColor = RANK_TINTS[index] || '#7D86A9';
                const kind = detectAppKind(app.id, app.name);
                return (
                  <View key={app.id} style={[styles.appRow, { backgroundColor: APP_TINTS[index] || '#F4F6FD' }]}>
                    <View style={styles.appIdentity}>
                      <View style={[styles.appIconBox, { backgroundColor: `${rankColor}22` }]}>
                        {app.iconBase64 ? (
                          <Image
                            source={{ uri: `data:image/png;base64,${app.iconBase64}` }}
                            style={styles.appIconImage}
                            resizeMode="contain"
                          />
                        ) : (
                          <AppGlyph kind={kind} color={rankColor} />
                        )}
                      </View>
                      <View style={styles.appTextWrap}>
                        <Text numberOfLines={1} style={styles.appName}>{app.name}</Text>
                        <Text style={styles.appMeta}>Today {formatTime(app.minutes)} | Avg {formatTime(app.dailyAverage)}</Text>
                      </View>
                    </View>

                    <View style={[styles.rankBadge, { borderColor: `${rankColor}66` }]}>
                      <Text style={[styles.rankText, { color: rankColor }]}>{index + 1}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          <View style={styles.goalCard}>
            <Text style={styles.goalTitle}>Daily Goal</Text>
            <Text style={styles.goalLabel}>{goalLabel}</Text>

            <View style={styles.goalTrack}>
              <LinearGradient colors={['#6976FF', '#8A95FF']} style={[styles.goalFill, { width: goalWidth }]} />
            </View>

            <View style={styles.goalFooterRow}>
              <Text style={styles.goalHint}>{goalHint}</Text>
              <Text style={styles.goalPercent}>{goalPercent}%</Text>
            </View>
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F4FB'
  },
  gradientBg: {
    flex: 1
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 120,
    gap: 16
  },
  streakCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#E9EDFB',
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 20,
    shadowColor: '#7E8CF8',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3
  },
  flameWrap: {
    width: 116,
    height: 116,
    borderRadius: 58,
    borderWidth: 1,
    borderColor: '#E9EDFB',
    backgroundColor: '#FAFBFF',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8
  },
  streakNumber: {
    fontFamily: FONT.title,
    fontSize: 54,
    lineHeight: 58,
    color: '#171C31',
    textAlign: 'center',
    fontWeight: '800'
  },
  streakTitle: {
    fontFamily: FONT.title,
    marginTop: 2,
    textAlign: 'center',
    fontSize: 42,
    lineHeight: 46,
    color: '#14192E',
    fontWeight: '800'
  },
  streakSubtitle: {
    fontFamily: FONT.body,
    marginTop: 8,
    textAlign: 'center',
    color: '#7B839E',
    fontSize: 14
  },
  todayUsageRow: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center'
  },
  todayUsageTrack: {
    flex: 1,
    height: 16,
    borderRadius: 999,
    backgroundColor: '#EDF1FC',
    overflow: 'hidden',
    marginRight: 12
  },
  todayUsageFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#6573FF'
  },
  todayUsageText: {
    fontFamily: FONT.heading,
    fontSize: 26,
    color: '#2B345A'
  },
  appsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#E9EDFB',
    padding: 16
  },
  sectionTitle: {
    fontFamily: FONT.heading,
    fontSize: 16,
    color: '#29314F',
    marginBottom: 12
  },
  appRow: {
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  appIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10
  },
  appIconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  appIconImage: {
    width: 28,
    height: 28,
    borderRadius: 8
  },
  appTextWrap: {
    flex: 1
  },
  appName: {
    fontFamily: FONT.heading,
    fontSize: 16,
    color: '#1F2742',
    fontWeight: '700'
  },
  appMeta: {
    fontFamily: FONT.body,
    marginTop: 2,
    fontSize: 12,
    color: '#66708E',
    fontWeight: '600'
  },
  rankBadge: {
    minWidth: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFFCC',
    paddingHorizontal: 8
  },
  rankText: {
    fontFamily: FONT.heading,
    fontSize: 18
  },
  goalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#E9EDFB',
    padding: 16
  },
  goalTitle: {
    fontFamily: FONT.heading,
    fontSize: 16,
    color: '#29314F',
    fontWeight: '700'
  },
  goalLabel: {
    fontFamily: FONT.body,
    marginTop: 8,
    fontSize: 14,
    color: '#3D4464',
    fontWeight: '600'
  },
  goalTrack: {
    marginTop: 12,
    height: 11,
    borderRadius: 999,
    backgroundColor: '#EDF0FA',
    overflow: 'hidden'
  },
  goalFill: {
    height: '100%',
    borderRadius: 999
  },
  goalFooterRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  goalHint: {
    fontFamily: FONT.body,
    color: '#677196',
    fontSize: 12,
    flex: 1,
    marginRight: 12
  },
  goalPercent: {
    fontFamily: FONT.heading,
    color: '#29314F',
    fontSize: 13
  },
  emptyState: {
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#D9DEEF',
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyText: {
    fontFamily: FONT.regular,
    color: '#6C7595',
    fontSize: 14,
    fontWeight: '500'
  }
});
