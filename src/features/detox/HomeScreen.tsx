import React, { useState, useEffect } from 'react';
import { View, FlatList, SafeAreaView, Button, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ScreenTimeService, AppUsage } from '../../services/ScreenTimeService';
import { UserStore } from '../../services/storage';

interface HomeScreenProps {
  userName: string;
  onPressStreak: () => void;
}

export const HomeScreen = ({ userName, onPressStreak }: HomeScreenProps) => {
  // 1. All Hooks must be at the very top
  const [usageData, setUsageData] = useState<AppUsage[]>([]);
  const [userLimits, setUserLimits] = useState<Record<string, number>>({});
  const [healthScore, setHealthScore] = useState(100);
  const [loading, setLoading] = useState(true);

  // 2. Fetch data and calculate health logic
  const loadData = async () => {
    try {
      setLoading(true);
      const stats = await ScreenTimeService.getDailyStats(); // Native Java bridge
      const limits = await UserStore.getAllLimits(); // Custom Roller limits
      
      setUserLimits(limits);
      setUsageData(stats);

      // Calculate the "Unlure Health Score"
      let deduction = 0;
      stats.forEach(app => {
        const limit = limits[app.id];
        // If app is tracked and over limit, deduct from health
        if (limit && app.minutes > limit) {
          deduction += (app.minutes - limit);
        }
      });

      setHealthScore(Math.max(100 - deduction, 0));
    } catch (error) {
      console.error("Failed to load Unlure stats:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 3. Conditional UI logic (Tints background if failing detox)
  const isHealthy = healthScore >= 50;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isHealthy ? '#F5F2ED' : '#FFF0F0' }]}>
      
      {/* Header with Dynamic Health Score */}
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>Welcome back,</Text>
          <Text style={styles.userNameText}>{userName}</Text>
        </View>
        <TouchableOpacity 
          onPress={onPressStreak}
          style={[styles.scoreBadge, { borderColor: isHealthy ? '#8E9473' : '#FF6B6B' }]}
        >
          <Text style={styles.scoreLabel}>HEALTH</Text>
          <Text style={[styles.scoreValue, { color: isHealthy ? '#8E9473' : '#FF6B6B' }]}>
            {healthScore}% {isHealthy ? '🔥' : '😭'}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Today's Unlure Stats</Text>

      <FlatList
        data={usageData}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 20 }}
        renderItem={({ item }) => {
          const limit = userLimits[item.id] || 0;
          const usage = item.minutes;
          const progress = limit > 0 ? Math.min((usage / limit) * 100, 100) : 0;
          const isOver = limit > 0 && usage > limit;

          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                {/* Clean package name (com.android.youtube -> youtube) */}
                <Text style={styles.appName}>{item.id.split('.').pop()}</Text>
                <Text style={styles.usageText}>{usage}m / {limit}m</Text>
              </View>
              
              <View style={styles.progressBg}>
                <View style={[
                  styles.progressFill, 
                  { width: `${progress}%`, backgroundColor: isOver ? '#FF6B6B' : '#8E9473' }
                ]} />
              </View>
              
              {isOver && (
                <Text style={styles.roastText}>You are {usage - limit}m past your limit! 🛑</Text>
              )}
            </View>
          );
        }}
      />
      
      <View style={styles.footer}>
        <Button title="Refresh Reality" onPress={loadData} color="#2D2D2D" />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 25, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  welcomeText: { fontSize: 13, color: '#8E8E8E', textTransform: 'uppercase', letterSpacing: 1 },
  userNameText: { fontSize: 26, fontWeight: '800', color: '#2D2D2D' },
  scoreBadge: { 
    backgroundColor: '#FFF', 
    padding: 12, 
    borderRadius: 18, 
    borderWidth: 2, 
    alignItems: 'center',
    minWidth: 90
  },
  scoreLabel: { fontSize: 10, fontWeight: 'bold', color: '#AAA' },
  scoreValue: { fontSize: 18, fontWeight: '900' },
  sectionTitle: { fontSize: 18, paddingHorizontal: 25, fontWeight: '700', marginBottom: 15 },
  card: { backgroundColor: '#FFF', padding: 20, borderRadius: 24, marginBottom: 15, elevation: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  appName: { fontSize: 16, fontWeight: '700', textTransform: 'capitalize' },
  usageText: { fontSize: 14, color: '#666', fontWeight: '600' },
  progressBg: { height: 10, backgroundColor: '#F0F0F0', borderRadius: 5, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 5 },
  roastText: { fontSize: 12, color: '#FF6B6B', marginTop: 10, fontWeight: '600' },
  footer: { padding: 25 }
});