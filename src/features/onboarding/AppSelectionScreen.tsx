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

  if (loading) return <ActivityIndicator size="large" color="#B1B4FF" style={{ flex: 1 }} />;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Focus Apps</Text>
      <TextInput 
        style={styles.searchBar} 
        placeholder="Search for distractions..." 
        value={search} 
        onChangeText={setSearch} 
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
              onPress={() => { setActiveApp(item); setModalVisible(true); }}
            >
              <View>
                <Text style={styles.appName}>{item.appName}</Text>
                {limit ? <Text style={styles.limitText}>{limit} mins</Text> : null}
              </View>
              <Text style={styles.icon}>{limit ? '✅' : '〉'}</Text>
            </TouchableOpacity>
          );
        }}
      />

      <TouchableOpacity style={styles.footerButton} onPress={onComplete}>
        <Text style={styles.footerText}>Save & Start 🔥</Text>
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
  container: { flex: 1, backgroundColor: '#F9F9FB', padding: 20 },
  header: { fontSize: 28, fontWeight: 'bold', marginBottom: 20 },
  searchBar: { backgroundColor: '#FFF', padding: 15, borderRadius: 15, marginBottom: 15, elevation: 2 },
  item: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, backgroundColor: '#FFF', borderRadius: 20, marginBottom: 12 },
  selectedItem: { backgroundColor: '#EEF0FF', borderColor: '#B1B4FF', borderWidth: 1 },
  appName: { fontSize: 16, fontWeight: '600' },
  limitText: { fontSize: 12, color: '#B1B4FF', fontWeight: 'bold', marginTop: 4 },
  icon: { fontSize: 18, color: '#DDD' },
  footerButton: { backgroundColor: '#1A1A1A', padding: 20, borderRadius: 20, alignItems: 'center' },
  footerText: { color: '#FFF', fontWeight: 'bold' }
});