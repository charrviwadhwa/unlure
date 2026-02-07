import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, RefreshControl } from 'react-native';
import PieChart from 'react-native-pie-chart';
import { ScreenTimeService, AppUsage } from '../../services/ScreenTimeService';
import { UserStore } from '../../services/storage';

export const HomeScreen = ({ userName }: { userName: string }) => {
  const [usageData, setUsageData] = useState<AppUsage[]>([]);
  const [totalUsage, setTotalUsage] = useState(0);
  const [totalLimit, setTotalLimit] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Colors for the top 4 segments
  const segmentColors = ['#B1B4FF', '#FFD1A9', '#A9F4FF', '#FFB1B1'];

  const loadData = async () => {
    setRefreshing(true);
    try {
      const [stats, limits] = await Promise.all([
        ScreenTimeService.getDailyStats(),
        UserStore.getAllLimits()
      ]);

      const sumUsage = stats.reduce((acc, curr) => acc + curr.minutes, 0);
      const sumLimit = Object.values(limits).reduce((acc, curr) => acc + (curr as number), 0);

      setUsageData(stats.slice(0, 4)); // Only top 4 for the circle
      setTotalUsage(sumUsage);
      setTotalLimit(sumLimit || 60); // Default to 60m if no limits set
    } catch (error) {
      console.error(error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // Format data for the PieChart
  const series = usageData.map((item, index) => ({
    value: item.minutes,
    color: segmentColors[index % segmentColors.length],
  }));

  // Empty state placeholder
  if (series.length === 0) series.push({ value: 1, color: '#F0F0F0' });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} />}>
        
        {/* Header Section */}
        <View style={styles.header}>
          <Text style={styles.title}>Analytics</Text>
          <View style={styles.tabContainer}>
            <TouchableOpacity style={styles.activeTab}><Text style={styles.activeTabText}>Day</Text></TouchableOpacity>
            <TouchableOpacity style={styles.inactiveTab}><Text style={styles.inactiveTabText}>Week</Text></TouchableOpacity>
            <TouchableOpacity style={styles.inactiveTab}><Text style={styles.inactiveTabText}>Month</Text></TouchableOpacity>
          </View>
        </View>

        {/* The Segmented Analytics Card */}
        <View style={styles.analyticsCard}>
          <Text style={styles.cardTitle}>Daily Average</Text>
          
          <View style={styles.chartWrapper}>
            <PieChart
              widthAndHeight={240}
              series={series}
              cover={0.7} // Creates the Donut hole
              padAngle={0.04} // Creates the gaps between segments
            />
            <View style={styles.chartCenter}>
              <Text style={styles.percentText}>
                {totalLimit > 0 ? Math.round((totalUsage / totalLimit) * 100) : 0}%
              </Text>
              <Text style={styles.subtitle}>Goal Used</Text>
            </View>
          </View>

          {/* Legend Grid */}
          <View style={styles.legendGrid}>
            {usageData.map((item, i) => (
              <View key={item.id} style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: segmentColors[i] }]} />
                <Text style={styles.legendText}>{item.id.split('.').pop()}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerTime}>{totalUsage}m</Text>
          <Text style={styles.footerLimit}>/ {totalLimit}m limit</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F9FB' },
  header: { padding: 20, alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  tabContainer: { flexDirection: 'row', backgroundColor: '#F0F0F2', borderRadius: 25, padding: 5, width: '90%' },
  activeTab: { flex: 1, backgroundColor: '#1A1A1A', paddingVertical: 10, borderRadius: 20, alignItems: 'center' },
  activeTabText: { color: '#FFF', fontWeight: 'bold' },
  inactiveTab: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  inactiveTabText: { color: '#8E8E93' },
  analyticsCard: { backgroundColor: '#FFF', margin: 20, borderRadius: 35, padding: 25, elevation: 4 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 20 },
  chartWrapper: { justifyContent: 'center', alignItems: 'center', position: 'relative' },
  chartCenter: { position: 'absolute', alignItems: 'center' },
  percentText: { fontSize: 36, fontWeight: 'bold', color: '#1C1C1E' },
  subtitle: { fontSize: 12, color: '#8E8E93' },
  legendGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 20 },
  legendItem: { flexDirection: 'row', alignItems: 'center', margin: 10 },
  dot: { width: 12, height: 12, borderRadius: 6, marginRight: 8 },
  legendText: { fontSize: 12, color: '#48484A', textTransform: 'capitalize' },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'baseline', paddingBottom: 40 },
  footerTime: { fontSize: 22, fontWeight: 'bold', color: '#B1B4FF' },
  footerLimit: { fontSize: 14, color: '#8E8E93', marginLeft: 5 }
});