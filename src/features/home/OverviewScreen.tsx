import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView } from 'react-native';
import { ScreenTimeService, DailyUsageMap } from '../../services/ScreenTimeService';
import { UserStore } from '../../services/storage';

interface OverviewScreenProps {
  userName: string;
}

type TopApp = {
  id: string;
  minutes: number;
};

export const OverviewScreen: React.FC<OverviewScreenProps> = ({ userName }) => {
  const [totalToday, setTotalToday] = useState(0);
  const [focusScore, setFocusScore] = useState(100);
  const [goalLabel, setGoalLabel] = useState('Set a daily goal');
  const [goalPercent, setGoalPercent] = useState(0);
  const [topApps, setTopApps] = useState<TopApp[]>([]);

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

  const formatAppName = (pkg: string) => {
    const name = pkg.split('.').pop() || pkg;
    return name.charAt(0).toUpperCase() + name.slice(1);
  };

  useEffect(() => {
    const load = async () => {
      await ScreenTimeService.storeTodayStats();
      const [stored, limits] = await Promise.all([
        ScreenTimeService.getStoredDailyStats(),
        UserStore.getAllLimits()
      ]);
      const todayKey = formatDateKey(new Date());
      const todayMap = (stored as DailyUsageMap)[todayKey] || {};

      const appEntries = Object.keys(todayMap).map((pkg) => ({
        id: pkg,
        minutes: Math.floor(todayMap[pkg] / 60000)
      }));
      const sortedApps = appEntries.sort((a, b) => b.minutes - a.minutes);
      setTopApps(sortedApps.slice(0, 3));

      const totalMins = sortedApps.reduce((acc, item) => acc + item.minutes, 0);
      setTotalToday(totalMins);

      const totalLimit = Object.keys(limits || {}).reduce((acc, pkg) => acc + (limits[pkg] || 0), 0);
      const limitedUsage = Object.keys(todayMap).reduce((acc, pkg) => {
        const limit = limits[pkg];
        return limit ? acc + Math.floor(todayMap[pkg] / 60000) : acc;
      }, 0);
      const score = totalLimit > 0 ? Math.max(0, Math.round(100 - (limitedUsage / totalLimit) * 100)) : 100;
      setFocusScore(score);

      const topLimitApp = Object.keys(limits || {}).sort((a, b) => (limits[b] || 0) - (limits[a] || 0))[0];
      if (topLimitApp) {
        const used = todayMap[topLimitApp] ? Math.floor(todayMap[topLimitApp] / 60000) : 0;
        const limit = limits[topLimitApp] || 0;
        const pct = limit > 0 ? Math.min(Math.round((used / limit) * 100), 100) : 0;
        setGoalLabel(`Limit ${formatAppName(topLimitApp)} to ${limit}m`);
        setGoalPercent(pct);
      } else {
        setGoalLabel('Set app limits to track goals');
        setGoalPercent(0);
      }
    };
    load();
  }, []);

  const ratio = Math.min(totalToday / (6 * 60), 1);
  const progressWidth = `${Math.max(ratio * 100, totalToday > 0 ? 8 : 0)}%`;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.bellWrap}>
            <Text style={styles.bellText}>{'\u25CF'}</Text>
          </View>
          <View style={styles.profileChip}>
            <View style={styles.avatarDot} />
            <Text style={styles.profileName}>{userName || 'Guest'}</Text>
          </View>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.timeRow}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: progressWidth }]} />
            </View>
            <Text style={styles.timeText}>{formatTime(totalToday)}</Text>
          </View>
          <Text style={styles.subText}>Top 3 apps today</Text>
        </View>

        <View style={styles.appsCard}>
          {(topApps.length ? topApps : [{ id: 'No usage data yet', minutes: 0 }]).map((app, index) => (
            <View key={app.id} style={[styles.appRow, index === 2 && styles.appRowLast]}>
              <View style={styles.appLeft}>
                <View style={styles.appIcon} />
                <View>
                  <Text style={styles.appName}>{formatAppName(app.id)}</Text>
                  <Text style={styles.appType}>Social</Text>
                </View>
              </View>
              <View style={styles.rankBadge}>
                <Text style={styles.rankText}>{index + 1}</Text>
              </View>
            </View>
          ))}

          <View style={styles.metricsRow}>
            <View style={styles.metricBlock}>
              <Text style={styles.metricLabel}>Time today</Text>
              <Text style={styles.metricValue}>{formatTime(totalToday)}</Text>
            </View>
            <View style={styles.metricBlock}>
              <Text style={styles.metricLabel}>Focus score</Text>
              <Text style={styles.metricValue}>{focusScore}%</Text>
            </View>
          </View>
        </View>

        <View style={styles.goalCard}>
          <Text style={styles.goalTitle}>Daily Goal</Text>
          <Text style={styles.goalLabel}>{goalLabel}</Text>
          <View style={styles.goalTrack}>
            <View style={[styles.goalFill, { width: `${goalPercent}%` }]} />
          </View>
          <Text style={styles.goalPercent}>{goalPercent}% completed</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  content: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 120
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  bellWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E6E6E6'
  },
  bellText: {
    fontSize: 12,
    color: '#111111'
  },
  profileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6E6E6'
  },
  avatarDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    marginRight: 8,
    backgroundColor: '#111111'
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111111'
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E6E6E6',
    padding: 16,
    marginBottom: 10
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  progressTrack: {
    flex: 1,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#EDEDED',
    overflow: 'hidden',
    marginRight: 10
  },
  progressFill: {
    height: '100%',
    borderRadius: 12,
    backgroundColor: '#111111'
  },
  timeText: {
    fontSize: 34,
    fontWeight: '700',
    color: '#111111'
  },
  subText: {
    marginTop: 10,
    fontSize: 16,
    color: '#444444',
    fontWeight: '500'
  },
  appsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E6E6E6',
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 12,
    marginBottom: 10
  },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#ECECEC'
  },
  appRowLast: {
    borderBottomWidth: 0
  },
  appLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  appIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#111111',
    marginRight: 10
  },
  appName: {
    fontSize: 30,
    fontWeight: '600',
    color: '#111111'
  },
  appType: {
    fontSize: 12,
    color: '#666666',
    marginTop: 2
  },
  rankBadge: {
    minWidth: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10
  },
  rankText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111111'
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#ECECEC'
  },
  metricBlock: {
    flex: 1
  },
  metricLabel: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 4
  },
  metricValue: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111111'
  },
  goalCard: {
    backgroundColor: '#111111',
    borderRadius: 24,
    padding: 16
  },
  goalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  goalLabel: {
    marginTop: 4,
    fontSize: 14,
    color: '#D7D7D7'
  },
  goalTrack: {
    marginTop: 12,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3A3A3A',
    overflow: 'hidden'
  },
  goalFill: {
    height: '100%',
    backgroundColor: '#FFFFFF'
  },
  goalPercent: {
    marginTop: 8,
    fontSize: 12,
    color: '#D7D7D7',
    fontWeight: '600'
  }
});
