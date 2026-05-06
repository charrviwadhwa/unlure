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
import { ScreenTimeService } from '../../services/ScreenTimeService';
import { UserStore } from '../../services/storage';

type PermissionKey = 'usage' | 'detection' | 'overlay';
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
    surface: isDark ? '#191D23' : '#F7F7FA',
    border: isDark ? '#2A303A' : '#EFEFF4',
    text: isDark ? '#F3F4F6' : '#000000',
    textSecondary: isDark ? '#A5ACB8' : '#7C7C84',
    subSurface: isDark ? '#20252D' : '#F7F7FA'
  };
  const [usageEnabled, setUsageEnabled] = useState(false);
  const [detectionEnabled, setDetectionEnabled] = useState(false);
  const [overlayEnabled, setOverlayEnabled] = useState(false);

  const refreshStatuses = useCallback(async () => {
    const [usage, detection, overlay] = await Promise.all([
      ScreenTimeService.hasUsageAccess(),
      ScreenTimeService.isFocusModeAccessibilityEnabled(),
      ScreenTimeService.canDrawOverlays()
    ]);
    setUsageEnabled(usage);
    setDetectionEnabled(detection);
    setOverlayEnabled(overlay);
  }, []);

  useEffect(() => {
    refreshStatuses();
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') refreshStatuses();
    });
    return () => sub.remove();
  }, [refreshStatuses]);

  const openFocusDetectionSettings = async () => {
    await UserStore.acceptAccessibilityDisclosure();
    await ScreenTimeService.openAccessibilitySettings();
  };

  const permissions: PermissionRow[] = [
    {
      key: 'usage',
      title: 'Usage Access',
      detail: 'Tracks daily time totals for selected apps.',
      enabled: usageEnabled,
      action: ScreenTimeService.openUsageAccessSettings
    },
    {
      key: 'detection',
      title: 'Focus Detection',
      detail: 'Detects when a selected limited app is opened.',
      enabled: detectionEnabled,
      action: openFocusDetectionSettings
    },
    {
      key: 'overlay',
      title: 'Focus Overlay',
      detail: 'Shows limit warnings over distracting apps.',
      enabled: overlayEnabled,
      action: ScreenTimeService.openOverlaySettings
    }
  ];

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.bg} />
      <ScrollView
        contentContainerStyle={[styles.content, { backgroundColor: theme.bg }]}
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
        bounces={false}
      >
        <Image source={require('../../assets/Completed 1.png')} style={styles.heroImage} resizeMode="contain" />
        <Text style={[styles.brandMark, { color: isDark ? '#AAB0BD' : '#6E6E73' }]}>unlure</Text>
        <Text style={[styles.title, { color: theme.text }]}>Set up Focus Mode</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Enable these permissions so Unlure can track limits, detect selected app openings, and show streak-saving warnings.
        </Text>

        <View style={[styles.disclosureBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.disclosureTitle, { color: theme.text }]}>Accessibility disclosure</Text>
          <Text style={[styles.disclosureText, { color: theme.textSecondary }]}>
            Unlure uses Accessibility only to detect when apps you selected with limits are opened. It does not read messages,
            passwords, typed text, notifications, or private content, and this data is not sold or shared.
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
                  item.enabled && isDark && { backgroundColor: '#1F8F4A', borderColor: '#1F8F4A' }
                ]}
              >
                <Text style={[styles.permissionActionText, isDark && { color: '#101319' }, item.enabled && styles.permissionActionTextEnabled, item.enabled && isDark && { color: '#FFFFFF' }]}>
                  {item.enabled ? 'Enabled' : 'Open'}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: theme.bg }]}>
        <TouchableOpacity style={[styles.continueButton, isDark && { backgroundColor: '#FFFFFF' }]} onPress={onComplete} activeOpacity={0.88}>
          <Text style={[styles.continueText, isDark && { color: '#101319' }]}>{actionLabel}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF'
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
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '800'
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
    fontWeight: '500',
    marginTop: 8,
    marginBottom: 18
  },
  disclosureBox: {
    backgroundColor: '#F7F7FA',
    borderWidth: 1,
    borderColor: '#EFEFF4',
    borderRadius: 8,
    padding: 14,
    marginBottom: 12
  },
  disclosureTitle: {
    color: '#111111',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
    marginBottom: 5
  },
  disclosureText: {
    color: '#6E6E73',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500'
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
    fontWeight: '800'
  },
  permissionDetail: {
    color: '#8E8E93',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
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
    fontWeight: '800'
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
    backgroundColor: '#FFFFFF'
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
    fontWeight: '800'
  }
});
