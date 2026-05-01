import React from 'react';
import { Image, Platform, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path } from 'react-native-svg';

interface EntryScreenProps {
  onAnimationComplete: () => void;
}

const FONT_DISPLAY = Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' });
const FONT_BODY = Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' });
const FONT_BUTTON = Platform.select({ ios: 'System', android: 'sans-serif-medium', default: 'System' });

const EntryScreen: React.FC<EntryScreenProps> = ({ onAnimationComplete }) => {
  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#171733', '#211D43', '#171733']} style={StyleSheet.absoluteFillObject} />
      <LinearGradient
        colors={['rgba(211,208,255,0.18)', 'rgba(211,208,255,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.meshTop}
      />
      <LinearGradient
        colors={['rgba(252,239,180,0.13)', 'rgba(252,239,180,0)']}
        start={{ x: 1, y: 1 }}
        end={{ x: 0, y: 0 }}
        style={styles.meshBottom}
      />
      <View style={styles.lineShapeTop} />
      <View style={styles.lineShapeLeft} />
      <View style={styles.lineShapeBottom} />
      <View style={styles.lineDotOne} />
      <View style={styles.lineDotTwo} />
      <View style={styles.content}>
        <View style={styles.progressTrack}>
          <View style={styles.progressFill} />
        </View>

        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0)']}
          start={{ x: 0, y: 1 }}
          end={{ x: 1, y: 0 }}
          style={styles.illustrationPanel}
        >
          <Svg style={styles.flightPaths} viewBox="0 0 380 520" preserveAspectRatio="none">
            <Path
              d="M16 132 C88 52 174 56 216 112 C244 150 222 184 165 198 C96 216 62 254 72 308"
              stroke="rgba(255,255,255,0.18)"
              strokeWidth="2"
              strokeDasharray="2 7"
              strokeLinecap="round"
              fill="none"
            />
            <Path
              d="M330 72 C272 86 232 112 214 152 C196 194 230 230 284 224 C334 218 360 252 342 302"
              stroke="rgba(255,255,255,0.16)"
              strokeWidth="2"
              strokeDasharray="2 8"
              strokeLinecap="round"
              fill="none"
            />
            <Path
              d="M36 436 C108 452 178 454 230 426 C278 400 310 400 364 420"
              stroke="rgba(255,255,255,0.17)"
              strokeWidth="2"
              strokeDasharray="2 7"
              strokeLinecap="round"
              fill="none"
            />
          </Svg>
          <Image source={require('../../assets/Share 3.png')} style={styles.illustration} resizeMode="contain" />
        </LinearGradient>

        <View style={styles.copyWrap}>
          <Text style={styles.title}>Take back your screen time</Text>
          <Text style={styles.description}>
            Build focus, set app limits, and grow healthier digital habits daily.
          </Text>
        </View>

        <Pressable onPress={onAnimationComplete}>
          <View style={styles.button}>
            <Text style={styles.buttonText}>Get Started</Text>
          </View>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#171733'
  },
  meshTop: {
    position: 'absolute',
    top: -70,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 130
  },
  meshBottom: {
    position: 'absolute',
    left: -90,
    bottom: 130,
    width: 280,
    height: 280,
    borderRadius: 140
  },
  lineShapeTop: {
    position: 'absolute',
    top: 34,
    left: -34,
    width: 210,
    height: 94,
    borderWidth: 1.4,
    borderColor: 'rgba(255,255,255,0.13)',
    borderRadius: 60,
    transform: [{ rotate: '-14deg' }]
  },
  lineShapeLeft: {
    position: 'absolute',
    top: 250,
    left: -72,
    width: 170,
    height: 220,
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 84,
    transform: [{ rotate: '18deg' }]
  },
  lineShapeBottom: {
    position: 'absolute',
    right: -80,
    bottom: 84,
    width: 260,
    height: 126,
    borderWidth: 1.3,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 80,
    transform: [{ rotate: '-8deg' }]
  },
  lineDotOne: {
    position: 'absolute',
    top: 112,
    right: 34,
    width: 7,
    height: 7,
    borderRadius: 4,
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.25)'
  },
  lineDotTwo: {
    position: 'absolute',
    bottom: 196,
    left: 42,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.18)'
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 18
  },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(17,17,17,0.08)',
    marginHorizontal: 8,
    marginBottom: 14,
    overflow: 'hidden'
  },
  progressFill: {
    width: '34%',
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#FFFFFF'
  },
  illustrationPanel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flightPaths: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0
  },
  illustration: {
    width: '118%',
    height: '96%',
    zIndex: 1,
    transform: [{ translateY: 28 }]
  },
  copyWrap: {
    alignItems: 'center',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 430,
    paddingHorizontal: 18,
    marginBottom: 28
  },
  title: {
    maxWidth: 360,
    fontSize: 30,
    lineHeight: 37,
    fontWeight: '800',
    fontFamily: FONT_DISPLAY,
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 0,
    marginBottom: 10,
    includeFontPadding: false
  },
  description: {
    maxWidth: 350,
    fontSize: 16,
    lineHeight: 24,
    color: 'rgba(255,255,255,0.76)',
    fontWeight: '400',
    fontFamily: FONT_BODY,
    textAlign: 'center',
    includeFontPadding: false
  },
  button: {
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5
  },
  buttonText: {
    color: '#111111',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    fontFamily: FONT_BUTTON,
    letterSpacing: 0,
    includeFontPadding: false
  }
});

export default EntryScreen;
