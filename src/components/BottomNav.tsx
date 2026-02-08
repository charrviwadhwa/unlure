import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

type TabKey = 'overview' | 'analytics' | 'profile';

interface BottomNavProps {
  active: TabKey;
  onChange: (tab: TabKey) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ active, onChange }) => {
  const tabs: Array<{ key: TabKey; label: string; icon: string }> = [
    { key: 'overview', label: 'Home', icon: '\u2302' },
    { key: 'analytics', label: 'Analytics', icon: '\u25A6' },
    { key: 'profile', label: 'Profile', icon: '\u263A' }
  ];

  return (
    <View style={styles.wrapper}>
      <View style={styles.bar}>
        {tabs.map((tab) => {
          const isActive = active === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.item, isActive && styles.itemActive]}
              onPress={() => onChange(tab.key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.icon, isActive && styles.iconActive]}>{tab.icon}</Text>
              <Text style={[styles.label, isActive && styles.labelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { paddingHorizontal: 20, paddingBottom: 20, backgroundColor: 'transparent' },
  bar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 8,
    elevation: 8,
    justifyContent: 'space-between'
  },
  item: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 18 },
  itemActive: { backgroundColor: '#1C1C1E' },
  icon: { fontSize: 18, color: '#8E8E93', marginBottom: 2 },
  iconActive: { color: '#FFFFFF' },
  label: { fontSize: 11, color: '#8E8E93', fontWeight: '600' },
  labelActive: { color: '#FFFFFF' }
});
