import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { ScreenTimeService } from '../../services/ScreenTimeService';
import { UserStore } from '../../services/storage';
import { TimeLimitModal } from './TimeLimitModal';

interface AppInfo {
  appName: string;
  packageName: string;
}

export const AppSelectionScreen = ({ onComplete }: { onComplete: () => void }) => {
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [filteredApps, setFilteredApps] = useState<AppInfo[]>([]);
  const [selectedLimits, setSelectedLimits] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [activeApp, setActiveApp] = useState<AppInfo | null>(null);

  useEffect(() => {
    const loadApps = async () => {
      const allApps = await ScreenTimeService.getInstalledApps();
      const storedLimits = await UserStore.getAllLimits();
      setApps(allApps);
      setFilteredApps(allApps);
      setSelectedLimits(storedLimits);
      setLoading(false);
    };
    loadApps();
  }, []);

  const handleConfirmLimit = async (minutes: number) => {
    if (activeApp) {
      const updated = { ...selectedLimits, [activeApp.packageName]: minutes };
      setSelectedLimits(updated);
      await UserStore.saveAllLimits(updated); // Persistent save
    }
    setModalVisible(false);
  };

  const handleSearch = (text: string) => {
    setSearch(text);
    setFilteredApps(apps.filter(a => a.appName.toLowerCase().includes(text.toLowerCase())));
  };

  if (loading) return <ActivityIndicator size="large" color="#000" style={{ flex: 1 }} />;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Select Distracting Apps</Text>
      <TextInput 
        style={styles.searchBar} 
        placeholder="Search apps..." 
        value={search} 
        onChangeText={handleSearch} 
      />
      
      <FlatList
        data={filteredApps}
        keyExtractor={(item) => item.packageName}
        renderItem={({ item }) => {
          const limit = selectedLimits[item.packageName];
          return (
            <TouchableOpacity 
              style={[styles.item, limit ? styles.selectedItem : undefined]} // Fixed style error
              onPress={() => { setActiveApp(item); setModalVisible(true); }}
            >
              <View>
                <Text style={styles.appName}>{item.appName}</Text>
                {limit ? <Text style={styles.limitText}>{limit} mins set</Text> : null}
              </View>
              <Text style={styles.icon}>{limit ? '✅' : '〉'}</Text>
            </TouchableOpacity>
          );
        }}
      />

      <TimeLimitModal 
        visible={modalVisible}
        appName={activeApp?.appName || ''}
        onConfirm={handleConfirmLimit}
        onCancel={() => setModalVisible(false)}
      />

      <TouchableOpacity style={styles.footerButton} onPress={onComplete}>
        <Text style={styles.footerText}>Continue 🔥</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F2ED', padding: 20 },
  header: { fontSize: 26, fontWeight: '800', marginBottom: 20 },
  searchBar: { backgroundColor: '#FFF', padding: 15, borderRadius: 15, marginBottom: 15, elevation: 2 },
  item: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, backgroundColor: '#FFF', borderRadius: 18, marginBottom: 12 },
  selectedItem: { backgroundColor: '#E8EADF', borderColor: '#8E9473', borderWidth: 1.5 },
  appName: { fontSize: 17, fontWeight: '600' },
  limitText: { fontSize: 13, color: '#8E9473', fontWeight: 'bold', marginTop: 4 },
  icon: { fontSize: 18, color: '#DDD' },
  footerButton: { backgroundColor: '#000', padding: 20, borderRadius: 20, alignItems: 'center', marginTop: 10 },
  footerText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 }
});