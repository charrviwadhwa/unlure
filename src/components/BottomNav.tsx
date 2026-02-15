import React, { useEffect, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, Animated, Image, ImageSourcePropType } from 'react-native';

type TabKey = 'overview' | 'analytics' | 'profile';

interface BottomNavProps {
  active: TabKey;
  onChange: (tab: TabKey) => void;
}

const tabs: Array<{ key: TabKey; icon: ImageSourcePropType }> = [
  { key: 'overview', icon: require('../assets/home.png') },
  { key: 'analytics', icon: require('../assets/analytics.png') },
  { key: 'profile', icon: require('../assets/profile.png') }
];

const ITEM_SIZE = 52;
const BAR_PADDING = 6;

const BottomNavComponent: React.FC<BottomNavProps> = ({ active, onChange }) => {
  const translateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const index = tabs.findIndex(t => t.key === active);
    Animated.spring(translateX, {
      toValue: index * ITEM_SIZE,
      useNativeDriver: true,
      friction: 8,
      tension: 110
    }).start();
  }, [active, translateX]);

  return (
    <View style={styles.wrapper}>
      <View style={styles.bar}>
        <Animated.View
          style={[
            styles.activeBubble,
            { transform: [{ translateX }] }
          ]}
        />
        {tabs.map((tab) => {
          const isActive = active === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.item, isActive && styles.itemActive]}
              onPress={() => {
                if (!isActive) onChange(tab.key);
              }}
              activeOpacity={0.8}
            >
              <Image source={tab.icon} style={[styles.icon, isActive && styles.iconActive]} />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

export const BottomNav = React.memo(BottomNavComponent);

const styles = StyleSheet.create({
  wrapper: { paddingHorizontal: 20, paddingBottom: 20, alignItems: 'center', backgroundColor: 'transparent' },
  bar: {
    flexDirection: 'row',
    backgroundColor: '#141414',
    borderRadius: 999,
    padding: BAR_PADDING,
    elevation: 10,
    position: 'relative',
    overflow: 'hidden',
    alignItems: 'center'
  },
  activeBubble: {
    position: 'absolute',
    left: BAR_PADDING,
    top: BAR_PADDING,
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    borderRadius: ITEM_SIZE / 2,
    backgroundColor: '#FFFFFF',
    zIndex: 0,
    borderWidth: 1,
    borderColor: '#EDEDED'
  },
  item: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: ITEM_SIZE / 2,
    zIndex: 1
  },
  itemActive: {},
  icon: {
    width: 22,
    height: 22,
    tintColor: '#FFFFFF'
  },
  iconActive: { tintColor: '#111111' }
});
