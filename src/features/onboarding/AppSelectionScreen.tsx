import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, StatusBar } from 'react-native';
import { ScreenTimeService, AppInfo } from '../../services/ScreenTimeService';
import { UserStore } from '../../services/storage';
import { TimeLimitModal } from './TimeLimitModal';

export const AppSelectionScreen = ({ onComplete }: { onComplete: () => void }) => {
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [selectedLimits, setSelectedLimits] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [activeApp, setActiveApp] = useState<AppInfo | null>(null);

  useEffect(() => {
    const loadData = async () => {
      const [allApps, storedLimits] = await Promise.all([
        ScreenTimeService.getInstalledApps(),
        UserStore.getAllLimits()
      ]);
      setApps(allApps);
      setSelectedLimits(storedLimits || {});
      setLoading(false);
    };
    loadData();
  }, []);

  const filteredApps = useMemo(() => {
    return apps.filter(a => a.appName.toLowerCase().includes(search.toLowerCase()));
  }, [search, apps]);

  const handleConfirmLimit = async (minutes: number) => {
    if (activeApp) {
      const updated = { ...selectedLimits, [activeApp.packageName]: minutes };
      setSelectedLimits(updated);
      await UserStore.saveAllLimits(updated);
    }
    setModalVisible(false);
  };

  if (loading) return <ActivityIndicator size="large" color="#111111" style={styles.loading} />;

  return (
    <View style={styles.container}>
      <View style={styles.headerWrap}>
        <Text style={styles.header}>App List</Text>
        <Text style={styles.subheader}>Select apps and choose time constraints.</Text>
      </View>
      <View style={styles.permissionCard}>
        <Text style={styles.permissionTitle}>Usage Access</Text>
        <Text style={styles.permissionText}>Allow access so we can track screen time accurately.</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={ScreenTimeService.openUsageAccessSettings}>
          <Text style={styles.permissionButtonText}>Open Usage Access</Text>
        </TouchableOpacity>
      </View>
      <TextInput
        style={styles.searchBar}
        placeholder="Search for distractions..."
        value={search}
        onChangeText={setSearch}
        placeholderTextColor="#777777"
      />

      <FlatList
        data={filteredApps}
        keyExtractor={(item) => item.packageName}
        initialNumToRender={12}
        windowSize={5}
        renderItem={({ item }) => {
          const limit = selectedLimits[item.packageName];
          return (
            <TouchableOpacity
              style={[styles.item, limit ? styles.selectedItem : null]}
              onPress={() => {
                setActiveApp(item);
                setModalVisible(true);
              }}
            >
              <View>
                <Text style={styles.appName}>{item.appName}</Text>
                {limit ? <Text style={styles.limitText}>{limit} mins</Text> : <Text style={styles.limitHint}>Set limit</Text>}
              </View>
              <View style={[styles.radio, limit ? styles.radioActive : null]}>
                {limit ? <Text style={styles.radioText}>{'\u2713'}</Text> : null}
              </View>
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
        onConfirm={handleConfirmLimit}
        onCancel={() => setModalVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: '#F5F6F9' },
  container: {
    flex: 1,
    backgroundColor: '#F5F6F9',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 12 : 16
  },
  headerWrap: { marginBottom: 12 },
  header: { fontSize: 22, color: '#1C1C1E', fontWeight: '700' },
  subheader: { fontSize: 12, color: '#6E6E73', marginTop: 6 },
  permissionCard: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E7E7EC'
  },
  permissionTitle: { fontSize: 15, fontWeight: '700', color: '#1C1C1E', marginBottom: 4 },
  permissionText: { fontSize: 12, color: '#4A4A4A', marginBottom: 10 },
  permissionButton: { alignSelf: 'flex-start', backgroundColor: '#111111', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12 },
  permissionButtonText: { color: '#FFF', fontWeight: '700', fontSize: 12 },
  searchBar: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
    color: '#111111',
    borderWidth: 1,
    borderColor: '#E7E7EC'
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E7E7EC'
  },
  selectedItem: { backgroundColor: '#F2F3F6', borderColor: '#111111' },
  appName: { fontSize: 15, fontWeight: '600', color: '#111111' },
  limitText: { fontSize: 12, color: '#111111', fontWeight: '700', marginTop: 4 },
  limitHint: { fontSize: 12, color: '#777777', marginTop: 4 },
  radio: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: '#8A8A8A', alignItems: 'center', justifyContent: 'center' },
  radioActive: { backgroundColor: '#111111', borderColor: '#111111' },
  radioText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  footerButton: {
    backgroundColor: '#111111',
    paddingVertical: 18,
    borderRadius: 22,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 12
  },
  footerText: { color: '#FFF', fontWeight: '700', fontSize: 16 }
});
