import React, { useRef } from 'react';
import { Animated, Dimensions, Image, PanResponder, Platform, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import type { DimensionValue } from 'react-native';
import Svg, { Circle, Path, Polygon } from 'react-native-svg';

interface EntryScreenProps {
  onAnimationComplete: () => void;
}

const FONT_SCRIPT = Platform.select({ ios: 'PlaywriteDESAS-Light', android: 'PlaywriteDESAS-Light', default: 'System' });
const FONT_BODY = Platform.select({ ios: 'Montserrat-Light', android: 'Montserrat-Light', default: 'System' });
const FONT_BUTTON = Platform.select({ ios: 'Inter_24pt-Light', android: 'Inter_24pt-Light', default: 'System' });
const { width } = Dimensions.get('window');
const SWIPE_WIDTH = Math.min(width - 44, 344);
const KNOB_SIZE = 52;
const SWIPE_MAX = SWIPE_WIDTH - KNOB_SIZE - 8;
type Ornament = {
  top: DimensionValue;
  left?: DimensionValue;
  right?: DimensionValue;
  size: number;
  opacity: number;
  rotate?: string;
};

const STARS: Ornament[] = [
  { top: '44%', left: '13%', size: 15, opacity: 0.42, rotate: '12deg' },
  { top: '42%', right: '10%', size: 15, opacity: 0.42, rotate: '-8deg' },
  { top: '61%', left: '24%', size: 11, opacity: 0.34, rotate: '18deg' },
  { top: '66%', right: '20%', size: 12, opacity: 0.32, rotate: '-16deg' }
];
const DOTS: Ornament[] = [
  { top: '31%', left: '52%', size: 4, opacity: 0.4 },
  { top: '48%', left: '14%', size: 8, opacity: 0.58 },
  { top: '52%', right: '14%', size: 6, opacity: 0.56 },
  { top: '72%', left: '42%', size: 4, opacity: 0.34 }
];

const StarIcon = ({ size, color = '#FFFFFF', fill = color }: { size: number; color?: string; fill?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Polygon
      points="12 2 14.9 8.5 22 9.2 16.7 13.9 18.2 21 12 17.4 5.8 21 7.3 13.9 2 9.2 9.1 8.5 12 2"
      fill={fill}
      stroke={color}
      strokeWidth={1.4}
      strokeLinejoin="round"
    />
  </Svg>
);

const SparkleIcon = ({ size, color }: { size: number; color: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9L12 2z" fill="none" stroke={color} strokeWidth={2.2} strokeLinejoin="round" />
    <Circle cx={18.5} cy={17.5} r={1.7} fill={color} />
    <Circle cx={5.5} cy={18.5} r={1.2} fill={color} />
  </Svg>
);

const FireIcon = ({ size, color }: { size: number; color: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d="M13.4 2.8c.5 3.2-.8 4.9-2.2 6.4-1.2 1.3-2.4 2.5-2 4.7.6-1.1 1.5-1.9 2.7-2.5 3.4 2.2 4.6 4.8 3.2 7.1-.7 1.2-1.9 2-3.4 2-3.3 0-5.7-2.4-5.7-5.9 0-3 1.7-5.3 3.6-7.2 1.7-1.6 2.9-2.8 3.8-4.6z"
      fill={color}
    />
    <Path
      d="M15.4 7.3c2.1 1.5 3.6 3.9 3.6 6.8 0 3.9-2.8 6.9-6.9 6.9 2.8-1.1 4.4-3.2 4.4-5.7 0-1.7-.6-3.3-1.8-4.8.8-.8 1.1-1.9.7-3.2z"
      fill={color}
      opacity={0.74}
    />
  </Svg>
);

const ArrowRightIcon = ({ size, color }: { size: number; color: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M4 12h14" stroke={color} strokeWidth={3} strokeLinecap="round" />
    <Path d="M13 6l6 6-6 6" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const ChevronsRightIcon = ({ size, color }: { size: number; color: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M7 6l6 6-6 6" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M13 6l6 6-6 6" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const EntryScreen: React.FC<EntryScreenProps> = ({ onAnimationComplete }) => {
  const swipeX = useRef(new Animated.Value(0)).current;
  const swipeTextColor = swipeX.interpolate({
    inputRange: [0, SWIPE_MAX * 0.55, SWIPE_MAX],
    outputRange: ['#111111', '#7D7D84', '#D7D7DC']
  });
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderMove: (_, gesture) => {
        const nextValue = Math.max(0, Math.min(gesture.dx, SWIPE_MAX));
        swipeX.setValue(nextValue);
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > SWIPE_MAX * 0.68) {
          Animated.timing(swipeX, {
            toValue: SWIPE_MAX,
            duration: 160,
            useNativeDriver: true
          }).start(onAnimationComplete);
          return;
        }

        Animated.spring(swipeX, {
          toValue: 0,
          tension: 95,
          friction: 10,
          useNativeDriver: true
        }).start();
      }
    })
  ).current;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.screen}>
        <View style={styles.glowOne} />
        <View style={styles.glowTwo} />
        <View style={styles.lineShape} />
        <View style={styles.lineShapeTwo} />
        <View style={styles.lineShapeThree} />
        {STARS.map((star, index) => (
          <View
            key={`star-${index}`}
            style={[
              styles.star,
              {
                width: star.size,
                height: star.size,
                top: star.top,
                left: star.left,
                right: star.right,
                opacity: star.opacity,
                transform: [{ rotate: star.rotate ?? '0deg' }]
              }
            ]}
          >
            <StarIcon size={star.size} />
          </View>
        ))}
        {DOTS.map((dot, index) => (
          <View
            key={`dot-${index}`}
            style={[
              styles.dot,
              {
                top: dot.top,
                left: dot.left,
                right: dot.right,
                width: dot.size,
                height: dot.size,
                borderRadius: dot.size / 2,
                opacity: dot.opacity
              }
            ]}
          />
        ))}
        <View style={styles.heroCopy}>
          <Text style={styles.wordmark}>unlure</Text>
          <Text style={styles.headline}>Turn noisy apps into quiet choices.</Text>
          <Text style={styles.subtitle}>Set calm limits, protect your streaks, and see your screen time clearly.</Text>
          <View style={styles.promiseRow}>
            <View style={styles.promisePill}>
              <SparkleIcon size={14} color="#B9FFA6" />
              <Text style={styles.promiseText}>gentle limits</Text>
            </View>
            <View style={styles.promisePill}>
              <FireIcon size={14} color="#D1C9FF" />
              <Text style={styles.promiseText}>daily streaks</Text>
            </View>
          </View>
        </View>

        <View style={styles.illustrationWrap}>
          <Image source={require('../../assets/share-paper-plane.png')} style={styles.illustration} resizeMode="contain" />
        </View>

        <View style={styles.swipeTrack}>
          <Animated.Text style={[styles.swipeText, { color: swipeTextColor }]}>Swipe to get started</Animated.Text>
          <View style={styles.swipeEndArrow}>
            <ChevronsRightIcon size={28} color="#111111" />
          </View>
          <Animated.View
            {...panResponder.panHandlers}
            style={[styles.swipeKnob, { transform: [{ translateX: swipeX }] }]}
          >
            <ArrowRightIcon size={28} color="#111111" />
          </Animated.View>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050506'
  },
  screen: {
    flex: 1,
    backgroundColor: '#050506',
    paddingHorizontal: 28,
    paddingTop: 76,
    paddingBottom: 34,
    overflow: 'hidden'
  },
  glowOne: {
    position: 'absolute',
    top: 74,
    right: -106,
    width: 218,
    height: 218,
    borderRadius: 109,
    backgroundColor: 'rgba(134,216,238,0.08)'
  },
  glowTwo: {
    position: 'absolute',
    bottom: 126,
    left: -118,
    width: 226,
    height: 226,
    borderRadius: 113,
    backgroundColor: 'rgba(209,201,255,0.07)'
  },
  lineShape: {
    position: 'absolute',
    top: 92,
    left: -54,
    width: 210,
    height: 96,
    borderRadius: 64,
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.1)',
    transform: [{ rotate: '-14deg' }]
  },
  lineShapeTwo: {
    position: 'absolute',
    top: 292,
    right: -118,
    width: 214,
    height: 78,
    borderRadius: 54,
    borderWidth: 1,
    borderColor: 'rgba(185,255,166,0.08)',
    transform: [{ rotate: '18deg' }]
  },
  lineShapeThree: {
    position: 'absolute',
    bottom: 224,
    left: 44,
    width: 230,
    height: 76,
    borderRadius: 52,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.055)',
    transform: [{ rotate: '-24deg' }]
  },
  star: {
    position: 'absolute',
    zIndex: 1
  },
  dot: {
    position: 'absolute',
    zIndex: 1,
    backgroundColor: '#FFFFFF'
  },
  heroCopy: {
    zIndex: 2,
    maxWidth: 320
  },
  wordmark: {
    color: '#FFFFFF',
    fontSize: 52,
    lineHeight: 66,
    fontFamily: FONT_SCRIPT,
    fontWeight: '600',
    letterSpacing: 0,
    marginBottom: 10
  },
  headline: {
    maxWidth: 312,
    color: '#FFFFFF',
    fontSize: 23,
    lineHeight: 30,
    fontFamily: FONT_BODY,
    fontWeight: '800',
    marginBottom: 8
  },
  subtitle: {
    maxWidth: 302,
    color: 'rgba(255,255,255,0.68)',
    fontSize: 15,
    lineHeight: 22,
    fontFamily: FONT_BODY,
    fontWeight: '600'
  },
  promiseRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18
  },
  promisePill: {
    minHeight: 34,
    borderRadius: 17,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(255,255,255,0.065)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)'
  },
  promiseText: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    fontFamily: FONT_BODY,
    fontWeight: '700',
    includeFontPadding: false
  },
  illustrationWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 24
  },
  illustration: {
    width: '111%',
    height: '92%'
  },
  swipeTrack: {
    width: SWIPE_WIDTH,
    height: 66,
    borderRadius: 33,
    alignSelf: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden'
  },
  swipeText: {
    color: '#111111',
    fontSize: 17,
    fontFamily: FONT_BUTTON,
    fontWeight: '600',
    textAlign: 'center',
    includeFontPadding: false
  },
  swipeEndArrow: {
    position: 'absolute',
    right: 25
  },
  swipeKnob: {
    position: 'absolute',
    left: 7,
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#B9FFA6'
  }
});

export default EntryScreen;
