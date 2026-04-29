import React, { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import PieChart from 'react-native-pie-chart';
import { ScreenTimeService, DailyUsageMap } from '../../services/ScreenTimeService';

interface OverviewScreenProps {
  onEditApps: () => void;
}

type AppRow = {
  id: string;
  name: string;
  minutes: number;
};

const COLORS = ['#5263FF', '#76C6FF', '#FFB55A', '#80D68B', '#E39BFF'];

export const OverviewScreen: React.FC<OverviewScreenProps> = ({ onEditApps }) => {
  const [todayApps, setTodayApps] = useState<AppRow[]>([]);

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

  const load = async () => {
    await ScreenTimeService.storeTodayStats();
    const [storedStats, installedApps] = await Promise.all([
      ScreenTimeService.getStoredDailyStats(),
      ScreenTimeService.getInstalledApps()
    ]);

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
        minutes: Math.floor(todayMap[pkg] / 60000)
      }))
      .filter((row) => row.minutes > 0)
      .sort((a, b) => b.minutes - a.minutes);

    setTodayApps(rows);
  };

  useEffect(() => {
    load();
  }, []);

  const topApps = todayApps.slice(0, 5);
  const series = topApps.map((app, index) => ({ value: app.minutes, color: COLORS[index] || '#D0D5DD' }));
  const hasChart = series.length > 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Home</Text>
          <TouchableOpacity style={styles.editButton} onPress={onEditApps}>
            <Text style={styles.editButtonText}>Edit Apps List</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Today's Apps Used</Text>
          {todayApps.length === 0 ? (
            <Text style={styles.emptyText}>No app usage tracked yet today.</Text>
          ) : (
            todayApps.map((app) => (
              <View key={app.id} style={styles.appRow}>
                <Text style={styles.appName}>{app.name}</Text>
                <Text style={styles.appTime}>{app.minutes}m</Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Usage Pie Chart</Text>
          {hasChart ? (
            <View style={styles.chartWrap}>
              <PieChart widthAndHeight={200} series={series} cover={0.65} />
            </View>
          ) : (
            <Text style={styles.emptyText}>Pie chart appears when usage data is available.</Text>
          )}
          {topApps.map((app, index) => (
            <View key={`${app.id}-legend`} style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: COLORS[index] || '#CCCCCC' }]} />
              <Text style={styles.legendText}>{app.name}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6FB' },
  content: { padding: 18, paddingBottom: 110 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  title: { fontSize: 28, fontWeight: '800', color: '#111111' },
  editButton: { backgroundColor: '#111111', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  editButtonText: { color: '#FFFFFF', fontWeight: '700' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#E8ECF5' },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#141414', marginBottom: 12 },
  emptyText: { color: '#667085' },
  appRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#EFF2F8' },
  appName: { color: '#1A1A1A', fontSize: 15, fontWeight: '600', flex: 1, marginRight: 8 },
  appTime: { color: '#4D576B', fontWeight: '700' },
  chartWrap: { alignItems: 'center', marginVertical: 10 },
  legendRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  legendText: { color: '#344054', fontSize: 14 }
});
