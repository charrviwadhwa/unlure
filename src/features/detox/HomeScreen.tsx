import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, SafeAreaView, Image } from 'react-native';

interface HomeScreenProps {
  userName: string;
  onPressStreak: () => void;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ userName, onPressStreak }) => {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        
        {/* 1. Header with Avatar & Streak */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greeting}>Hi, {userName}!</Text>
            <Text style={styles.dateText}>Today is February 5, 2026</Text>
          </View>
          <TouchableOpacity 
                style={styles.streakContainer} 
                onPress={onPressStreak} // This prop comes from App.tsx
                activeOpacity={0.7}
            >
            <Text style={styles.streakText}>🔥 50</Text>
          </TouchableOpacity>
        </View>

        {/* 2. Calm Banner (Breathing Exercise) */}
        <TouchableOpacity style={styles.calmBanner} activeOpacity={0.9}>
          <View style={styles.bannerTextContent}>
            <Text style={styles.bannerTitle}>Need immediate calm?</Text>
            <Text style={styles.bannerSubtitle}>BREATHING EXERCISE • 3 MINUTES</Text>
          </View>
          <View style={styles.playButton}>
             <Text style={styles.playIcon}>▶</Text>
          </View>
        </TouchableOpacity>

        {/* 3. Daily Affirmation Card */}
        <View style={styles.affirmationCard}>
          <Text style={styles.sectionLabel}>DAILY AFFIRMATION</Text>
          <Text style={styles.quoteIcon}>“</Text>
          <Text style={styles.affirmationText}>
            Even when the path feels uncertain, trust that each small step is moving you forward. You are allowed to grow quietly, gently, and in your own time.
          </Text>
          <Text style={styles.authorText}>Alan Kooper, psychologist</Text>
        </View>

        {/* 4. Start Detox Action */}
        <TouchableOpacity style={styles.mainActionBtn}>
           <Text style={styles.mainActionText}>Start Digital Detox</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* 5. Bottom Tab Bar Placeholder */}
      <View style={styles.bottomTab}>
        <Text style={styles.tabItem}>🏠</Text>
        <Text style={styles.tabItem}>💬</Text>
        <Text style={styles.tabItem}>🌬️</Text>
        <Text style={styles.tabItem}>⚙️</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EBE6DF' },
  content: { padding: 20 },
  headerRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 20
  },
  greeting: { fontSize: 28, fontWeight: '700', color: '#2D2D2D', fontFamily: 'serif' },
  dateText: { fontSize: 14, color: '#8E8E8E', marginTop: 4 },
  streakContainer: { 
    backgroundColor: '#FFFFFF', 
    paddingHorizontal: 15, 
    paddingVertical: 8, 
    borderRadius: 20 
  },
  streakText: { fontWeight: '700', color: '#2D2D2D' },
  
  calmBanner: {
    backgroundColor: '#F2D8B3', // Soft peach/orange from image
    borderRadius: 30,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
  },
  bannerTextContent: { flex: 1 },
  bannerTitle: { fontSize: 18, fontWeight: '700', color: '#634E34' },
  bannerSubtitle: { fontSize: 11, color: '#8C7356', marginTop: 5, letterSpacing: 1 },
  playButton: { 
    backgroundColor: '#FFFFFF', 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  playIcon: { color: '#634E34', fontSize: 14 },

  affirmationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 35,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 3,
  },
  sectionLabel: { fontSize: 12, color: '#A0A0A0', letterSpacing: 2, marginBottom: 15 },
  quoteIcon: { fontSize: 60, color: '#2D2D2D', lineHeight: 60, marginBottom: -10 },
  affirmationText: { 
    fontSize: 18, 
    color: '#2D2D2D', 
    textAlign: 'center', 
    lineHeight: 28,
    fontFamily: 'serif'
  },
  authorText: { fontSize: 13, color: '#8E8E8E', marginTop: 20 },

  mainActionBtn: {
    backgroundColor: '#8E9473',
    paddingVertical: 20,
    borderRadius: 25,
    marginTop: 30,
    alignItems: 'center'
  },
  mainActionText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },

  bottomTab: {
    height: 70,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30
  },
  tabItem: { fontSize: 24 }
});

export default HomeScreen;