import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, RefreshControl } from 'react-native';
import PieChart from 'react-native-pie-chart';
import { ScreenTimeService, AppUsage, DailyUsageMap } from '../../services/ScreenTimeService';

export const HomeScreen = () => {
  const [usageData, setUsageData] = useState<AppUsage[]>([]);
  const [totalMins, setTotalMins] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const formatDateKey = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const formatDisplayDate = (date: Date) => {
    const month = date.toLocaleString('en-US', { month: 'long' });
    return `${date.getDate()} ${month}, ${date.getFullYear()}`;
  };

  const buildWeek = (date: Date) => {
    const start = new Date(date);
    start.setDate(date.getDate() - date.getDay()); // Sunday start
    const labels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d.getDate();
    });
    return { labels, dates };
  };

  // Updated formatting: 197m -> 3h 17m
  const formatTime = (totalMinutes: number) => {
    const h = Math.floor(totalMinutes / 60);
    const m = Math.round(totalMinutes % 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const loadData = async () => {
    setRefreshing(true);

    await ScreenTimeService.storeTodayStats();
    const stored: DailyUsageMap = await ScreenTimeService.getStoredDailyStats();
    const todayKey = formatDateKey(new Date());
    const todayMap = stored[todayKey] || {};

    let stats: AppUsage[] = Object.keys(todayMap).map((pkg) => ({
      id: pkg,
      minutes: Math.floor(todayMap[pkg] / 60000)
    }));

    if (stats.length === 0) {
      stats = await ScreenTimeService.getDailyStats();
    }

    const sortedStats = stats.sort((a, b) => b.minutes - a.minutes);
    setUsageData(sortedStats.slice(0, 4));
    setTotalMins(stats.reduce((acc, curr) => acc + curr.minutes, 0));
    setRefreshing(false);
  };

  useEffect(() => { loadData(); }, []);

  const colors = ['#B1B4FF', '#FFD1A9', '#A9F4FF', '#FFB1B1']; 
  const series = usageData.map((item, i) => ({ value: item.minutes, color: colors[i] }));
  
  if (series.length === 0) series.push({ value: 1, color: '#F0F0F0' });

  const today = new Date();
  const week = buildWeek(today);
  const weekLabels = week.labels;
  const weekDates = week.dates;
  const activeDate = today.getDate();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} />}
      >
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Analytics</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.iconButton}>
                <View style={styles.iconBell} />
                <View style={styles.notificationDot} />
              </TouchableOpacity>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>CW</Text>
              </View>
            </View>
          </View>

          <View style={styles.tabBar}>
            <TouchableOpacity style={styles.activeTab}><Text style={styles.activeTabText}>Day</Text></TouchableOpacity>
            <TouchableOpacity style={styles.tab}><Text style={styles.tabText}>Week</Text></TouchableOpacity>
            <TouchableOpacity style={styles.tab}><Text style={styles.tabText}>Month</Text></TouchableOpacity>
          </View>
        </View>

        <View style={styles.calendarCard}>
          <View style={styles.calendarHeader}>
            <View style={styles.moodCircle}>
              <Text style={styles.moodText}>:)</Text>
            </View>
            <Text style={styles.calendarDate}>{formatDisplayDate(today)}</Text>
          </View>

          <View style={styles.calendarWeek}>
            {weekLabels.map((label) => (
              <Text key={label} style={styles.weekLabel}>{label}</Text>
            ))}
          </View>

          <View style={styles.calendarDates}>
            {weekDates.map((date) => (
              <View key={date} style={[styles.dateCircle, date === activeDate && styles.activeDate]}>
                <Text style={[styles.dateText, date === activeDate && styles.activeDateText]}>{date}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.analyticsCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Daily Average</Text>
            <View style={styles.toggle}>
              <View style={styles.toggleActive}>
                <Text style={styles.toggleActiveText}>Time</Text>
              </View>
              <Text style={styles.toggleText}>Percents</Text>
            </View>
          </View>

          <View style={styles.chartContainer}>
            <PieChart 
              widthAndHeight={260} 
              series={series} 
              cover={0.7} 
              padAngle={0.05} // Gaps between segments
            />
            <View style={styles.chartCenter}>
              <Text style={styles.centerTime}>{formatTime(totalMins)}</Text>
              <Text style={styles.centerSub}>Total Today</Text>
            </View>
          </View>

          {/* New Legend List */}
          <View style={styles.appList}>
            {usageData.map((item, i) => (
              <View key={item.id} style={styles.appRow}>
                <View style={[styles.dot, { backgroundColor: colors[i] }]} />
                <Text style={styles.appName}>{item.id.split('.').pop()}</Text>
                <Text style={styles.appTime}>{formatTime(item.minutes)}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F7FB' },
  header: { paddingHorizontal: 24, paddingTop: 18, paddingBottom: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  title: { fontSize: 24, fontWeight: '700', color: '#1C1C1E' },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  iconButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', marginRight: 12, elevation: 2 },
  iconBell: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: '#1C1C1E' },
  notificationDot: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: '#A0A7FF', top: 7, right: 8 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E8EAFF', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontWeight: '700', color: '#4B4B4B', fontSize: 12 },

  tabBar: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 24, padding: 4, elevation: 2 },
  activeTab: { flex: 1, backgroundColor: '#1C1C1E', paddingVertical: 10, borderRadius: 20, alignItems: 'center' },
  activeTabText: { color: '#FFF', fontWeight: '600' },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  tabText: { color: '#8E8E93', fontWeight: '500' },

  calendarCard: { backgroundColor: '#FFFFFF', marginHorizontal: 20, marginTop: 8, borderRadius: 28, padding: 20, elevation: 3 },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  moodCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#C8D2FF', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  moodText: { fontWeight: '700', color: '#1C1C1E', fontSize: 12 },
  calendarDate: { fontSize: 16, fontWeight: '600', color: '#1C1C1E' },
  calendarWeek: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, paddingHorizontal: 4 },
  weekLabel: { color: '#8E8E93', fontSize: 12, width: 28, textAlign: 'center' },
  calendarDates: { flexDirection: 'row', justifyContent: 'space-between' },
  dateCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F2F3F7', justifyContent: 'center', alignItems: 'center' },
  dateText: { color: '#1C1C1E', fontWeight: '600', fontSize: 12 },
  activeDate: { backgroundColor: '#C8D2FF' },
  activeDateText: { color: '#1C1C1E' },

  analyticsCard: { backgroundColor: '#FFF', marginHorizontal: 20, marginTop: 16, borderRadius: 32, padding: 24, elevation: 4, marginBottom: 24 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#1C1C1E' },
  toggle: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F2F3F7', borderRadius: 18, padding: 3 },
  toggleText: { fontSize: 12, color: '#8E8E93', marginHorizontal: 8, fontWeight: '600' },
  toggleActive: { backgroundColor: '#1C1C1E', borderRadius: 14, paddingVertical: 6, paddingHorizontal: 10 },
  toggleActiveText: { color: '#FFFFFF', fontWeight: '600', fontSize: 12 },

  chartContainer: { justifyContent: 'center', alignItems: 'center', position: 'relative', marginTop: 10 },
  chartCenter: { position: 'absolute', alignItems: 'center' },
  centerTime: { fontSize: 28, fontWeight: '700', color: '#1C1C1E' },
  centerSub: { fontSize: 12, color: '#8E8E93', marginTop: 4 },
  appList: { marginTop: 24 },
  appRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  dot: { width: 12, height: 12, borderRadius: 6, marginRight: 12 },
  appName: { flex: 1, fontSize: 14, fontWeight: '600', textTransform: 'capitalize', color: '#2C2C2E' },
  appTime: { fontSize: 14, fontWeight: '700', color: '#1C1C1E' }
});
