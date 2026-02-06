// src/features/detox/UsageDashboard.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const UsageItem = ({ name, minutes }: { name: string; minutes: number }) => {
  // We'll assume a "worrying" limit is 2 hours (120 mins) for the bar color
  const percentage = Math.min((minutes / 120) * 100, 100);

  return (
    <View style={styles.item}>
      <View style={styles.row}>
        <Text style={styles.appName}>{name.split('.').pop()}</Text> 
        <Text style={styles.minutes}>{minutes}m</Text>
      </View>
      <View style={styles.barBg}>
        <View style={[styles.barFill, { width: `${percentage}%` }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  item: { marginBottom: 15, paddingHorizontal: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  appName: { color: '#2D2D2D', fontWeight: '600', fontSize: 14 },
  minutes: { color: '#8E8E8E', fontSize: 12 },
  barBg: { height: 6, backgroundColor: '#E0E0E0', borderRadius: 3 },
  barFill: { height: 6, backgroundColor: '#8E9473', borderRadius: 3 },
});

export default UsageItem;