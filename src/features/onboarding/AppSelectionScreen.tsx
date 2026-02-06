import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { ScreenTimeService } from '../../services/ScreenTimeService';
import { UserStore } from '../../services/storage';

interface AppInfo {
  appName: string;
  packageName: string;
}

export const AppSelectionScreen = ({ onComplete }: { onComplete: () => void }) => {
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [filteredApps, setFilteredApps] = useState<AppInfo[]>([]);
  const [selectedPackages, setSelectedPackages] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadApps = async () => {
      const allApps = await ScreenTimeService.getInstalledApps();
      const storedLimits = await UserStore.getAllLimits();
      
      setApps(allApps);
      setFilteredApps(allApps);
      setSelectedPackages(new Set(Object.keys(storedLimits)));
      setLoading(false);
    };
    loadApps();
  }, []);

  const toggleApp = (packageName: string) => {
    const newSelected = new Set(selectedPackages);
    if (newSelected.has(packageName)) {
      newSelected.delete(packageName);
    } else {
      newSelected.add(packageName);
    }
    setSelectedPackages(newSelected);
  };

  const handleSearch = (text: string) => {
    setSearch(text);
    const filtered = apps.filter(app => 
      app.appName.toLowerCase().includes(text.toLowerCase())
    );
    setFilteredApps(filtered);
  };

  const saveAndContinue = async () => {
    // Save only the newly selected apps with a default 30m limit
    for (const pkg of selectedPackages) {
      const currentLimits = await UserStore.getAllLimits();
      if (!currentLimits[pkg]) {
        await UserStore.setAppLimit(pkg, 30); 
      }
    }
    onComplete();
  };

  if (loading) return <ActivityIndicator size="large" color="#8E9473" style={{ flex: 1 }} />;

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
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={[styles.item, selectedPackages.has(item.packageName) && styles.selectedItem]}
            onPress={() => toggleApp(item.packageName)}
          >
            <View>
              <Text style={styles.appName}>{item.appName}</Text>
              <Text style={styles.packageName}>{item.packageName}</Text>
            </View>
            <Text style={styles.checkbox}>{selectedPackages.has(item.packageName) ? '✅' : '⬜'}</Text>
          </TouchableOpacity>
        )}
      />
      <TouchableOpacity style={styles.saveButton} onPress={saveAndContinue}>
        <Text style={styles.saveButtonText}>Save & Set Limits</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F2ED', padding: 20 },
  header: { fontSize: 22, fontWeight: '700', marginBottom: 20, color: '#2D2D2D' },
  searchBar: { backgroundColor: '#FFF', padding: 12, borderRadius: 10, marginBottom: 15, elevation: 2 },
  item: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, backgroundColor: '#FFF', borderRadius: 10, marginBottom: 8 },
  selectedItem: { backgroundColor: '#E8EADF', borderColor: '#8E9473', borderWidth: 1 },
  appName: { fontSize: 16, fontWeight: '600' },
  packageName: { fontSize: 12, color: '#888' },
  checkbox: { fontSize: 20 },
  saveButton: { backgroundColor: '#8E9473', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  saveButtonText: { color: '#FFF', fontWeight: '700', fontSize: 16 }
});