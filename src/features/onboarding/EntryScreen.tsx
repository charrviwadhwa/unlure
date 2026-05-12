import React, { useRef } from 'react';
import { Animated, Dimensions, PanResponder, Platform, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Path, Stop } from 'react-native-svg';
import LinearGradient from 'react-native-linear-gradient';

interface EntryScreenProps {
  onAnimationComplete: () => void;
}

const FONT_SCRIPT = Platform.select({ ios: 'PlaywriteDESAS-Light', android: 'PlaywriteDESAS-Light', default: 'System' });
const FONT_SANS = Platform.select({ ios: 'Geist-Regular', android: 'Geist-Regular', default: 'System' });
const FONT_SANS_SEMIBOLD = Platform.select({ ios: 'Geist-SemiBold', android: 'Geist-SemiBold', default: 'System' });
const FONT_MONO = Platform.select({ ios: 'GeistMono-Regular', android: 'GeistMono-Regular', default: 'monospace' });
const { width } = Dimensions.get('window');
const SWIPE_WIDTH = Math.min(width - 68, 316);
const KNOB_SIZE = 56;
const SWIPE_MAX = SWIPE_WIDTH - KNOB_SIZE - 8;

const PauseIcon = () => (
  <Svg width={28} height={28} viewBox="0 0 24 24">
    <Path d="M9 7v10M15 7v10" stroke="#A991FF" strokeWidth={2.2} strokeLinecap="round" />
  </Svg>
);

const ChartIcon = () => (
  <Svg width={28} height={28} viewBox="0 0 24 24">
    <Path d="M5 19V11M12 19V6M19 19V3" stroke="#A991FF" strokeWidth={2.2} strokeLinecap="round" />
    <Path d="M5 19h14" stroke="#6656B8" strokeWidth={1.4} strokeLinecap="round" opacity={0.5} />
  </Svg>
);

const LeafIcon = () => (
  <Svg width={28} height={28} viewBox="0 0 24 24">
    <Path d="M5 19c7.6-.5 12.8-5.7 14-14-8.7.4-14 5.6-14 14z" fill="none" stroke="#A991FF" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M5 19 14 10" stroke="#A991FF" strokeWidth={1.7} strokeLinecap="round" />
  </Svg>
);

const ArrowIcon = ({ color = '#FFFFFF' }: { color?: string }) => (
  <Svg width={26} height={26} viewBox="0 0 24 24">
    <Path d="M5 12h13M13 6l6 6-6 6" stroke={color} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const WaveArt = () => (
  <View style={styles.waveWrap} pointerEvents="none">
    <View style={styles.waveGlow} />
    <Svg width="130%" height={220} viewBox="0 0 460 220">
      <Defs>
        <SvgLinearGradient id="wave" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#4C6DFF" stopOpacity="0.05" />
          <Stop offset="0.46" stopColor="#9B8CFF" stopOpacity="0.92" />
          <Stop offset="1" stopColor="#6C7CFF" stopOpacity="0.1" />
        </SvgLinearGradient>
        <SvgLinearGradient id="dot" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#AFA4FF" stopOpacity="0.7" />
          <Stop offset="1" stopColor="#6074FF" stopOpacity="0.15" />
        </SvgLinearGradient>
      </Defs>
      {Array.from({ length: 22 }).map((_, index) => {
        const offset = index * 4.3;
        const opacity = 0.08 + index * 0.018;
        return (
          <Path
            key={index}
            d={`M-12 ${112 - offset} C 80 ${40 + offset}, 144 ${42 + offset}, 230 ${110} C 316 ${178 - offset}, 380 ${180 - offset}, 472 ${108 + offset}`}
            fill="none"
            stroke="url(#wave)"
            strokeWidth={index === 11 ? 2.2 : 1}
            opacity={Math.min(opacity, 0.55)}
          />
        );
      })}
      {Array.from({ length: 28 }).map((_, index) => (
        <Circle
          key={`dot-${index}`}
          cx={40 + ((index * 37) % 380)}
          cy={68 + ((index * 31) % 94)}
          r={index % 4 === 0 ? 1.5 : 1}
          fill="url(#dot)"
          opacity={0.32}
        />
      ))}
    </Svg>
  </View>
);

const FeatureRow = ({
  icon,
  title,
  copy
}: {
  icon: React.ReactNode;
  title: string;
  copy: string;
}) => (
  <View style={styles.featureRow}>
    <View style={styles.featureIcon}>{icon}</View>
    <View style={styles.featureTextWrap}>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureCopy}>{copy}</Text>
    </View>
  </View>
);

const EntryScreen: React.FC<EntryScreenProps> = ({ onAnimationComplete }) => {
  const swipeX = useRef(new Animated.Value(0)).current;
  const swipeTextOpacity = swipeX.interpolate({
    inputRange: [0, SWIPE_MAX * 0.55, SWIPE_MAX],
    outputRange: [1, 0.38, 0]
  });
  const fillWidth = swipeX.interpolate({
    inputRange: [0, SWIPE_MAX],
    outputRange: [KNOB_SIZE + 8, SWIPE_WIDTH]
  });
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderMove: (_, gesture) => {
        swipeX.setValue(Math.max(0, Math.min(gesture.dx, SWIPE_MAX)));
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > SWIPE_MAX * 0.68) {
          Animated.timing(swipeX, {
            toValue: SWIPE_MAX,
            duration: 170,
            useNativeDriver: false
          }).start(onAnimationComplete);
          return;
        }

        Animated.spring(swipeX, {
          toValue: 0,
          tension: 95,
          friction: 11,
          useNativeDriver: false
        }).start();
      }
    })
  ).current;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.screen}>
        <View style={styles.topGlow} />
        <View style={styles.bottomGlow} />

        <View style={styles.hero}>
          <Text style={styles.wordmark}>unlure</Text>
          <Text style={styles.tagline}>Real awareness.{'\n'}Lasting change.</Text>
        </View>

        <WaveArt />

        <View style={styles.features}>
          <FeatureRow
            icon={<PauseIcon />}
            title="Pause with purpose"
            copy="Break autopilot with mindful pauses that create clarity."
          />
          <FeatureRow
            icon={<ChartIcon />}
            title="See the full picture"
            copy="Understand your digital habits with depth and honesty."
          />
          <FeatureRow
            icon={<LeafIcon />}
            title="Design a life on purpose"
            copy="Small shifts. Consistent choices. A better you."
          />
        </View>

        <View style={styles.swipeTrack}>
          <Animated.View style={[styles.swipeFill, { width: fillWidth }]} />
          <Animated.Text style={[styles.swipeText, { opacity: swipeTextOpacity }]}>Swipe to continue</Animated.Text>
          <Animated.View
            {...panResponder.panHandlers}
            style={[styles.swipeKnob, { transform: [{ translateX: swipeX }] }]}
          >
            <ArrowIcon />
          </Animated.View>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070A10'
  },
  screen: {
    flex: 1,
    backgroundColor: '#070A10',
    paddingHorizontal: 34,
    paddingTop: 84,
    paddingBottom: 34,
    overflow: 'hidden'
  },
  topGlow: {
    position: 'absolute',
    top: -90,
    left: -70,
    right: -70,
    height: 260,
    backgroundColor: 'rgba(73, 104, 255, 0.075)',
    borderBottomLeftRadius: 180,
    borderBottomRightRadius: 180
  },
  bottomGlow: {
    position: 'absolute',
    bottom: -120,
    left: -60,
    right: -60,
    height: 260,
    backgroundColor: 'rgba(132, 109, 255, 0.07)',
    borderTopLeftRadius: 180,
    borderTopRightRadius: 180
  },
  hero: {
    alignItems: 'center',
    zIndex: 2
  },
  wordmark: {
    color: '#DAD0FF',
    fontSize: 54,
    lineHeight: 66,
    fontFamily: FONT_SCRIPT,
    fontWeight: '600',
    letterSpacing: 0
  },
  tagline: {
    marginTop: 8,
    color: 'rgba(226, 229, 242, 0.68)',
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
    fontFamily: FONT_SANS,
    fontWeight: '500'
  },
  waveWrap: {
    height: 234,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: -90,
    marginTop: 24,
    marginBottom: 10
  },
  waveGlow: {
    position: 'absolute',
    width: 190,
    height: 90,
    borderRadius: 95,
    backgroundColor: 'rgba(145, 125, 255, 0.2)'
  },
  features: {
    gap: 24,
    marginTop: 2,
    marginBottom: 28
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  featureIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14
  },
  featureTextWrap: {
    flex: 1,
    minWidth: 0
  },
  featureTitle: {
    color: '#F2F3FA',
    fontSize: 14,
    lineHeight: 18,
    fontFamily: FONT_SANS_SEMIBOLD,
    fontWeight: '600'
  },
  featureCopy: {
    marginTop: 3,
    color: 'rgba(226, 229, 242, 0.58)',
    fontSize: 12,
    lineHeight: 17,
    fontFamily: FONT_SANS,
    fontWeight: '500'
  },
  swipeTrack: {
    width: SWIPE_WIDTH,
    height: 66,
    borderRadius: 33,
    alignSelf: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden'
  },
  swipeFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 33,
    backgroundColor: '#7E6AF2'
  },
  swipeText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: FONT_SANS_SEMIBOLD,
    fontWeight: '600',
    textAlign: 'center',
    includeFontPadding: false
  },
  swipeKnob: {
    position: 'absolute',
    left: 4,
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: KNOB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6F5DE5',
    shadowColor: '#7E6AF2',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8
  }
});

export default EntryScreen;
