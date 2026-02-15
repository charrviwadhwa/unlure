import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
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

  if (loading) return <ActivityIndicator size="large" color="#111111" style={{ flex: 1 }} />;

  return (
    <View style={styles.container}>
      <View style={styles.headerWrap}>
        <Text style={styles.header}>Choose Focus Apps</Text>
        <Text style={styles.subheader}>Pick the apps that distract you most and set limits.</Text>
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

      <TouchableOpacity style={styles.footerButton} onPress={onComplete}>
        <Text style={styles.footerText}>Save & Start {'\u{1F525}'}</Text>
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
  container: { flex: 1, backgroundColor: '#F5F5F5', padding: 20 },
  headerWrap: { marginBottom: 12 },
  header: { fontSize: 26, fontWeight: '700', color: '#111111' },
  subheader: { fontSize: 13, color: '#4A4A4A', marginTop: 6 },
  permissionCard: { backgroundColor: '#FFF', padding: 14, borderRadius: 16, marginBottom: 12, elevation: 2 },
  permissionTitle: { fontSize: 14, fontWeight: '700', color: '#111111', marginBottom: 4 },
  permissionText: { fontSize: 12, color: '#4A4A4A', marginBottom: 10 },
  permissionButton: { alignSelf: 'flex-start', backgroundColor: '#111111', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  permissionButtonText: { color: '#FFF', fontWeight: '600', fontSize: 12 },
  searchBar: { backgroundColor: '#FFF', padding: 14, borderRadius: 14, marginBottom: 12, elevation: 2, color: '#111111' },
  item: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#FFF', borderRadius: 18, marginBottom: 10 },
  selectedItem: { backgroundColor: '#EDEDED', borderColor: '#111111', borderWidth: 1 },
  appName: { fontSize: 15, fontWeight: '600', color: '#111111' },
  limitText: { fontSize: 12, color: '#111111', fontWeight: '700', marginTop: 4 },
  limitHint: { fontSize: 12, color: '#777777', marginTop: 4 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#8A8A8A', alignItems: 'center', justifyContent: 'center' },
  radioActive: { backgroundColor: '#111111', borderColor: '#111111' },
  radioText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  footerButton: { backgroundColor: '#111111', padding: 18, borderRadius: 18, alignItems: 'center', marginTop: 6 },
  footerText: { color: '#FFF', fontWeight: '700' }
});
