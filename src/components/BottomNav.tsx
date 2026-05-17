import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  Animated,
  Easing,
  Image,
  ImageSourcePropType
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
const HORIZONTAL_PADDING = 20;
const GESTURE_BOTTOM_GAP = 8;

const useBottomNavPadding = () => {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 0);

  return {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingBottom: Math.max(bottomInset, GESTURE_BOTTOM_GAP)
  };
};

const BottomNavComponent: React.FC<BottomNavProps> = ({ active, onChange }) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const activePulse = useRef(new Animated.Value(0)).current;
  const tabProgress = useRef(
    tabs.reduce<Record<TabKey, Animated.Value>>((acc, tab) => {
      acc[tab.key] = new Animated.Value(tab.key === active ? 1 : 0);
      return acc;
    }, {} as Record<TabKey, Animated.Value>)
  ).current;
  const [localActive, setLocalActive] = useState<TabKey>(active);
  const wrapperPadding = useBottomNavPadding();

  const moveBubble = useCallback((tab: TabKey) => {
    const index = tabs.findIndex(t => t.key === tab);
    translateX.stopAnimation();
    activePulse.stopAnimation();
    activePulse.setValue(0);

    Animated.parallel([
      Animated.spring(translateX, {
        toValue: index * ITEM_SIZE,
        useNativeDriver: true,
        friction: 7,
        tension: 190
      }),
      Animated.sequence([
        Animated.timing(activePulse, {
          toValue: 1,
          duration: 170,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true
        }),
        Animated.timing(activePulse, {
          toValue: 0,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true
        })
      ])
    ]).start();
  }, [activePulse, translateX]);

  useEffect(() => {
    setLocalActive(active);
    moveBubble(active);
    tabs.forEach((tab) => {
      Animated.timing(tabProgress[tab.key], {
        toValue: tab.key === active ? 1 : 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }).start();
    });
  }, [active, moveBubble, tabProgress]);

  const bubbleScaleX = activePulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.16]
  });
  const bubbleScaleY = activePulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.94]
  });
  const glowOpacity = activePulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.16, 0.36]
  });
  const glowScale = activePulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.24]
  });

  return (
    <View style={[styles.wrapper, wrapperPadding]}>
      <LinearGradient
        colors={['rgba(28, 33, 42, 0.96)', 'rgba(18, 22, 29, 0.98)']}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.bar}
      >
        <Animated.View
          style={[
            styles.activeGlow,
            {
              opacity: glowOpacity,
              transform: [
                { translateX },
                { scale: glowScale }
              ]
            }
          ]}
        />
        <Animated.View
          style={[
            styles.activeBubble,
            {
              transform: [
                { translateX },
                { scaleX: bubbleScaleX },
                { scaleY: bubbleScaleY }
              ]
            }
          ]}
        />
        {tabs.map((tab) => {
          const isActive = localActive === tab.key;
          const progress = tabProgress[tab.key];
          const iconScale = progress.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 1.08]
          });
          const iconOpacity = progress.interpolate({
            inputRange: [0, 1],
            outputRange: [0.78, 1]
          });
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
              <Animated.Image
                source={tab.icon}
                style={[
                  styles.icon,
                  isActive && styles.iconActive,
                  {
                    opacity: iconOpacity,
                    transform: [{ scale: iconScale }]
                  }
                ]}
              />
            </Pressable>
          );
        })}
      </LinearGradient>
    </View>
  );
};

export const BottomNav = React.memo(BottomNavComponent);

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    backgroundColor: 'transparent'
  },
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
  activeGlow: {
    position: 'absolute',
    left: BAR_PADDING,
    top: BAR_PADDING,
    width: BUBBLE_SIZE + 4,
    height: BUBBLE_SIZE + 4,
    borderRadius: (BUBBLE_SIZE + 4) / 2,
    backgroundColor: 'rgba(167,242,119,0.42)',
    zIndex: 0,
    shadowColor: '#A7F277',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.42,
    shadowRadius: 16
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
