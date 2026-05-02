import React from 'react';
import { Platform, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

interface EntryScreenProps {
  onAnimationComplete: () => void;
}

const FONT_DISPLAY = Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' });
const FONT_BODY = Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' });
const FONT_BUTTON = Platform.select({ ios: 'System', android: 'sans-serif-medium', default: 'System' });

const EntryScreen: React.FC<EntryScreenProps> = ({ onAnimationComplete }) => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.bgSoftMint} />
      <View style={styles.bgSoftBlue} />

      <View style={styles.content}>
        <View style={styles.topRow}>
          <View style={styles.brandMark}>
            <Text style={styles.brandMarkText}>u</Text>
          </View>
          <Text style={styles.brandText}>unlure</Text>
          <View style={styles.topIcon}>
            <Text style={styles.topIconText}>↗</Text>
          </View>
        </View>

        <View style={styles.previewStage}>
          <View style={[styles.phoneCard, styles.phoneLeft]}>
            <Text style={styles.phoneTitle}>set limits with ease</Text>
            <View style={styles.floatingGrid}>
              <View style={[styles.bubble, styles.bubbleMint]}><Text style={styles.bubbleText}>focus</Text></View>
              <View style={[styles.bubble, styles.bubbleBlue]}><Text style={styles.bubbleText}>social</Text></View>
              <View style={[styles.bubble, styles.bubbleBlack]}><Text style={styles.bubbleTextDark}>stop</Text></View>
              <View style={[styles.bubble, styles.bubbleCream]}><Text style={styles.bubbleText}>apps</Text></View>
            </View>
          </View>

          <View style={[styles.phoneCard, styles.phoneMain]}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardKicker}>Today</Text>
              <View style={styles.avatarDot} />
            </View>
            <Text style={styles.mainCardTitle}>daily screen plan</Text>
            <View style={styles.screenBlockLarge}>
              <Text style={styles.blockLabel}>Entertainment</Text>
              <Text style={styles.blockTime}>45m / 2h</Text>
            </View>
            <View style={styles.blockRow}>
              <View style={styles.screenBlockSmallBlue}>
                <Text style={styles.blockLabel}>Social</Text>
                <Text style={styles.blockTime}>18m</Text>
              </View>
              <View style={styles.screenBlockSmallCream}>
                <Text style={styles.blockLabel}>Other</Text>
                <Text style={styles.blockTime}>9m</Text>
              </View>
            </View>
            <View style={styles.miniNav}>
              <View style={styles.navDot} />
              <View style={styles.navDot} />
              <View style={styles.navDotActive} />
              <View style={styles.navDot} />
            </View>
          </View>

          <View style={[styles.phoneCard, styles.phoneRight]}>
            <Text style={styles.cardKicker}>Week</Text>
            <View style={styles.chartBars}>
              {[44, 70, 88, 60, 102, 76].map((height, index) => (
                <View key={index} style={[styles.tallBar, { height }]} />
              ))}
            </View>
            <View style={styles.bottomSheetPreview}>
              <Text style={styles.sheetTitle}>streak balance</Text>
              <Text style={styles.sheetNumber}>4</Text>
              <Text style={styles.sheetCaption}>days on track</Text>
            </View>
          </View>
        </View>

        <View style={styles.copyWrap}>
          <Text style={styles.title}>keep track of your screen time with ease</Text>
          <Text style={styles.description}>
            Clean daily limits, live usage, and streaks that reset at midnight.
          </Text>
        </View>

        <Pressable onPress={onAnimationComplete} style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
          <Text style={styles.buttonText}>Get Started</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8F3',
    overflow: 'hidden'
  },
  bgSoftMint: {
    position: 'absolute',
    top: 80,
    left: -64,
    width: 220,
    height: 220,
    borderRadius: 52,
    backgroundColor: '#B9E0C9',
    opacity: 0.72,
    transform: [{ rotate: '-12deg' }]
  },
  bgSoftBlue: {
    position: 'absolute',
    right: -80,
    top: 14,
    width: 260,
    height: 300,
    borderRadius: 70,
    backgroundColor: '#DDEFFC',
    opacity: 0.8,
    transform: [{ rotate: '16deg' }]
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 22
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18
  },
  brandMark: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111111',
    marginRight: 10
  },
  brandMarkText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
    fontFamily: FONT_BUTTON
  },
  brandText: {
    flex: 1,
    color: '#111111',
    fontSize: 16,
    fontWeight: '800',
    fontFamily: FONT_DISPLAY
  },
  topIcon: {
    width: 31,
    height: 31,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D8D8D8',
    backgroundColor: 'rgba(255,255,255,0.62)'
  },
  topIconText: {
    color: '#111111',
    fontSize: 15,
    fontWeight: '800',
    fontFamily: FONT_BUTTON
  },
  previewStage: {
    height: 350,
    justifyContent: 'center',
    marginHorizontal: -18,
    marginBottom: 18
  },
  phoneCard: {
    position: 'absolute',
    borderRadius: 30,
    backgroundColor: '#FFFDF8',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.12,
    shadowRadius: 26,
    elevation: 8
  },
  phoneLeft: {
    left: 0,
    top: 26,
    width: 164,
    height: 292,
    padding: 18,
    transform: [{ rotate: '-11deg' }]
  },
  phoneMain: {
    left: 112,
    top: 8,
    width: 192,
    height: 322,
    padding: 16,
    zIndex: 3
  },
  phoneRight: {
    right: -10,
    top: 34,
    width: 162,
    height: 286,
    padding: 16,
    backgroundColor: '#B9E0C9',
    transform: [{ rotate: '10deg' }]
  },
  phoneTitle: {
    color: '#111111',
    fontSize: 31,
    lineHeight: 34,
    fontWeight: '800',
    fontFamily: FONT_DISPLAY,
    letterSpacing: 0
  },
  floatingGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'flex-end',
    gap: 8,
    marginTop: 12
  },
  bubble: {
    minWidth: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8
  },
  bubbleMint: { backgroundColor: '#B9E0C9' },
  bubbleBlue: { backgroundColor: '#CFE7FF' },
  bubbleBlack: { backgroundColor: '#111111' },
  bubbleCream: { backgroundColor: '#F7ECCF' },
  bubbleText: {
    color: '#111111',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: FONT_BODY
  },
  bubbleTextDark: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: FONT_BODY
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  cardKicker: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: FONT_BODY
  },
  avatarDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#B9E0C9',
    borderWidth: 2,
    borderColor: '#FFFFFF'
  },
  mainCardTitle: {
    color: '#111111',
    fontSize: 28,
    lineHeight: 31,
    fontWeight: '800',
    fontFamily: FONT_DISPLAY,
    marginBottom: 13
  },
  screenBlockLarge: {
    height: 86,
    borderRadius: 18,
    padding: 14,
    backgroundColor: '#F7ECCF',
    marginBottom: 8
  },
  blockRow: {
    flexDirection: 'row',
    gap: 8
  },
  screenBlockSmallBlue: {
    flex: 1,
    height: 68,
    borderRadius: 17,
    padding: 12,
    backgroundColor: '#CFE7FF'
  },
  screenBlockSmallCream: {
    flex: 1,
    height: 68,
    borderRadius: 17,
    padding: 12,
    backgroundColor: '#F7ECCF'
  },
  blockLabel: {
    color: '#6E6E73',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: FONT_BODY
  },
  blockTime: {
    color: '#111111',
    fontSize: 16,
    fontWeight: '800',
    fontFamily: FONT_DISPLAY,
    marginTop: 5
  },
  miniNav: {
    height: 38,
    borderRadius: 19,
    backgroundColor: '#111111',
    marginTop: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16
  },
  navDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.34)'
  },
  navDotActive: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF'
  },
  chartBars: {
    height: 116,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 14
  },
  tallBar: {
    width: 16,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.62)'
  },
  bottomSheetPreview: {
    position: 'absolute',
    left: -10,
    right: -10,
    bottom: 10,
    minHeight: 108,
    borderRadius: 28,
    padding: 18,
    backgroundColor: '#FFFDF8',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 6
  },
  sheetTitle: {
    color: '#111111',
    fontSize: 14,
    fontWeight: '800',
    fontFamily: FONT_DISPLAY
  },
  sheetNumber: {
    color: '#111111',
    fontSize: 46,
    lineHeight: 52,
    fontWeight: '700',
    fontFamily: FONT_DISPLAY,
    marginTop: 6
  },
  sheetCaption: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: FONT_BODY
  },
  copyWrap: {
    marginTop: 'auto',
    marginBottom: 22
  },
  title: {
    color: '#111111',
    fontSize: 43,
    lineHeight: 46,
    fontWeight: '800',
    fontFamily: FONT_DISPLAY,
    letterSpacing: 0,
    maxWidth: 360,
    marginBottom: 12,
    includeFontPadding: false
  },
  description: {
    color: '#6E6E73',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
    fontFamily: FONT_BODY,
    maxWidth: 330,
    includeFontPadding: false
  },
  button: {
    height: 56,
    borderRadius: 28,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5
  },
  buttonPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.992 }]
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    fontFamily: FONT_BUTTON,
    letterSpacing: 0,
    includeFontPadding: false
  }
});

export default EntryScreen;
