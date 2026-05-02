import React, { useRef } from 'react';
import { Animated, Dimensions, Image, PanResponder, Platform, SafeAreaView, StyleSheet, Text, View } from 'react-native';

interface EntryScreenProps {
  onAnimationComplete: () => void;
}

const { width } = Dimensions.get('window');
const SWIPE_WIDTH = Math.min(width - 48, 344);
const KNOB_SIZE = 52;
const SWIPE_MAX = SWIPE_WIDTH - KNOB_SIZE - 8;

const FONT_SCRIPT = Platform.select({ ios: 'PlaywriteDESAS-Light', android: 'PlaywriteDESAS-Light', default: 'System' });
const FONT_BODY = Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' });
const FONT_BUTTON = Platform.select({ ios: 'System', android: 'sans-serif-medium', default: 'System' });

const EntryScreen: React.FC<EntryScreenProps> = ({ onAnimationComplete }) => {
  const swipeX = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 4,
      onPanResponderMove: (_, gesture) => {
        const next = Math.max(0, Math.min(gesture.dx, SWIPE_MAX));
        swipeX.setValue(next);
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > SWIPE_MAX * 0.68) {
          Animated.timing(swipeX, {
            toValue: SWIPE_MAX,
            duration: 120,
            useNativeDriver: true
          }).start(onAnimationComplete);
          return;
        }

        Animated.spring(swipeX, {
          toValue: 0,
          useNativeDriver: true,
          friction: 9,
          tension: 140
        }).start();
      }
    })
  ).current;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.screen}>
        <Image source={require('../../assets/image.png')} style={styles.fullImage} resizeMode="cover" />

        <View style={styles.bottomContent}>
          <Text style={styles.wordmark}>Unlure</Text>
          <Text style={styles.description}>
            Turn distractions off, set calm limits, and keep your screen time honest.
          </Text>

          <View style={styles.swipeTrack}>
            <Text style={styles.swipeText}>Swipe to get started</Text>
            <Text style={styles.swipeEndArrow}>{'>>'}</Text>
            <Animated.View
              {...panResponder.panHandlers}
              style={[styles.swipeKnob, { transform: [{ translateX: swipeX }] }]}
            >
              <View style={styles.knobArrow}>
                <View style={styles.knobArrowLine} />
                <View style={styles.knobArrowHeadTop} />
                <View style={styles.knobArrowHeadBottom} />
              </View>
            </Animated.View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5C9D8'
  },
  screen: {
    flex: 1,
    backgroundColor: '#F5C9D8',
    overflow: 'hidden'
  },
  fullImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    width: '100%',
    height: '70%'
  },
  bottomContent: {
    position: 'absolute',
    left: 26,
    right: 26,
    bottom: 24,
    alignItems: 'flex-start',
    zIndex: 2
  },
  wordmark: {
    color: '#111111',
    fontSize: 48,
    lineHeight: 62,
    fontWeight: '400',
    fontFamily: FONT_SCRIPT,
    textAlign: 'left',
    letterSpacing: 0,
    marginBottom: 8,
    includeFontPadding: false
  },
  description: {
    maxWidth: 306,
    color: '#303236',
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '600',
    fontFamily: FONT_BODY,
    textAlign: 'left',
    marginBottom: 28,
    includeFontPadding: false
  },
  swipeTrack: {
    width: SWIPE_WIDTH,
    height: 66,
    borderRadius: 33,
    justifyContent: 'center',
    backgroundColor: '#111111',
    overflow: 'hidden'
  },
  swipeText: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: 17,
    fontWeight: '500',
    fontFamily: FONT_BUTTON,
    textAlign: 'center',
    includeFontPadding: false
  },
  swipeEndArrow: {
    position: 'absolute',
    right: 25,
    color: '#FFFFFF',
    fontSize: 26,
    lineHeight: 28,
    fontWeight: '900',
    fontFamily: FONT_BUTTON
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
  },
  knobArrow: {
    width: 24,
    height: 18,
    justifyContent: 'center'
  },
  knobArrowLine: {
    width: 22,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#111111'
  },
  knobArrowHeadTop: {
    position: 'absolute',
    right: 0,
    top: 4,
    width: 11,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#111111',
    transform: [{ rotate: '42deg' }]
  },
  knobArrowHeadBottom: {
    position: 'absolute',
    right: 0,
    bottom: 4,
    width: 11,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#111111',
    transform: [{ rotate: '-42deg' }]
  }
});

export default EntryScreen;
