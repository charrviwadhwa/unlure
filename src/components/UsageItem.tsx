import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface UsageItemProps {
  name: string;
  minutes: number;
}

export const UsageItem = ({ name, minutes }: UsageItemProps) => {
  // Logic: 120 mins (2hrs) is the "max" for our progress bar visualization
  const progressWidth = Math.min((minutes / 120) * 100, 100);

  // SAFE DATA HANDLING: Ensure name exists before splitting
  // We use optional chaining (?.) and nullish coalescing (??)
  const friendlyName = name?.split('.').pop() ?? 'Unknown App';

  return (
    <View style={styles.container}>
      <View style={styles.textRow}>
        <Text style={styles.appName}>{friendlyName}</Text>
        <Text style={styles.timeText}>{minutes}m</Text>
      </View>
      <View style={styles.progressBarBackground}>
        <View style={[styles.progressBarFill, { width: `${progressWidth}%` }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 15, backgroundColor: '#FFF', marginBottom: 10, borderRadius: 12 },
  textRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  appName: { fontSize: 16, fontWeight: '600', color: '#333', textTransform: 'capitalize' },
  timeText: { fontSize: 14, color: '#666' },
  progressBarBackground: { height: 8, backgroundColor: '#E0E0E0', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#8E9473' }, 
});