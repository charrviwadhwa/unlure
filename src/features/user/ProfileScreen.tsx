import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native';
import { UserStore } from '../../services/storage';

interface ProfileScreenProps {
  userName: string;
  onOpenLimits: () => void;
  onLogout: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ userName, onOpenLimits, onLogout }) => {
  const [name, setName] = useState(userName);

  useEffect(() => {
    const load = async () => {
      const storedName = await UserStore.getName();
      setName(storedName);
    };
    load();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.avatar} />
          <Text style={styles.name}>{name || 'Guest'}</Text>
          <Text style={styles.email}>user@unlure.app</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <TouchableOpacity style={styles.row} onPress={onOpenLimits}>
            <Text style={styles.rowText}>App Limits</Text>
            <Text style={styles.rowArrow}>{'\u203A'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          <TouchableOpacity style={styles.row}>
            <Text style={styles.rowText}>FAQ</Text>
            <Text style={styles.rowArrow}>{'\u203A'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.row}>
            <Text style={styles.rowText}>Contact Support</Text>
            <Text style={styles.rowArrow}>{'\u203A'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.row}>
            <Text style={styles.rowText}>Rate the App</Text>
            <Text style={styles.rowArrow}>{'\u203A'}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  content: { paddingBottom: 90 },
  header: { alignItems: 'center', paddingTop: 24, paddingBottom: 18 },
  avatar: { width: 92, height: 92, borderRadius: 46, backgroundColor: '#E2E2E2', marginBottom: 12 },
  name: { fontSize: 22, fontWeight: '700', color: '#111111' },
  email: { fontSize: 13, color: '#4A4A4A', marginTop: 6 },

  section: { marginTop: 18, marginHorizontal: 20, backgroundColor: '#FFFFFF', borderRadius: 20, paddingVertical: 6, elevation: 2 },
  sectionTitle: { paddingHorizontal: 16, paddingVertical: 10, fontSize: 12, color: '#5B5B5B', fontWeight: '600' },
  row: { paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowText: { fontSize: 15, color: '#111111', fontWeight: '600' },
  rowArrow: { fontSize: 20, color: '#9A9A9A' },

  logoutButton: { marginTop: 24, marginHorizontal: 20, borderRadius: 16, borderWidth: 1, borderColor: '#111111', paddingVertical: 14, alignItems: 'center' },
  logoutText: { color: '#111111', fontWeight: '700' }
});
