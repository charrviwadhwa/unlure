import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  PanResponder,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  FeGaussianBlur,
  Filter,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

type EntryScreenProps = {
  onAnimationComplete: () => void;
};

const FONT_SCRIPT = Platform.select({
  ios: 'PlaywriteDESAS-Light',
  android: 'PlaywriteDESAS-Light',
  default: 'System',
});

const FONT_REGULAR = Platform.select({
  ios: 'Geist-Regular',
  android: 'Geist-Regular',
  default: 'System',
});

const FONT_SEMIBOLD = Platform.select({
  ios: 'Geist-SemiBold',
  android: 'Geist-SemiBold',
  default: 'System',
});

const FONT_MONO = Platform.select({
  ios: 'GeistMono-Regular',
  android: 'GeistMono-Regular',
  default: 'monospace',
});

const DoubleChevronIcon = ({ color }: { color: string }) => (
  <Svg width={30} height={30} viewBox="0 0 24 24">
    <Path
      d="m7 6 6 6-6 6M12 6l6 6-6 6"
      stroke={color}
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </Svg>
);

const FeatureIcon = ({ type }: { type: 'shield' | 'lock' | 'leaf' }) => {
  if (type === 'lock') {
    return (
      <Svg width={30} height={30} viewBox="0 0 24 24">
        <Rect
          x={5}
          y={10}
          width={14}
          height={10}
          rx={2.3}
          fill="none"
          stroke="#a7f277"
          strokeWidth={1.8}
        />
        <Path
          d="M8 10V7.6C8 5.1 9.7 3.5 12 3.5s4 1.6 4 4.1V10"
          fill="none"
          stroke="#a7f277"
          strokeWidth={1.8}
          strokeLinecap="round"
        />
        <Path
          d="M12 14v2.3"
          stroke="#a7f277"
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      </Svg>
    );
  }

  if (type === 'leaf') {
    return (
      <Svg width={30} height={30} viewBox="0 0 24 24">
        <Path
          d="M19.4 4.4C12.6 5.4 6.2 9 6.2 15.2c0 3 2.1 5 5 5 6.2 0 8.2-8.7 8.2-15.8z"
          fill="none"
          stroke="#a7f277"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M12.1 13.1c-1.6 1.5-2.7 3.6-3.1 6.1"
          fill="none"
          stroke="#a7f277"
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      </Svg>
    );
  }

  return (
    <Svg width={30} height={30} viewBox="0 0 24 24">
      <Path
        d="M12 3.2 19 6v5.1c0 4.4-2.7 7.8-7 9.7-4.3-1.9-7-5.3-7-9.7V6l7-2.8z"
        fill="none"
        stroke="#a7f277"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
};

const CalendarDoodleIcon = () => (
  <Svg width={44} height={44} viewBox="0 0 44 44">
    <Rect x={7} y={10} width={30} height={27} rx={2.6} fill="none" stroke="#d7dfec" strokeWidth={1.9} />
    <Path d="M7 17h30M14 6v7M30 6v7" stroke="#d7dfec" strokeWidth={1.9} strokeLinecap="round" />
    <Rect x={13} y={22} width={5} height={4.8} fill="none" stroke="#d7dfec" strokeWidth={1.5} />
    <Rect x={22} y={22} width={5} height={4.8} fill="none" stroke="#d7dfec" strokeWidth={1.5} />
    <Rect x={31} y={22} width={5} height={4.8} fill="none" stroke="#d7dfec" strokeWidth={1.5} />
    <Rect x={13} y={30} width={5} height={4.8} fill="none" stroke="#d7dfec" strokeWidth={1.5} />
    <Rect x={22} y={30} width={5} height={4.8} fill="none" stroke="#d7dfec" strokeWidth={1.5} />
  </Svg>
);

const DustOrb = () => (
  <Svg width={420} height={420} style={styles.dustOrb}>
    <Defs>
      <RadialGradient id="dustOrbGradient" cx="50%" cy="50%" r="50%">
        <Stop offset="0%" stopColor="#2C3C20" stopOpacity={0.82} />
        <Stop offset="58%" stopColor="#2C3C20" stopOpacity={0.68} />
        <Stop offset="84%" stopColor="#2C3C20" stopOpacity={0.42} />
        <Stop offset="100%" stopColor="#2C3C20" stopOpacity={0} />
      </RadialGradient>

      <RadialGradient id="dustOrbEdgeGlow" cx="50%" cy="50%" r="50%">
        <Stop offset="0%" stopColor="#a7f277" stopOpacity={0} />
        <Stop offset="68%" stopColor="#a7f277" stopOpacity={0} />
        <Stop offset="88%" stopColor="#a7f277" stopOpacity={0.08} />
        <Stop offset="100%" stopColor="#a7f277" stopOpacity={0} />
      </RadialGradient>

      <Filter id="dustOrbBlur">
        <FeGaussianBlur stdDeviation="28" />
      </Filter>

      <Filter id="dustOrbSoftBlur">
        <FeGaussianBlur stdDeviation="48" />
      </Filter>
    </Defs>

    <Circle
      cx={210}
      cy={218}
      r={122}
      fill="url(#dustOrbGradient)"
    />
    <Circle
      cx={210}
      cy={218}
      r={146}
      fill="url(#dustOrbEdgeGlow)"
      filter="url(#dustOrbBlur)"
    />
    <Circle
      cx={176}
      cy={184}
      r={78}
      fill="#2C3C20"
      opacity={0.26}
      filter="url(#dustOrbSoftBlur)"
    />
    <Circle
      cx={250}
      cy={252}
      r={92}
      fill="#2C3C20"
      opacity={0.2}
      filter="url(#dustOrbSoftBlur)"
    />
  </Svg>
);

const EntryScreen: React.FC<EntryScreenProps> = ({
  onAnimationComplete,
}) => {
  const { width, height } = useWindowDimensions();
  const isCompactHeight = height < 860;
  const isVeryCompactHeight = height < 780;
  const isNarrow = width < 390;
  const contentScale = Math.min(1, Math.max(0.84, width / 430, height / 920));
  const heroHeight = Math.round(
    Math.min(height * 0.43, Math.max(300, width * (isCompactHeight ? 0.9 : 0.96)))
  );
  const heroImageWidth = Math.round(Math.min(500, width * (isNarrow ? 1.2 : 1.25)));
  const heroImageHeight = Math.round(heroImageWidth * 0.81);
  const titleSize = Math.round((isNarrow ? 41 : 44) * contentScale);
  const titleLineHeight = Math.round(titleSize * 1.12);
  const subSize = isNarrow || isCompactHeight ? 13 : 14;
  const subLineHeight = isNarrow || isCompactHeight ? 21 : 23;
  const rootPaddingTop = isVeryCompactHeight ? 14 : isCompactHeight ? 20 : 28;
  const rootPaddingHorizontal = isNarrow ? 22 : 28;
  const rootPaddingBottom = isVeryCompactHeight ? 16 : 24;
  const androidNavReserve = Platform.OS === 'android'
    ? isVeryCompactHeight ? 58 : isCompactHeight ? 54 : 48
    : 0;
  const copyLift = isCompactHeight ? -16 : -10;
  const ctaHeight = isNarrow || isCompactHeight ? 52 : 58;
  const thumbSize = isNarrow || isCompactHeight ? 44 : 48;
  const featureTop = isVeryCompactHeight ? 10 : isCompactHeight ? 14 : 18;
  const featureTextSize = isNarrow || isCompactHeight ? 11 : 12;
  const featureIconScale = isNarrow || isCompactHeight ? 0.8 : 0.9;
  const featureGap = isNarrow || isCompactHeight ? 4 : 6;
  const featureDividerMargin = isNarrow ? 7 : 10;
  const [ctaWidth, setCtaWidth] = useState(0);
  const swipeX = useRef(new Animated.Value(0)).current;
  const successProgress = useRef(new Animated.Value(0)).current;
  const hasCompletedSwipe = useRef(false);
  
  // CTA dimensions updated for the new styling
  const ctaHorizontalInset = 8;
  const maxSwipe = Math.max(ctaWidth - thumbSize - ctaHorizontalInset * 2, 0);
  const safeMaxSwipe = Math.max(maxSwipe, 1);
  
  const ctaLabelOpacity = swipeX.interpolate({
    inputRange: [0, safeMaxSwipe * 0.7],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  
  const welcomeOpacity = successProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  // Updated handling to fade out at the very end of success
  const handleOpacity = successProgress.interpolate({
    inputRange: [0, 0.8, 1],
    outputRange: [1, 1, 0],
    extrapolate: 'clamp',
  });

  // Updated to expand exponentially on success (The "pop")
  const handleScale = successProgress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1.2, 4],
    extrapolate: 'clamp',
  });

  // Green Fill grows from 0 to 1
  const ctaFillScale = swipeX.interpolate({
    inputRange: [0, safeMaxSwipe],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  // Translate to ensure it grows from the left side of the track
  const ctaFillTranslateX = swipeX.interpolate({
    inputRange: [0, safeMaxSwipe],
    outputRange: [-(Math.max(ctaWidth, 1) / 2), 0],
    extrapolate: 'clamp',
  });

  const completeSwipe = useCallback(() => {
    if (hasCompletedSwipe.current) return;
    hasCompletedSwipe.current = true;
    Animated.parallel([
      Animated.spring(swipeX, {
        toValue: maxSwipe,
        useNativeDriver: true,
        tension: 60,
        friction: 10,
      }),
      Animated.timing(successProgress, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) onAnimationComplete();
    });
  }, [maxSwipe, onAnimationComplete, successProgress, swipeX]);

  const resetSwipe = useCallback(() => {
    Animated.spring(swipeX, {
      toValue: 0,
      useNativeDriver: true,
      tension: 60,
      friction: 10,
    }).start();
  }, [swipeX]);

  const panResponder = useMemo(
    () => PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 6 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderGrant: () => {
        swipeX.stopAnimation();
      },
      onPanResponderMove: (_, gesture) => {
        const nextX = Math.min(Math.max(gesture.dx, 0), maxSwipe);
        swipeX.setValue(nextX);
      },
      onPanResponderRelease: (_, gesture) => {
        const shouldComplete = gesture.dx > maxSwipe * 0.8 || gesture.vx > 1.2;
        if (shouldComplete) {
          completeSwipe();
        } else {
          resetSwipe();
        }
      },
      onPanResponderTerminate: resetSwipe,
    }),
    [completeSwipe, maxSwipe, resetSwipe, swipeX]
  );

  return (
    <View style={styles.fullScreen}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />

      <SafeAreaView style={styles.safe}>
        <View
          style={[
            styles.root,
            {
              paddingTop: rootPaddingTop,
              paddingHorizontal: rootPaddingHorizontal,
              paddingBottom: rootPaddingBottom,
            },
          ]}
        >
          <View style={styles.vignette} />

          <View style={styles.gridLayer}>
            {Array.from({ length: 9 }).map((_, index) => (
              <View
                key={`grid-horizontal-${index}`}
                style={[
                  styles.gridHorizontalLine,
                  {
                    top: 36 + index * 92,
                  },
                ]}
              />
            ))}
            {Array.from({ length: 6 }).map((_, index) => (
              <View
                key={`grid-vertical-${index}`}
                style={[
                  styles.gridVerticalLine,
                  {
                    left: 20 + index * 86,
                  },
                ]}
              />
            ))}
            {Array.from({ length: 12 }).map((_, index) => (
              <View
                key={`grid-diagonal-${index}`}
                style={[
                  styles.gridLine,
                  {
                    left: -160 + index * 58,
                  },
                ]}
              />
            ))}
          </View>

          <View pointerEvents="none" style={styles.screenDoodles}>
            <Image
              source={require('../../assets/app-icons/fire.png')}
              style={[
                styles.doodleImage,
                styles.fireDoodle,
                { top: heroHeight * 0.43, left: rootPaddingHorizontal - 2 },
              ]}
              resizeMode="contain"
            />
            <Image
              source={require('../../assets/app-icons/phone.png')}
              style={[
                styles.doodleImage,
                styles.phoneDoodle,
                { top: heroHeight * 0.22, right: rootPaddingHorizontal + 4 },
              ]}
              resizeMode="contain"
            />
            <View
              style={[
                styles.calendarDoodle,
                { top: heroHeight * 0.72, left: rootPaddingHorizontal + 20 },
              ]}
            >
              <CalendarDoodleIcon />
            </View>
            <Image
              source={require('../../assets/app-icons/bar.png')}
              style={[
                styles.doodleImage,
                styles.barDoodle,
                { top: heroHeight * 0.8, right: rootPaddingHorizontal + 26 },
              ]}
              resizeMode="contain"
            />
          </View>

          <View style={[styles.heroWrap, { height: heroHeight }]}>
            <DustOrb />
            <View style={styles.heroMask}>
              <Image
                source={require('../../assets/share-paper-plane.png')}
                resizeMode="contain"
                style={[
                  styles.heroImage,
                  { width: heroImageWidth, height: heroImageHeight },
                ]}
              />
            </View>
          </View>

          <View style={[styles.copyWrap, { marginTop: copyLift }]}>
            <Text style={styles.brand}>unlure</Text>

            <Text style={[styles.title, { fontSize: titleSize, lineHeight: titleLineHeight }]}>Digital Focus</Text>
            <Text style={[styles.title, { fontSize: titleSize, lineHeight: titleLineHeight }]}>Made for</Text>

            <Text style={[styles.title, styles.titleAccent, { fontSize: titleSize, lineHeight: titleLineHeight }]}>
              Daily Users
            </Text>

            <Text style={[styles.sub, { fontSize: subSize, lineHeight: subLineHeight }]}>
              Set limits, reduce noise,{'\n'}
              and reclaim your attention.
            </Text>
          </View>

          <View style={[styles.bottomSection, { paddingBottom: androidNavReserve }]}>
            {/* --- UPDATED CTA SECTION --- */}
            <View
              style={[
                styles.startBtn,
                {
                  height: ctaHeight,
                  borderRadius: ctaHeight / 2,
                },
              ]}
              onLayout={(event) => setCtaWidth(event.nativeEvent.layout.width)}
              {...panResponder.panHandlers}
            >
              {/* Green Fill Background */}
              <Animated.View
                style={[
                  styles.startSwipeFill,
                  {
                    transform: [
                      { translateX: ctaFillTranslateX },
                      { scaleX: ctaFillScale },
                    ],
                  },
                ]}
              />

              {/* Text Layers */}
              <Animated.Text style={[styles.startText, { opacity: ctaLabelOpacity }]}>
                Swipe to get started
              </Animated.Text>
              <Animated.Text style={[styles.welcomeText, { opacity: welcomeOpacity }]}>
                Welcome!!
              </Animated.Text>

              {/* Animated White Handle */}
              <Animated.View
                style={[
                  styles.startIcon,
                  {
                    width: thumbSize,
                    height: thumbSize,
                    borderRadius: thumbSize / 2,
                    opacity: handleOpacity,
                    transform: [
                      { translateX: swipeX },
                      { scale: handleScale },
                    ],
                  },
                ]}
              >
                <DoubleChevronIcon color="#050806" />
              </Animated.View>
            </View>
            {/* --- END OF CTA SECTION --- */}

            <View style={[styles.featureRow, { marginTop: featureTop }]}>
              <View style={styles.featureItem}>
                <View style={{ transform: [{ scale: featureIconScale }] }}>
                  <FeatureIcon type="shield" />
                </View>

                <View style={[styles.featureTextWrap, { marginLeft: featureGap }]}>
                  <Text style={[styles.featureTitle, { fontSize: featureTextSize }]}>Private</Text>
                  <Text style={[styles.featureSub, { fontSize: featureTextSize }]}>by design</Text>
                </View>
              </View>

              <View style={[styles.featureDivider, { marginHorizontal: featureDividerMargin }]} />

              <View style={styles.featureItem}>
                <View style={{ transform: [{ scale: featureIconScale }] }}>
                  <FeatureIcon type="lock" />
                </View>

                <View style={[styles.featureTextWrap, { marginLeft: featureGap }]}>
                  <Text style={[styles.featureTitle, { fontSize: featureTextSize }]}>No Tracking</Text>
                  <Text style={[styles.featureSub, { fontSize: featureTextSize }]}>no analytics</Text>
                </View>
              </View>

              <View style={[styles.featureDivider, { marginHorizontal: featureDividerMargin }]} />

              <View style={styles.featureItem}>
                <View style={{ transform: [{ scale: featureIconScale }] }}>
                  <FeatureIcon type="leaf" />
                </View>

                <View style={[styles.featureTextWrap, { marginLeft: featureGap }]}>
                  <Text style={[styles.featureTitle, { fontSize: featureTextSize }]}>Lightweight</Text>
                  <Text style={[styles.featureSub, { fontSize: featureTextSize }]}>built for focus</Text>
                </View>
              </View>
            </View>

          </View>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    backgroundColor: '#02070b',
  },

  safe: {
    flex: 1,
    backgroundColor: '#02070b',
  },

  root: {
    flex: 1,
    paddingHorizontal: 30,
    paddingTop: 4,
    paddingBottom: 40,
    justifyContent: 'space-between',
    backgroundColor: '#02070b',
  },

  vignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.14)',
  },

  gridLayer: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.72,
  },

  gridHorizontalLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(167,242,119,0.025)',
  },

  gridVerticalLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(167,242,119,0.023)',
  },

  gridLine: {
    position: 'absolute',
    top: -160,
    width: 1,
    height: 1200,
    backgroundColor: 'rgba(167,242,119,0.06)',
    transform: [{ rotate: '-15deg' }],
  },

  screenDoodles: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },

  doodleImage: {
    position: 'absolute',
    tintColor: '#a7f277',
    opacity: 0.9,
  },

  fireDoodle: {
    width: 44,
    height: 44,
    top: 176,
    left: 28,
  },

  phoneDoodle: {
    width: 44,
    height: 44,
    top: 96,
    right: 34,
  },

  calendarDoodle: {
    position: 'absolute',
    top: 304,
    left: 52,
    opacity: 0.9,
    transform: [{ rotate: '-9deg' }],
  },

  barDoodle: {
    width: 50,
    height: 50,
    top: 340,
    right: 56,
  },

  heroWrap: {
    height: 370,
    marginTop: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },

  dustOrb: {
    position: 'absolute',
    transform: [{ translateY: -22 }],
  },

  heroMask: {
    overflow: 'hidden',
    borderRadius: 40,
  },

  heroImage: {
    width: 520,
    height: 420,
  },

  copyWrap: {
    marginTop: -24,
    zIndex: 3,
  },

  brand: {
    color: '#d6dbe5',
    fontSize: 22,
    fontFamily: FONT_SCRIPT,
    marginBottom: 10,
  },

  title: {
    color: '#ffffff',
    fontSize: 48,
    lineHeight: 53,
    letterSpacing: -0.7,
    fontFamily: FONT_SEMIBOLD,
  },

  titleAccent: {
    color: '#a7f277',
  },

  sub: {
    marginTop: 18,
    color: '#929aa5',
    fontSize: 15,
    lineHeight: 24,
    fontFamily: FONT_MONO,
  },

  bottomSection: {
    marginTop: 8,
    paddingBottom: 0,
  },

  // --- UPDATED CTA STYLES --- 
  startBtn: {
    width: '100%',
    height: 64, 
    borderRadius: 32,
    backgroundColor: '#111111', 
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    // 1. CHANGE THIS: Update shadow color to match your app's green
    shadowColor: '#a7f277', 
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },

  startSwipeFill: {
    position: 'absolute',
    left: 0,
    width: '100%',
    height: '100%',
    // 2. CHANGE THIS: Update background fill to your app's green
    backgroundColor: '#a7f277', 
    borderRadius: 32,
  },

  startIcon: {
    position: 'absolute',
    left: 8,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },

  startText: {
    color: '#929aa5',
    fontSize: 14,
    fontFamily: FONT_SEMIBOLD,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    zIndex: 5,
  },

  welcomeText: {
    position: 'absolute',
    color: '#000000',
    fontSize: 18,
    fontFamily: FONT_SEMIBOLD,
    fontWeight: '800',
    zIndex: 6,
  },
  // --- END CTA STYLES ---

  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 28,
    zIndex: 3,
  },

  featureItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },

  featureTextWrap: {
    marginLeft: 8,
  },

  featureTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontFamily: FONT_SEMIBOLD,
  },

  featureSub: {
    color: '#8f97a3',
    fontSize: 13,
    marginTop: 2,
    fontFamily: FONT_REGULAR,
  },

  featureDivider: {
    width: 1,
    height: 34,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginHorizontal: 10,
  },

});

export default EntryScreen;
