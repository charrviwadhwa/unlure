import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';

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
  const [barWidth, setBarWidth] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!barWidth) return;
    const index = tabs.findIndex(t => t.key === active);
    const tabWidth = barWidth / tabs.length;
    Animated.spring(translateX, {
      toValue: index * tabWidth,
      useNativeDriver: true,
      friction: 7,
      tension: 80
    }).start();
  }, [active, barWidth, tabs.length, translateX]);

  return (
    <View style={styles.wrapper}>
      <View style={styles.bar} onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}>
        {barWidth > 0 && (
          <Animated.View
            style={[
              styles.activePill,
              { width: barWidth / tabs.length, transform: [{ translateX }] }
            ]}
          />
        )}
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
    justifyContent: 'space-between',
    position: 'relative',
    overflow: 'hidden'
  },
  activePill: {
    position: 'absolute',
    left: 8,
    top: 8,
    bottom: 8,
    backgroundColor: '#1C1C1E',
    borderRadius: 18,
    zIndex: 0
  },
  item: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 18, zIndex: 1 },
  itemActive: {},
  icon: { fontSize: 18, color: '#8E8E93', marginBottom: 2 },
  iconActive: { color: '#FFFFFF' },
  label: { fontSize: 11, color: '#8E8E93', fontWeight: '600' },
  labelActive: { color: '#FFFFFF' }
});
