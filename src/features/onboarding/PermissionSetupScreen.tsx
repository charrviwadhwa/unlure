import React, { useCallback, useEffect, useState } from 'react';
import {
  AppState,
  Image,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { ScreenTimeService } from '../../services/ScreenTimeService';

type PermissionKey = 'usage' | 'overlay';
const ENABLED_GREEN = '#2F8F6B';
const ENABLED_GREEN_SURFACE = 'rgba(47,143,107,0.22)';
const FONT_SANS = Platform.select({ ios: 'Geist-Regular', android: 'Geist-Regular', default: 'System' });
const FONT_SANS_SEMIBOLD = Platform.select({ ios: 'Geist-SemiBold', android: 'Geist-SemiBold', default: 'System' });
const FONT_SCRIPT = Platform.select({ ios: 'PlaywriteDESAS-Light', android: 'PlaywriteDESAS-Light', default: 'System' });

type PermissionRow = {
  key: PermissionKey;
  title: string;
  detail: string;
  enabled: boolean;
  action: () => void | Promise<void>;
};

export const PermissionSetupScreen = ({
  onComplete,
  actionLabel = 'Continue'
}: {
  onComplete: () => void;
  actionLabel?: string;
}) => {
  const isDark = useColorScheme() === 'dark';
  const theme = {
    bg: isDark ? '#121418' : '#FFFFFF',
    surface: isDark ? 'rgba(255,255,255,0.055)' : 'rgba(255,255,255,0.74)',
    border: isDark ? 'rgba(255,255,255,0.08)' : '#EEE8DC',
    text: isDark ? '#FFFFFF' : '#000000',
    textSecondary: isDark ? '#A5ACB8' : '#6F737C',
    subSurface: isDark ? 'rgba(255,255,255,0.06)' : '#FFFDF8'
  };
  const screenGradientColors = isDark
    ? ['#121418', '#14171A', '#171A16', '#121418']
    : ['#FFFFFF', '#FFFCF6', '#FFFFFF'];
  const [usageEnabled, setUsageEnabled] = useState(false);
  const [overlayEnabled, setOverlayEnabled] = useState(false);

  const refreshStatuses = useCallback(async () => {
    const [usage, overlay] = await Promise.all([
      ScreenTimeService.hasUsageAccess(),
      ScreenTimeService.canDrawOverlays()
    ]);
    setUsageEnabled(usage);
    setOverlayEnabled(overlay);
  }, []);

  useEffect(() => {
    refreshStatuses();
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') refreshStatuses();
    });
    return () => sub.remove();
  }, [refreshStatuses]);

  const permissions: PermissionRow[] = [
    {
      key: 'usage',
      title: 'Usage Access',
      detail: 'Tracks time totals for selected apps without reading screen content.',
      enabled: usageEnabled,
      action: ScreenTimeService.openUsageAccessSettings
    },
    {
      key: 'overlay',
      title: 'Focus Overlay',
      detail: 'Shows limit warnings over selected apps when a cap is reached.',
      enabled: overlayEnabled,
      action: ScreenTimeService.openOverlaySettings
    }
  ];
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.bg} />
      <LinearGradient colors={screenGradientColors} style={styles.screenGradient}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          overScrollMode="never"
          bounces={false}
        >
          <Image source={require('../../assets/Completed 1.png')} style={styles.heroImage} resizeMode="contain" />
          <Text style={[styles.brandMark, { color: isDark ? '#AAB0BD' : '#6E6E73' }]}>unlure</Text>
          <Text style={[styles.title, { color: theme.text }]}>Set up Focus Mode</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Standard mode uses Usage Access and Overlay only. Unlure does not read messages, passwords, payment screens, or app content.
          </Text>

          <View style={[styles.disclosureBox, isDark && styles.disclosureBoxDark, { backgroundColor: isDark ? 'rgba(255,255,255,0.028)' : theme.surface, borderColor: isDark ? 'transparent' : theme.border, borderWidth: isDark ? 0 : 0.5 }]}>
            <Text style={[styles.disclosureTitle, { color: theme.text }]}>What Unlure can see</Text>
            <Text style={[styles.disclosureText, { color: theme.textSecondary }]}>
              Standard mode sees app package names and usage duration for apps you select. It cannot inspect banking screens,
              chats, typed text, passwords, notifications, or payment details.
            </Text>
          </View>

          <View style={[styles.permissionList, { borderTopColor: theme.border }]}>
            {permissions.map(item => (
              <TouchableOpacity key={item.key} style={[styles.permissionRow, { borderBottomColor: theme.border }]} onPress={item.action} activeOpacity={0.76}>
                <View style={styles.permissionCopy}>
                  <Text style={[styles.permissionTitle, { color: theme.text }]}>{item.title}</Text>
                  <Text style={[styles.permissionDetail, { color: theme.textSecondary }]}>{item.detail}</Text>
                </View>
                <View
                  style={[
                    styles.permissionAction,
                    { backgroundColor: isDark ? '#FFFFFF' : theme.subSurface, borderColor: isDark ? '#FFFFFF' : theme.border },
                    item.enabled && styles.permissionActionEnabled,
                    item.enabled && isDark && { backgroundColor: ENABLED_GREEN_SURFACE, borderColor: ENABLED_GREEN }
                  ]}
                >
                  <Text style={[styles.permissionActionText, isDark && { color: '#101319' }, item.enabled && styles.permissionActionTextEnabled, item.enabled && isDark && { color: '#B7F3D8' }]}>
                    {item.enabled ? 'Enabled' : 'Open'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={[styles.continueButton, isDark && { backgroundColor: '#FFFFFF' }]} onPress={onComplete} activeOpacity={0.88}>
            <Text style={[styles.continueText, isDark && { color: '#101319' }]}>{actionLabel}</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF'
  },
  screenGradient: {
    flex: 1
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? Math.max((StatusBar.currentHeight ?? 0) + 20, 44) : 18,
    paddingBottom: 136
  },
  heroImage: {
    width: 142,
    height: 142,
    alignSelf: 'center',
    marginBottom: 18
  },
  title: {
    color: '#000000',
    fontSize: 28,
    lineHeight: 32,
    fontFamily: FONT_SANS_SEMIBOLD,
    fontWeight: '600'
  },
  brandMark: {
    color: '#6E6E73',
    fontSize: 18,
    lineHeight: 22,
    fontFamily: FONT_SCRIPT,
    fontWeight: '600',
    letterSpacing: 0,
    marginBottom: 4
  },
  subtitle: {
    color: '#7C7C84',
    fontSize: 15,
    lineHeight: 21,
    fontFamily: FONT_SANS,
    fontWeight: '400',
    marginTop: 8,
    marginBottom: 18
  },
  disclosureBox: {
    backgroundColor: '#F7F7FA',
    borderWidth: 0.5,
    borderColor: '#EFEFF4',
    borderRadius: 8,
    padding: 14,
    marginBottom: 12
  },
  disclosureBoxDark: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0
  },
  disclosureTitle: {
    color: '#111111',
    fontSize: 14,
    lineHeight: 18,
    fontFamily: FONT_SANS_SEMIBOLD,
    fontWeight: '600',
    marginBottom: 5
  },
  disclosureText: {
    color: '#6E6E73',
    fontSize: 12,
    lineHeight: 17,
    fontFamily: FONT_SANS,
    fontWeight: '400'
  },
  permissionList: {
    borderTopWidth: 1,
    borderTopColor: '#EFEFF4'
  },
  permissionRow: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFF4',
    paddingVertical: 12
  },
  permissionCopy: {
    flex: 1,
    paddingRight: 14
  },
  permissionTitle: {
    color: '#000000',
    fontSize: 16,
    lineHeight: 20,
    fontFamily: FONT_SANS_SEMIBOLD,
    fontWeight: '600'
  },
  permissionDetail: {
    color: '#8E8E93',
    fontSize: 12,
    lineHeight: 16,
    fontFamily: FONT_SANS,
    fontWeight: '400',
    marginTop: 3
  },
  permissionAction: {
    minWidth: 82,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F7F7FA',
    borderWidth: 1,
    borderColor: '#ECECF2',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14
  },
  permissionActionEnabled: {
    backgroundColor: '#E8F8EA',
    borderColor: '#CDEFD3'
  },
  permissionActionText: {
    color: '#1C1C1E',
    fontSize: 13,
    fontFamily: FONT_SANS,
    fontWeight: '500'
  },
  permissionActionTextEnabled: {
    color: '#28A745'
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'android' ? 22 : 18,
    backgroundColor: 'transparent'
  },
  continueButton: {
    minHeight: 54,
    borderRadius: 27,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4
  },
  continueText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: FONT_SANS,
    fontWeight: '500'
  }
});
