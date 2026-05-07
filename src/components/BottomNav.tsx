import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Pressable, StyleSheet, Animated, Image, ImageSourcePropType } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

type TabKey = 'home' | 'streak' | 'analytics';

interface BottomNavProps {
  active: TabKey;
  onChange: (tab: TabKey) => void;
}

const tabs: Array<{ key: TabKey; icon: ImageSourcePropType }> = [
  { key: 'home', icon: require('../assets/home.png') },
  { key: 'streak', icon: require('../assets/profile.png') },
  { key: 'analytics', icon: require('../assets/analytics.png') },
];

const ITEM_SIZE = 52;
const BAR_PADDING = 6;
const BUBBLE_SIZE = 48;

const BottomNavComponent: React.FC<BottomNavProps> = ({ active, onChange }) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const [localActive, setLocalActive] = useState<TabKey>(active);

  const moveBubble = useCallback((tab: TabKey) => {
    const index = tabs.findIndex(t => t.key === tab);
    translateX.stopAnimation();
    Animated.spring(translateX, {
      toValue: index * ITEM_SIZE,
      useNativeDriver: true,
      friction: 6,
      tension: 180
    }).start();
  }, [translateX]);

  useEffect(() => {
    setLocalActive(active);
    moveBubble(active);
  }, [active, moveBubble]);

  return (
    <View style={styles.wrapper}>
      <LinearGradient
        colors={['rgba(28, 33, 42, 0.96)', 'rgba(18, 22, 29, 0.98)']}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.bar}
      >
        <Animated.View
          style={[
            styles.activeBubble,
            { transform: [{ translateX }] }
          ]}
        />
        {tabs.map((tab) => {
          const isActive = localActive === tab.key;
          return (
            <Pressable
              key={tab.key}
              style={[styles.item, isActive && styles.itemActive]}
              onPressIn={() => {
                if (!isActive) {
                  setLocalActive(tab.key);
                  moveBubble(tab.key);
                }
              }}
              onPress={() => {
                if (active !== tab.key) onChange(tab.key);
              }}
            >
              <Image source={tab.icon} style={[styles.icon, isActive && styles.iconActive]} />
            </Pressable>
          );
        })}
      </LinearGradient>
    </View>
  );
};

export const BottomNav = React.memo(BottomNavComponent);

const styles = StyleSheet.create({
  wrapper: { paddingHorizontal: 20, paddingBottom: 28, alignItems: 'center', backgroundColor: 'transparent' },
  bar: {
    flexDirection: 'row',
    borderRadius: 999,
    padding: BAR_PADDING,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.11)',
    elevation: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    position: 'relative',
    overflow: 'hidden',
    alignItems: 'center'
  },
  activeBubble: {
    position: 'absolute',
    left: BAR_PADDING + 2,
    top: BAR_PADDING + 2,
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    borderRadius: BUBBLE_SIZE / 2,
    backgroundColor: '#FFFFFF',
    zIndex: 0,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.86)',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 10
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
    tintColor: 'rgba(255,255,255,0.78)'
  },
  iconActive: { tintColor: '#111111' }
});
