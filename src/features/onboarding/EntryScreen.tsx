import React, { useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Image, Dimensions, SafeAreaView } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';

const { width, height } = Dimensions.get('window');

interface EntryScreenProps {
  onAnimationComplete: () => void;
}

const EntryScreen: React.FC<EntryScreenProps> = ({ onAnimationComplete }) => {
  const fadeAnim = useSharedValue(0);

  useEffect(() => {
    fadeAnim.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
  }));

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={[styles.content, animatedStyle]}>
        
        {/* Top Navigation Row */}
        <View style={styles.topRow}>
          <TouchableOpacity style={styles.iconButton}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <View style={styles.versionPill}>
            <Text style={styles.sparkle}>✻</Text>
            <Text style={styles.versionText}>Version 2.0</Text>
            <Text style={styles.chevron}>⌄</Text>
          </View>
          <View style={styles.spacer} />
        </View>

        {/* Branding - Exactly like image */}
        <View style={styles.brandContainer}>
          <Text style={styles.brandMind}>Mind</Text>
          <View style={styles.mateHighlight}>
             <Text style={styles.brandMate}>Mate</Text>
          </View>
        </View>

        {/* Illustration */}
        <View style={styles.imageContainer}>
          <Image
            source={require('../../assets/Motivation 6.png')}
            style={styles.mainImage}
            resizeMode="contain"
          />
        </View>

        {/* Headline & Subheadline */}
        <View style={styles.textGroup}>
          <Text style={styles.headline}>
            Unlock the Power of{"\n"}Your Mind 🧠 ⌛ 😊
          </Text>
          <Text style={styles.subheadline}>
            Track your focus, balance your emotions, and train{"\n"}your mental clarity — all in one place.
          </Text>
        </View>

        {/* Footer Actions */}
        <View style={styles.footer}>
          <TouchableOpacity onPress={onAnimationComplete} activeOpacity={0.8}>
            <LinearGradient
              colors={['#D6E6A1', '#F5D9E0']} // Lime to Pink Gradient
              start={{x: 0, y: 0}}
              end={{x: 1, y: 0}}
              style={styles.getStartedBtn}
            >
              <View style={styles.btnIconCircle}>
                <Text style={styles.btnArrow}>→</Text>
              </View>
              <Text style={styles.btnText}>Get Started</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>

      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#FFFFFF' 
  },
  content: { 
    flex: 1, 
    paddingHorizontal: 24, 
    paddingTop: 10 
  },
  topRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  iconButton: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    backgroundColor: '#F7F7F7', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  backArrow: { 
    fontSize: 20, 
    color: '#000' 
  },
  versionPill: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#F7F7F7', 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 20 
  },
  sparkle: { 
    marginRight: 4, 
    fontSize: 14 
  },
  versionText: { 
    fontSize: 13, 
    fontWeight: '600', 
    marginRight: 4 
  },
  chevron: { 
    fontSize: 14, 
    color: '#888' 
  },
  spacer: { 
    width: 44 
  },
  brandContainer: { 
    flexDirection: 'row', 
    alignSelf: 'center', 
    marginTop: 35, 
    alignItems: 'center' 
  },
  brandMind: { 
    fontSize: 34, 
    fontWeight: '700', 
    color: '#000' 
  },
  mateHighlight: { 
    backgroundColor: '#A9D6E5', // Sky Blue
    borderRadius: 4, 
    marginLeft: 4, 
    paddingHorizontal: 6, 
    paddingVertical: 2 
  },
  brandMate: { 
    fontSize: 34, 
    fontWeight: '700', 
    color: '#FFF' 
  },
  imageContainer: { 
    width: '100%', 
    height: height * 0.38, 
    marginTop: 10 
  },
  mainImage: { 
    width: '100%', 
    height: '100%' 
  },
  textGroup: { 
    marginTop: 20, 
    alignItems: 'center' 
  },
  headline: { 
    fontSize: 28, 
    fontWeight: '800', // Bold
    textAlign: 'center', 
    color: '#000', 
    lineHeight: 36 
  },
  subheadline: { 
    fontSize: 15, 
    textAlign: 'center', 
    color: '#666', 
    marginTop: 12, 
    lineHeight: 22, 
    fontWeight: '400' 
  },
  footer: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginTop: 'auto', // Sticks to bottom
    marginBottom: 40 
  },
  getStartedBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 14, 
    paddingHorizontal: 24, 
    borderRadius: 35 
  },
  btnIconCircle: { 
    width: 30, 
    height: 30, 
    borderRadius: 15, 
    backgroundColor: 'rgba(255,255,255,0.4)', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 12 
  },
  btnArrow: { 
    color: '#000', 
    fontWeight: 'bold', 
    fontSize: 16 
  },
  btnText: { 
    fontSize: 17, 
    fontWeight: '700', 
    color: '#000' 
  },
  skipText: { 
    fontSize: 16, 
    color: '#000', 
    fontWeight: '600' 
  }
});

export default EntryScreen;