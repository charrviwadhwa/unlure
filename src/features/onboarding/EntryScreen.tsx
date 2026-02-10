import React, { useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Image, Dimensions, SafeAreaView } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing
} from 'react-native-reanimated';

interface EntryScreenProps {
  onAnimationComplete: () => void;
}

const { width } = Dimensions.get('window');

const EntryScreen: React.FC<EntryScreenProps> = ({ onAnimationComplete }) => {
  const fadeAnim = useSharedValue(0);

  useEffect(() => {
    fadeAnim.value = withTiming(1, { duration: 1000, easing: Easing.out(Easing.quad) });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
  }));

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Animated.View style={[styles.content, animatedStyle]}>
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.backButton} activeOpacity={0.8}>
              <Text style={styles.backText}>{'\u2190'}</Text>
            </TouchableOpacity>
            <View style={styles.versionPill}>
              <Text style={styles.versionIcon}>{'\u2736'}</Text>
              <Text style={styles.versionText}>Version 2.0</Text>
              <Text style={styles.versionArrow}>{'\u25BE'}</Text>
            </View>
            <View style={styles.topSpacer} />
          </View>

          <View style={styles.brandRow}>
            <Text style={styles.brandBase}>Mind</Text>
            <Text style={styles.brandHighlight}>Mate</Text>
          </View>

          <View style={styles.illustrationWrap}>
            <Image
              source={require('../../assets/Motivation 6.png')}
              style={styles.illustration}
              resizeMode="contain"
            />
          </View>
          <View style={styles.textGroup}>
            <Text style={styles.headline}>
              Unlock the Power of{'\n'}Your Mind {'\uD83E\uDDE0'} {'\u23F3'} {'\u263A'}
            </Text>
            <Text style={styles.subhead}>
              Track your focus, balance your emotions, and train your mental clarity \u2014 all in one place.
            </Text>
          </View>

          <View style={styles.footerRow}>
            <TouchableOpacity style={styles.ctaButton} onPress={onAnimationComplete} activeOpacity={0.85}>
              <View style={styles.ctaIconCircle}>
                <Text style={styles.ctaArrow}>{'\u2192'}</Text>
              </View>
              <Text style={styles.ctaText}>Get Started</Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.7}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#faf7f6',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  card: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 48,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 4,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    width: '100%',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  backText: {
    fontSize: 18,
    color: '#1A1A1A',
    fontWeight: '600',
  },
  versionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  versionIcon: {
    fontSize: 12,
    color: '#1A1A1A',
    marginRight: 6,
  },
  versionText: {
    fontSize: 12,
    color: '#1A1A1A',
    fontWeight: '600',
    marginRight: 6,
  },
  versionArrow: {
    fontSize: 12,
    color: '#1A1A1A',
  },
  topSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 8,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  brandBase: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1A1A1A',
    marginRight: 4,
  },
  brandHighlight: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    backgroundColor: '#0D5D4E',
    paddingHorizontal: 8,
    borderRadius: 6,
    overflow: 'hidden',
  },
  illustrationWrap: {
    width: '100%',
    alignItems: 'center',
    marginTop: 4,
  },
  illustration: {
    width: width * 0.95,
    height: width * 1.18,
  },
  textGroup: {
    width: '100%',
    alignItems: 'flex-start',
    marginTop: 6,
  },
  headline: {
    fontSize: 35,
    fontWeight: '800',
    color: '#1A1A1A',
    textAlign: 'left',
    lineHeight: 39,
  },
  subhead: {
    fontSize: 16.5,
    color: '#1A1A1A',
    textAlign: 'left',
    marginTop: 10,
    lineHeight: 20,
  },
  footerRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingHorizontal: 4,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFD581',
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 26,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    marginTop:9
  },
  ctaIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 15,
    backgroundColor: '#E8685D',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  ctaArrow: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '700',
    
  },
  ctaText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  skipText: {
    fontSize: 14,
    color: '#1A1A1A',
    fontWeight: '600',
  },
});

export default EntryScreen;
