import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, RefreshControl } from 'react-native';
import PieChart from 'react-native-pie-chart';
import { ScreenTimeService, AppUsage } from '../../services/ScreenTimeService';

export const HomeScreen = () => {
  const [usageData, setUsageData] = useState<AppUsage[]>([]);
  const [totalMins, setTotalMins] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Updated formatting: 197m -> 3h 17m
  const formatTime = (totalMinutes: number) => {
    const h = Math.floor(totalMinutes / 60);
    const m = Math.round(totalMinutes % 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const loadData = async () => {
    setRefreshing(true);
    const stats = await ScreenTimeService.getDailyStats();
    // Sort and take top 4 to create the segmented look
    const sortedStats = stats.sort((a, b) => b.minutes - a.minutes);
    setUsageData(sortedStats.slice(0, 4));
    setTotalMins(stats.reduce((acc, curr) => acc + curr.minutes, 0));
    setRefreshing(false);
  };

  useEffect(() => { loadData(); }, []);

  const colors = ['#B1B4FF', '#FFD1A9', '#A9F4FF', '#FFB1B1']; 
  const series = usageData.map((item, i) => ({ value: item.minutes, color: colors[i] }));
  
  if (series.length === 0) series.push({ value: 1, color: '#F0F0F0' });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Analytics</Text>
          <View style={styles.tabBar}>
            <TouchableOpacity style={styles.activeTab}><Text style={styles.activeTabText}>Day</Text></TouchableOpacity>
            <TouchableOpacity style={styles.tab}><Text style={styles.tabText}>Week</Text></TouchableOpacity>
            <TouchableOpacity style={styles.tab}><Text style={styles.tabText}>Month</Text></TouchableOpacity>
          </View>
        </View>

        <View style={styles.analyticsCard}>
          <Text style={styles.cardTitle}>Daily Average</Text>
          
          <View style={styles.chartContainer}>
            <PieChart 
              widthAndHeight={240} 
              series={series} 
              cover={0.72} 
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
  container: { flex: 1, backgroundColor: '#F9F9FB' },
  header: { padding: 25, alignItems: 'center' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 20 },
  tabBar: { flexDirection: 'row', backgroundColor: '#F0F0F2', borderRadius: 25, padding: 5, width: '90%' },
  activeTab: { flex: 1, backgroundColor: '#1A1A1A', paddingVertical: 10, borderRadius: 20, alignItems: 'center' },
  activeTabText: { color: '#FFF', fontWeight: 'bold' },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  tabText: { color: '#8E8E93' },
  analyticsCard: { backgroundColor: '#FFF', marginHorizontal: 20, borderRadius: 35, padding: 25, elevation: 4 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 25 },
  chartContainer: { justifyContent: 'center', alignItems: 'center', position: 'relative' },
  chartCenter: { position: 'absolute', alignItems: 'center' },
  centerTime: { fontSize: 30, fontWeight: 'bold', color: '#1C1C1E' },
  centerSub: { fontSize: 13, color: '#8E8E93', marginTop: 4 },
  appList: { marginTop: 35 },
  appRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  dot: { width: 12, height: 12, borderRadius: 6, marginRight: 15 },
  appName: { flex: 1, fontSize: 15, fontWeight: '600', textTransform: 'capitalize', color: '#2C2C2E' },
  appTime: { fontSize: 15, fontWeight: 'bold', color: '#1C1C1E' }
});