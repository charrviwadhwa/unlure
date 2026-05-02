import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, StatusBar, Image, Animated } from 'react-native';
import { ScreenTimeService, AppInfo } from '../../services/ScreenTimeService';
import { UserStore } from '../../services/storage';
import { TimeLimitModal } from './TimeLimitModal';

const IosSwitch = ({ enabled }: { enabled: boolean }) => {
  const progress = useRef(new Animated.Value(enabled ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(progress, {
      toValue: enabled ? 1 : 0,
      useNativeDriver: false,
      friction: 11,
      tension: 180
    }).start();
  }, [enabled, progress]);

  const backgroundColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['#E9E9EA', '#34C759']
  });
  const borderColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['#D9D9DE', '#34C759']
  });
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 21]
  });

  return (
    <Animated.View style={[styles.iosSwitch, { backgroundColor, borderColor }]}>
      <Animated.View style={[styles.switchKnob, { transform: [{ translateX }] }]} />
    </Animated.View>
  );
};

export const AppSelectionScreen = ({ onComplete }: { onComplete: () => void }) => {
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [selectedLimits, setSelectedLimits] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [activeApp, setActiveApp] = useState<AppInfo | null>(null);

  const loadData = useCallback(async () => {
    const [allApps, storedLimits] = await Promise.all([
      ScreenTimeService.getInstalledApps(true),
      UserStore.getAllLimits()
    ]);
    setApps(allApps);
    setSelectedLimits(storedLimits || {});
  }, []);

  useEffect(() => {
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadData();
    } finally {
      setRefreshing(false);
    }
  }, [loadData]);

  const filteredApps = useMemo(() => {
    return apps.filter(a => a.appName.toLowerCase().includes(search.toLowerCase()));
  }, [search, apps]);

  const handleConfirmLimit = async (minutes: number) => {
    if (activeApp) {
      const updated = { ...selectedLimits };
      if (minutes > 0) {
        updated[activeApp.packageName] = minutes;
      } else {
        delete updated[activeApp.packageName];
      }
      setSelectedLimits(updated);
      await UserStore.saveAllLimits(updated);
    }
    setModalVisible(false);
  };

  const removeLimit = async (packageName: string) => {
    const updated = { ...selectedLimits };
    delete updated[packageName];
    setSelectedLimits(updated);
    await UserStore.saveAllLimits(updated);
  };

  const formatLimit = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m limit`;
    return m === 0 ? `${h}h limit` : `${h}h ${m}m limit`;
  };

  if (loading) return <ActivityIndicator size="large" color="#111111" style={styles.loading} />;

  return (
    <View style={styles.container}>
      <View style={styles.headerWrap}>
        <Text style={styles.header}>Choose Apps</Text>
        <Text style={styles.subheader}>Only apps with enabled limits will appear in your streak view.</Text>
      </View>
      <View style={styles.permissionCard}>
        <View style={styles.permissionCopy}>
          <Text style={styles.permissionTitle}>Usage Access</Text>
          <Text style={styles.permissionText}>Required for live screen time.</Text>
        </View>
        <TouchableOpacity style={styles.permissionButton} onPress={ScreenTimeService.openUsageAccessSettings}>
          <Text style={styles.permissionButtonText}>Open</Text>
        </TouchableOpacity>
      </View>
      <TextInput
        style={styles.searchBar}
        placeholder="Search apps"
        value={search}
        onChangeText={setSearch}
        placeholderTextColor="#8E8E93"
      />

      <FlatList
        data={filteredApps}
        keyExtractor={(item) => item.packageName}
        initialNumToRender={12}
        windowSize={5}
        refreshing={refreshing}
        onRefresh={onRefresh}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const limit = selectedLimits[item.packageName];
          return (
            <TouchableOpacity
              style={styles.item}
              activeOpacity={0.72}
              onPress={() => {
                if (limit) {
                  removeLimit(item.packageName);
                } else {
                  setActiveApp(item);
                  setModalVisible(true);
                }
              }}
            >
              <View style={styles.appLeft}>
                {item.iconBase64 ? (
                  <Image source={{ uri: `data:image/png;base64,${item.iconBase64}` }} style={styles.appIcon} resizeMode="cover" />
                ) : (
                  <View style={styles.appIconFallback}>
                    <Text style={styles.appIconFallbackText}>{item.appName.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <View style={styles.appCopy}>
                  <Text style={styles.appName} numberOfLines={1}>{item.appName}</Text>
                  {limit ? <Text style={styles.limitText}>{formatLimit(limit)}</Text> : <Text style={styles.limitHint}>No limit</Text>}
                </View>
              </View>
              <IosSwitch enabled={Boolean(limit)} />
            </TouchableOpacity>
          );
        }}
      />

      <TouchableOpacity style={styles.footerButton} onPress={onComplete} activeOpacity={0.88}>
        <Text style={styles.footerText}>Save App List</Text>
      </TouchableOpacity>

      <TimeLimitModal
        visible={modalVisible}
        appName={activeApp?.appName || ''}
        iconBase64={activeApp?.iconBase64}
        onConfirm={handleConfirmLimit}
        onCancel={() => setModalVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: '#FFFFFF' },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 15 : 15
  },
  headerWrap: { marginBottom: 20 },
  header: { fontSize: 34, lineHeight: 38, color: '#000000', fontWeight: '800' },
  subheader: { fontSize: 14, lineHeight: 19, color: '#8E8E93', marginTop: 6, fontWeight: '500' },
  permissionCard: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#EFEFF4',
    marginBottom: 14
  },
  permissionCopy: { flex: 1, marginRight: 12 },
  permissionTitle: { fontSize: 15, fontWeight: '700', color: '#000000', marginBottom: 3 },
  permissionText: { fontSize: 12, color: '#8E8E93', fontWeight: '500' },
  permissionButton: { backgroundColor: '#111111', paddingVertical: 9, paddingHorizontal: 17, borderRadius: 18 },
  permissionButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  searchBar: {
    height: 42,
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 15,
    borderRadius: 13,
    marginBottom: 16,
    color: '#000000',
    fontSize: 15,
    fontWeight: '500'
  },
  listContent: {
    paddingBottom: 104
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 62,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFF4'
  },
  appLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 14
  },
  appIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    marginRight: 12
  },
  appIconFallback: {
    width: 32,
    height: 32,
    borderRadius: 8,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F2F7'
  },
  appIconFallbackText: {
    fontSize: 13,
    color: '#6E6E73',
    fontWeight: '800'
  },
  appCopy: {
    flex: 1
  },
  appName: { fontSize: 16, fontWeight: '500', color: '#000000' },
  limitText: { fontSize: 12, color: '#6E6E73', fontWeight: '600', marginTop: 3 },
  limitHint: { fontSize: 12, color: '#AEAEB2', fontWeight: '500', marginTop: 3 },
  iosSwitch: {
    width: 52,
    height: 31,
    borderRadius: 16,
    padding: 2,
    borderWidth: 1,
    justifyContent: 'center'
  },
  switchKnob: {
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 2,
    elevation: 2
  },
  footerButton: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 16,
    backgroundColor: '#111111',
    minHeight: 54,
    justifyContent: 'center',
    borderRadius: 27,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 8
  },
  footerText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 }
});
