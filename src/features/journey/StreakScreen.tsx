import React from 'react';
import { StyleSheet, View, Text, SafeAreaView, TouchableOpacity, FlatList } from 'react-native';

interface StreakScreenProps {
  onBack: () => void;
}

const calendarData = [
  { day: 1, mood: '😐' }, { day: 2, mood: '☹️' }, { day: 3, mood: '😊' },
  { day: 4, mood: '😊' }, { day: 5, mood: '😊' }, { day: 6, mood: '😊' },
  { day: 7, mood: '😊' }, { day: 8, mood: '😊' }, { day: 9, mood: '😊' },
  { day: 10, mood: '😊' }, { day: 11, mood: '😐' }, { day: 12, mood: '😐' },
  { day: 13, mood: '😴' }, { day: 14, mood: '😊' }, { day: 15, mood: '☹️' },
  { day: 16, mood: '😊' }, { day: 17, mood: '😊' }, { day: 18, mood: '😐' },
  { day: 19, mood: '😊' }, { day: 20, mood: '😴' }, { day: 21, mood: '😊' },
  { day: 22, mood: '☹️' }, { day: 23, mood: '🔥' }, { day: 24, mood: '' },
  { day: 25, mood: '' }, { day: 26, mood: '' }, { day: 27, mood: '' },
];

const StreakScreen: React.FC<StreakScreenProps> = ({ onBack }) => {
  const renderItem = ({ item }: { item: typeof calendarData[0] }) => (
    <View style={styles.dayCell}>
      <View style={[styles.circle, item.mood ? styles.filledCircle : styles.emptyCircle]}>
        {/* Only render if mood isn't empty to avoid "Text strings..." crash */}
        {item.mood !== '' && <Text style={styles.moodEmoji}>{item.mood}</Text>}
      </View>
      <Text style={styles.dayNumber}>{item.day}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backArrow}>←</Text> 
        </TouchableOpacity>
        <Text style={styles.title}>Daily streak</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.streakHero}>
        <Text style={styles.streakNumber}>🔥 50</Text>
        <Text style={styles.streakSub}>Every day counts towards your goal</Text>
      </View>

      <View style={styles.gridContainer}>
        <View style={styles.daysHeader}>
          {['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'].map(d => (
            <Text key={d} style={styles.dayLabel}>{d}</Text>
          ))}
        </View>
        <FlatList
          data={calendarData}
          renderItem={renderItem}
          keyExtractor={item => item.day.toString()}
          numColumns={7}
          scrollEnabled={false}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F2ED' },
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 25, alignItems: 'center' },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backArrow: { fontSize: 30, color: '#2D2D2D', fontWeight: '300' },
  title: { fontSize: 24, fontWeight: '700', color: '#2D2D2D', fontFamily: 'serif' },
  streakHero: { alignItems: 'center', marginVertical: 20 },
  streakNumber: { fontSize: 50, fontWeight: '700', color: '#2D2D2D' },
  streakSub: { color: '#8E8E8E', marginTop: 10, fontSize: 14 },
  gridContainer: { backgroundColor: '#FFFFFF', marginHorizontal: 20, borderRadius: 30, padding: 20, elevation: 3 },
  daysHeader: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 15 },
  dayLabel: { fontSize: 12, color: '#A0A0A0', fontWeight: '600' },
  dayCell: { flex: 1, alignItems: 'center', marginBottom: 15 },
  circle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 5 },
  filledCircle: { backgroundColor: '#FFF9E6' },
  emptyCircle: { backgroundColor: '#F2F2F2' },
  moodEmoji: { fontSize: 20 },
  dayNumber: { fontSize: 12, color: '#8E8E8E' }
});

export default StreakScreen;