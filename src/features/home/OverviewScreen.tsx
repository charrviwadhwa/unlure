import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView } from 'react-native';
import { ScreenTimeService, DailyUsageMap } from '../../services/ScreenTimeService';
import { UserStore } from '../../services/storage';

interface OverviewScreenProps {
  userName: string;
}

export const OverviewScreen: React.FC<OverviewScreenProps> = ({ userName }) => {
  const [totalToday, setTotalToday] = useState(0);
  const [focusScore, setFocusScore] = useState(100);
  const [goalLabel, setGoalLabel] = useState('Set a daily goal');
  const [goalPercent, setGoalPercent] = useState(0);

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

  useEffect(() => {
    const load = async () => {
      await ScreenTimeService.storeTodayStats();
      const [stored, limits] = await Promise.all([
        ScreenTimeService.getStoredDailyStats(),
        UserStore.getAllLimits()
      ]);
      const todayKey = formatDateKey(new Date());
      const todayMap = (stored as DailyUsageMap)[todayKey] || {};

      const totalMins = Object.keys(todayMap).reduce((acc, pkg) => acc + Math.floor(todayMap[pkg] / 60000), 0);
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
        setGoalLabel(`Limit ${topLimitApp.split('.').pop()} to ${limit}m`);
        setGoalPercent(pct);
      } else {
        setGoalLabel('Set app limits to track goals');
        setGoalPercent(0);
      }
    };
    load();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.greeting}>Hello, {userName || 'Guest'}!</Text>
          <Text style={styles.subtitle}>Your personal focus dashboard</Text>
        </View>

        <View style={styles.cardsRow}>
          <View style={styles.squareCard}>
            <Text style={styles.cardLabel}>Total Screen Time</Text>
            <Text style={styles.cardValue}>{formatTime(totalToday)}</Text>
          </View>
          <View style={styles.squareCard}>
            <Text style={styles.cardLabel}>Focus Score</Text>
            <Text style={styles.cardValue}>{focusScore}%</Text>
          </View>
        </View>

        <View style={styles.goalCard}>
          <Text style={styles.goalTitle}>Daily Goal</Text>
          <Text style={styles.goalLabel}>{goalLabel}</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${goalPercent}%` }]} />
          </View>
          <Text style={styles.goalPercent}>{goalPercent}% of goal reached</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  content: { paddingBottom: 90 },
  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 18 },
  greeting: { fontSize: 26, fontWeight: '700', color: '#111111' },
  subtitle: { fontSize: 14, color: '#4A4A4A', marginTop: 6 },

  cardsRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 14 },
  squareCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    elevation: 3
  },
  cardLabel: { fontSize: 12, color: '#5B5B5B', marginBottom: 8, fontWeight: '600' },
  cardValue: { fontSize: 20, fontWeight: '700', color: '#111111' },

  goalCard: {
    marginTop: 18,
    marginHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    elevation: 3
  },
  goalTitle: { fontSize: 16, fontWeight: '700', color: '#111111', marginBottom: 6 },
  goalLabel: { fontSize: 13, color: '#4A4A4A', marginBottom: 12 },
  progressBar: { height: 10, backgroundColor: '#E8E8E8', borderRadius: 6, overflow: 'hidden' },
  progressFill: { height: 10, backgroundColor: '#111111', borderRadius: 6 },
  goalPercent: { marginTop: 8, fontSize: 12, color: '#5B5B5B', fontWeight: '600' }
});
