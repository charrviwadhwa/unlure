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
  const [footerHeight, setFooterHeight] = useState(0);
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

  const syncFocusMode = useCallback(async (limits: Record<string, number>) => {
    const appNames = apps.reduce<Record<string, string>>((acc, app) => {
      acc[app.packageName] = app.appName;
      return acc;
    }, {});
    await ScreenTimeService.syncFocusModeConfig(limits, appNames);
  }, [apps]);

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
      await syncFocusMode(updated);
    }
    setModalVisible(false);
  };

  const removeLimit = async (packageName: string) => {
    const updated = { ...selectedLimits };
    delete updated[packageName];
    setSelectedLimits(updated);
    await UserStore.saveAllLimits(updated);
    await syncFocusMode(updated);
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
        contentContainerStyle={[styles.listContent, { paddingBottom: footerHeight + 34 }]}
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

      <View
        pointerEvents="box-none"
        style={styles.footerWrap}
        onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
      >
        <TouchableOpacity
          style={styles.footerButton}
          onPress={async () => {
            await syncFocusMode(selectedLimits);
            onComplete();
          }}
          activeOpacity={0.88}
        >
          <Text style={styles.footerText}>Save App List</Text>
        </TouchableOpacity>
      </View>

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
    paddingTop: Platform.OS === 'android' ? Math.max((StatusBar.currentHeight ?? 0) + 34, 58) : 18
  },
  headerWrap: { marginBottom: 16, paddingRight: 18 },
  header: { fontSize: 32, lineHeight: 36, color: '#000000', fontWeight: '800' },
  subheader: { fontSize: 14, lineHeight: 19, color: '#8E8E93', marginTop: 6, fontWeight: '500' },
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
    paddingBottom: 18
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
  footerWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'android' ? 22 : 18,
    backgroundColor: '#FFFFFF'
  },
  footerButton: {
    backgroundColor: '#1C1C1E',
    minHeight: 54,
    justifyContent: 'center',
    borderRadius: 27,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4
  },
  footerText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 }
});
