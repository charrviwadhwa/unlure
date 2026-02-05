import React, { useState, useEffect } from 'react';
import { View, FlatList, SafeAreaView, Button, Text, TouchableOpacity } from 'react-native';
import { ScreenTimeService, AppUsage } from '../../services/ScreenTimeService';
import { UsageItem } from '../../components/UsageItem';

// 1. Define the interface for the props you're passing from App.tsx
interface HomeScreenProps {
  userName: string;
  onPressStreak: () => void;
}

// 2. Apply the interface to the component
export const HomeScreen = ({ userName, onPressStreak }: HomeScreenProps) => {
  const [usageData, setUsageData] = useState<AppUsage[]>([]);

  const loadData = async () => {
    const stats = await ScreenTimeService.getDailyStats();
    if (stats.length === 0) {
      ScreenTimeService.openSettings();
    } else {
      setUsageData(stats);
    }
  };

  useEffect(() => { loadData(); }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F2ED' }}>
      {/* 3. Use the userName prop here! */}
      <View style={{ padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <Text style={{ fontSize: 14, color: '#8E8E8E' }}>Welcome back,</Text>
          <Text style={{ fontSize: 24, fontWeight: '700', color: '#2D2D2D' }}>{userName}</Text>
        </View>
        
        {/* 4. Use the onPressStreak prop here! */}
        <TouchableOpacity 
          onPress={onPressStreak}
          style={{ backgroundColor: '#FFF', padding: 10, borderRadius: 12, elevation: 2 }}
        >
          <Text style={{ fontSize: 20 }}>🔥</Text>
        </TouchableOpacity>
      </View>

      <Text style={{ fontSize: 18, paddingHorizontal: 20, marginTop: 10, fontWeight: '600', color: '#2D2D2D' }}>
        Today's Usage
      </Text>

      <FlatList
        data={usageData}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <UsageItem name={item.id} minutes={item.minutes} />}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10 }}
      />
      
      <View style={{ padding: 20 }}>
        <Button title="Refresh Stats" onPress={loadData} color="#8E9473" />
      </View>
    </SafeAreaView>
  );
};