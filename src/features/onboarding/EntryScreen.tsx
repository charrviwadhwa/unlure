import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

type EntryScreenProps = {
  onAnimationComplete: () => void;
};

const FONT_SCRIPT = Platform.select({
  ios: 'PlaywriteDESAS-Light',
  android: 'PlaywriteDESAS-Light',
  default: 'System',
});
const FONT_REG = Platform.select({
  ios: 'Geist-Regular',
  android: 'Geist-Regular',
  default: 'System',
});
const FONT_SEMI = Platform.select({
  ios: 'Geist-SemiBold',
  android: 'Geist-SemiBold',
  default: 'System',
});
const FONT_MONO = Platform.select({
  ios: 'GeistMono-Regular',
  android: 'GeistMono-Regular',
  default: 'monospace',
});

const ArrowUpRightIcon = ({ color }: { color: string }) => (
  <Svg width={28} height={28} viewBox="0 0 24 24">
    <Path
      d="M7 17L17 7M10 7h7v7"
      stroke={color}
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </Svg>
);

const EntryScreen: React.FC<EntryScreenProps> = ({ onAnimationComplete }) => {
  const [pressed, setPressed] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const pulse = useRef(new Animated.Value(1)).current;
  const buttonReveal = useRef(new Animated.Value(0)).current;
  const buttonRevealScale = buttonReveal.interpolate({
    inputRange: [0, 1],
    outputRange: [0.01, 2.5],
  });

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.15,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [pulse]);

  const startReveal = () => {
    if (isRevealing) {
      return;
    }

    setIsRevealing(true);
    setPressed(true);
    pulse.stopAnimation();
    buttonReveal.setValue(0);

    Animated.timing(buttonReveal, {
      toValue: 1,
      duration: 850,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        onAnimationComplete();
      }
    });
  };

  return (
    <View style={styles.fullScreen}>
      <StatusBar barStyle="light-content" backgroundColor="#070a10" />
      <SafeAreaView style={styles.safe}>
        <View style={styles.root}>
        <View style={styles.gridLayer}>
          {Array.from({ length: 13 }).map((_, index) => (
            <View
              key={`grid-slant-${index}`}
              style={[styles.gridLineSlant, { left: -180 + index * 58 }]}
            />
          ))}
          {Array.from({ length: 10 }).map((_, index) => (
            <View
              key={`grid-slant-soft-${index}`}
              style={[styles.gridLineSoftSlant, { left: -120 + index * 70 }]}
            />
          ))}
        </View>

        <View pointerEvents="none" style={styles.screenDoodles}>
          <Image
            source={require('../../assets/app-icons/fire.png')}
            style={[styles.doodleImage, styles.doodleFireTop]}
          />
          <Image
            source={require('../../assets/app-icons/phone.png')}
            style={[styles.doodleImage, styles.doodlePhoneTop]}
          />
          <Image
            source={require('../../assets/app-icons/image.png')}
            style={[styles.doodleImage, styles.doodleImageMid]}
          />
          <Image
            source={require('../../assets/app-icons/bar.png')}
            style={[styles.doodleImage, styles.doodleBarBottom]}
          />
        </View>

        <View style={styles.heroWrap}>
          <View style={styles.glowCircle} />
          <Image
            source={require('../../assets/share-paper-plane.png')}
            resizeMode="contain"
            style={styles.heroImage}
          />
        </View>

        <View style={styles.copyWrap}>
          <Text style={styles.brand}>unlure</Text>
          <Text style={styles.titleLine}>Digital Focus</Text>
          <View style={styles.titleRow}>
            <Text style={styles.titleLine}>Made for </Text>
            <View style={styles.arrowChip}>
              <Text style={styles.arrowChipText}>{'->'}</Text>
            </View>
          </View>
          <Text style={styles.titleLine}>Daily Users</Text>
          <Text style={styles.sub}>Set limits, reduce noise, and reclaim your attention.</Text>
        </View>

        <View style={styles.bottomRow}>
          <View style={styles.startWrap}>
            <Text style={styles.startText}>Let's Start</Text>
            <TouchableOpacity
              activeOpacity={1}
              onPressIn={() => setPressed(true)}
              onPressOut={() => {
                if (!isRevealing) {
                  setPressed(false);
                }
              }}
              onPress={startReveal}
              disabled={isRevealing}
            >
              <Animated.View
                style={[
                  styles.startBtn,
                  pressed ? styles.startBtnPressed : null,
                  { transform: [{ scale: isRevealing ? 1 : pulse }] },
                ]}
              >
                <Animated.View
                  style={[
                    styles.buttonRevealFill,
                    {
                      transform: [
                        { translateX: 16 },
                        { translateY: 16 },
                        { scale: buttonRevealScale },
                      ],
                    },
                  ]}
                />
                <View style={styles.startIcon}>
                  <ArrowUpRightIcon color={isRevealing ? '#071006' : '#b0f47e'} />
                </View>
              </Animated.View>
            </TouchableOpacity>
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
    backgroundColor: '#070a10',
  },
  safe: { flex: 1, backgroundColor: '#070a10' },
  root: {
    flex: 1,
    backgroundColor: '#070a10',
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 12,
  },
  gridLayer: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.82,
  },
  gridLineSlant: {
    position: 'absolute',
    top: -180,
    width: 1,
    height: 1080,
    backgroundColor: 'rgba(176,244,126,0.11)',
    transform: [{ rotate: '-15deg' }],
  },
  gridLineSoftSlant: {
    position: 'absolute',
    top: -210,
    width: 1,
    height: 1120,
    backgroundColor: 'rgba(215,223,236,0.055)',
    transform: [{ rotate: '15deg' }],
  },
  screenDoodles: {
    ...StyleSheet.absoluteFillObject,
  },
  doodleImage: {
    position: 'absolute',
    resizeMode: 'contain',
    opacity: 0.68,
    tintColor: '#b0f47e',
  },
  doodleFireTop: {
    width: 34,
    height: 34,
    top: 168,
    left: 20,
    transform: [{ rotate: '-12deg' }],
  },
  doodlePhoneTop: {
    width: 38,
    height: 38,
    top: 104,
    right: 20,
    transform: [{ rotate: '12deg' }],
  },
  doodleImageMid: {
    width: 48,
    height: 48,
    bottom: 124,
    left: 24,
    tintColor: '#d7dfec',
    opacity: 0.64,
    transform: [{ rotate: '-10deg' }],
  },
  doodleBarBottom: {
    width: 38,
    height: 38,
    bottom: 176,
    right: 28,
    shadowColor: '#b0f47e',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
  },
  heroWrap: {
    marginTop: 24,
    height: 382,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowCircle: {
    position: 'absolute',
    width: 246,
    height: 246,
    borderRadius: 123,
    backgroundColor: 'rgba(176,244,126,0.18)',
  },
  heroImage: {
    width: '126%',
    height: '122%',
  },
  copyWrap: { marginTop: 4 },
  brand: {
    color: '#cfd4df',
    fontSize: 22,
    lineHeight: 28,
    fontFamily: FONT_SCRIPT,
    marginBottom: 6,
  },
  titleLine: {
    color: '#f0f4fb',
    fontSize: 42,
    lineHeight: 51,
    fontFamily: FONT_MONO,
    letterSpacing: 0.8,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  arrowChip: {
    marginTop: 2,
    marginLeft: 6,
    height: 38,
    minWidth: 66,
    borderRadius: 19,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#b0f47e',
  },
  arrowChipText: {
    color: '#0b1013',
    fontSize: 24,
    lineHeight: 26,
    fontFamily: FONT_MONO,
  },
  sub: {
    marginTop: 8,
    color: '#8f98aa',
    fontSize: 14,
    lineHeight: 20,
    fontFamily: FONT_MONO,
    maxWidth: 320,
  },
  bottomRow: {
    marginTop: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    minHeight: 116,
    paddingTop: 28,
    paddingBottom: 6,
  },
  startWrap: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  startText: {
    color: '#c5ccd9',
    fontSize: 17,
    lineHeight: 22,
    fontFamily: FONT_MONO,
    fontWeight: '700',
  },
  startBtn: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#b0f47e',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  startBtnPressed: {
    borderColor: '#b0f47e',
  },
  buttonRevealFill: {
    position: 'absolute',
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#b0f47e',
  },
  startIcon: {
    zIndex: 2,
  },
});

export default EntryScreen;
