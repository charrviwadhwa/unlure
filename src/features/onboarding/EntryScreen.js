import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withDelay, 
  withSequence,
  Easing,
  runOnJS
} from 'react-native-reanimated';

const EntryScreen = ({ onAnimationComplete }) => {
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.8);
  const textOpacity = useSharedValue(0);
  const textY = useSharedValue(20);

  useEffect(() => {
    // 1. Fade in and Pulse Logo
    logoOpacity.value = withTiming(1, { duration: 800 });
    logoScale.value = withSequence(
      withTiming(1.1, { duration: 400, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 400 })
    );

    // 2. Staggered Text Reveal
    textOpacity.value = withDelay(1000, withTiming(1, { duration: 800 }));
    textY.value = withDelay(1000, withTiming(0, { duration: 800, easing: Easing.out(Easing.exp) }));

    // 3. Exit Sequence
    setTimeout(() => {
      logoOpacity.value = withTiming(0, { duration: 500 });
      textOpacity.value = withTiming(0, { duration: 500 }, (finished) => {
        if (finished) runOnJS(onAnimationComplete)();
      });
    }, 3000);
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textY.value }],
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.logoPlaceholder, logoStyle]} />
      <Animated.View style={[styles.textContainer, textStyle]}>
        <Animated.Text style={styles.affirmation}>
          Be present, not just productive.
        </Animated.Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A1A1A', justifyContent: 'center', alignItems: 'center' },
  logoPlaceholder: { width: 100, height: 100, backgroundColor: '#2AF598', borderRadius: 25, marginBottom: 30 },
  textContainer: { paddingHorizontal: 40 },
  affirmation: { color: '#FFF', fontSize: 18, textAlign: 'center', fontFamily: 'Satoshi-Medium', letterSpacing: 0.5 }
});

export default EntryScreen;