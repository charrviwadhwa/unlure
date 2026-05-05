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
  View
} from 'react-native';
import { ScreenTimeService } from '../../services/ScreenTimeService';
import { UserStore } from '../../services/storage';

type PermissionKey = 'usage' | 'detection' | 'overlay';

type PermissionRow = {
  key: PermissionKey;
  title: string;
  detail: string;
  enabled: boolean;
  action: () => void | Promise<void>;
};

export const PermissionSetupScreen = ({ onComplete }: { onComplete: () => void }) => {
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
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
        bounces={false}
      >
        <Image source={require('../../assets/Completed 1.png')} style={styles.heroImage} resizeMode="contain" />
        <Text style={styles.title}>Set up Focus Mode</Text>
        <Text style={styles.subtitle}>
          Enable these permissions so Unlure can track limits, detect selected app openings, and show streak-saving warnings.
        </Text>

        <View style={styles.disclosureBox}>
          <Text style={styles.disclosureTitle}>Accessibility disclosure</Text>
          <Text style={styles.disclosureText}>
            Unlure uses Accessibility only to detect when apps you selected with limits are opened. It does not read messages,
            passwords, typed text, notifications, or private content, and this data is not sold or shared.
          </Text>
        </View>

        <View style={styles.permissionList}>
          {permissions.map(item => (
            <TouchableOpacity key={item.key} style={styles.permissionRow} onPress={item.action} activeOpacity={0.76}>
              <View style={styles.permissionCopy}>
                <Text style={styles.permissionTitle}>{item.title}</Text>
                <Text style={styles.permissionDetail}>{item.detail}</Text>
              </View>
              <View
                style={[styles.permissionAction, item.enabled && styles.permissionActionEnabled]}
              >
                <Text style={[styles.permissionActionText, item.enabled && styles.permissionActionTextEnabled]}>
                  {item.enabled ? 'Enabled' : 'Open'}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.continueButton} onPress={onComplete} activeOpacity={0.88}>
          <Text style={styles.continueText}>Continue</Text>
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
    paddingBottom: 118
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
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14
  },
  permissionActionEnabled: {
    backgroundColor: '#E8F8EA'
  },
  permissionActionText: {
    color: '#FFFFFF',
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
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 8
  },
  continueText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800'
  }
});
