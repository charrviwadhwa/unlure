import React, { useState, useEffect } from 'react';
import { View, FlatList, SafeAreaView, Text, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { ScreenTimeService, AppUsage } from '../../services/ScreenTimeService';
import { UserStore } from '../../services/storage';

interface HomeScreenProps {
  userName: string;
  onPressStreak: () => void;
}

export const HomeScreen = ({ userName, onPressStreak }: HomeScreenProps) => {
  // 1. ALL HOOKS MUST BE AT THE TOP LEVEL
  const [usageData, setUsageData] = useState<AppUsage[]>([]);
  const [userLimits, setUserLimits] = useState<Record<string, number>>({});
  const [healthScore, setHealthScore] = useState(100);
  const [refreshing, setRefreshing] = useState(false);

  const calculateHealth = (stats: AppUsage[], limits: Record<string, number>) => {
    let deduction = 0;
    stats.forEach(app => {
      const limit = limits[app.id];
      if (limit && app.minutes > limit) {
        deduction += (app.minutes - limit);
      }
    });
    setHealthScore(Math.max(100 - deduction, 0));
  };

  const loadData = async () => {
    setRefreshing(true);
    const [stats, limits] = await Promise.all([
      ScreenTimeService.getDailyStats(),
      UserStore.getAllLimits()
    ]);
    
    setUsageData(stats);
    setUserLimits(limits || {});
    calculateHealth(stats, limits || {});
    setRefreshing(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const isHealthy = healthScore >= 50;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isHealthy ? '#F5F2ED' : '#FFF0F0' }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>Welcome,</Text>
          <Text style={styles.userNameText}>{userName}</Text>
        </View>
        <TouchableOpacity 
          style={[styles.scoreBadge, { borderColor: isHealthy ? '#8E9473' : '#FF6B6B' }]} 
          onPress={onPressStreak}
        >
          <Text style={[styles.scoreValue, { color: isHealthy ? '#8E9473' : '#FF6B6B' }]}>
            {healthScore}% {isHealthy ? '🔥' : '😭'}
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={usageData}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} />}
        contentContainerStyle={{ padding: 20 }}
        renderItem={({ item }) => {
          const limit = userLimits[item.id] || 0;
          const isOver = limit > 0 && item.minutes > limit;
          const progress = limit > 0 ? (item.minutes / limit) * 100 : 0;

          return (
            <View style={styles.card}>
              <View style={styles.cardInfo}>
                <Text style={styles.cardName}>{item.id.split('.').pop()}</Text>
                <Text style={styles.cardUsage}>{item.minutes}m / {limit || '--'}m</Text>
              </View>
              <View style={styles.barBg}>
                <View style={[
                  styles.barFill, 
                  { 
                    width: `${Math.min(progress, 100)}%`, 
                    backgroundColor: isOver ? '#FF6B6B' : '#8E9473' 
                  }
                ]} />
              </View>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 25, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  welcomeText: { fontSize: 13, color: '#888' },
  userNameText: { fontSize: 28, fontWeight: 'bold', color: '#2D2D2D' },
  scoreBadge: { backgroundColor: '#FFF', padding: 12, borderRadius: 20, borderWidth: 2 },
  scoreValue: { fontSize: 18, fontWeight: '900' },
  card: { backgroundColor: '#FFF', padding: 20, borderRadius: 24, marginBottom: 15, elevation: 2 },
  cardInfo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  cardName: { fontWeight: '700', fontSize: 16, textTransform: 'capitalize' },
  cardUsage: { color: '#8E8E8E', fontSize: 13 },
  barBg: { height: 10, backgroundColor: '#F0F0F0', borderRadius: 5, overflow: 'hidden' },
  barFill: { height: '100%' }
});