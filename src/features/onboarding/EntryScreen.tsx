import React, { useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Image, Dimensions } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  Easing 
} from 'react-native-reanimated';

interface EntryScreenProps {
  onAnimationComplete: () => void;
}

const { width, height } = Dimensions.get('window');

const EntryScreen: React.FC<EntryScreenProps> = ({ onAnimationComplete }) => {
  const fadeAnim = useSharedValue(0);

  useEffect(() => {
    fadeAnim.value = withTiming(1, { duration: 1000, easing: Easing.out(Easing.quad) });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
  }));

  return (
    <View style={styles.container}>
      {/* 1. Illustration Section */}
      <View style={styles.illustrationSection}>
        <Image 
          source={require('../../assets/Chatting 1.png')} 
          style={styles.illustration}
          resizeMode="contain"
        />
      </View>

      {/* 2. White Content Card with High Curve */}
      <View style={styles.contentCard}>
        {/* Pagination Dots Moved inside the card area to match the visual balance */}
        <View style={styles.indicatorContainer}>
          <View style={[styles.dot, styles.activeDot]} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>

        <Animated.View style={[styles.innerContent, animatedStyle]}>
          <Text style={styles.title}>Adopt a Friend</Text>
          <Text style={styles.subtitle}>
            Adopt the cutest pet as your{"\n"}playmate
          </Text>

          {/* 3. The Exact Olive Button */}
          <TouchableOpacity 
            style={styles.button} 
            onPress={onAnimationComplete}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>Get Started</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F2ED', // EXACT Warm background palette
  },
  illustrationSection: {
    flex: 1.2,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 40,
  },
  illustration: {
    width: width * 0.9, // Adjusting scale to prevent overflow
    height: '80%',
  },
  indicatorContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E6E2D3', // Muted dot color
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: '#B58D67', // Terracotta active dot from the pic
    width: 16,
  },
  contentCard: {
    flex: 1,
    backgroundColor: '#FFFFFF', // Clean White
    borderTopLeftRadius: 100, 
    borderTopRightRadius: 100,
    paddingHorizontal: 40,
    paddingTop: 40,
    alignItems: 'center',
    // Shadow added for depth found in 2026 UI trends
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.03,
    shadowRadius: 20,
    elevation: 5,
  },
  innerContent: {
    width: '100%',
    alignItems: 'center',
    flex: 1,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#2D2D2D', // Softer black for better readability
    textAlign: 'center',
    marginBottom: 12,
    fontFamily: 'serif',
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E8E', // Muted grey for a "calm" vibe
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
  },
  button: {
    backgroundColor: '#8E9473', // Exact Olive Green palette
    width: '100%',
    paddingVertical: 22,
    borderRadius: 28,
    alignItems: 'center',
    marginTop: 'auto',
    marginBottom: 50,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});

export default EntryScreen;