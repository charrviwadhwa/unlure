import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, SafeAreaView, TouchableOpacity, FlatList } from 'react-native';
import { UserStore } from '../../services/storage';

interface StreakScreenProps {
  onBack: () => void;
}

interface CalendarItem {
  key: string;
  day: number | null;
  mood: string;
}

const StreakScreen: React.FC<StreakScreenProps> = ({ onBack }) => {
  const [calendarData, setCalendarData] = useState<CalendarItem[]>([]);
  const [streak, setStreak] = useState(0);

  const formatDateKey = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const buildMonthGrid = (date: Date, moods: Record<string, string>) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const startWeekday = first.getDay();
    const totalDays = last.getDate();

    const items: CalendarItem[] = [];
    for (let i = 0; i < startWeekday; i += 1) {
      items.push({ key: `blank-${i}`, day: null, mood: '' });
    }
    for (let day = 1; day <= totalDays; day += 1) {
      const dateKey = formatDateKey(new Date(year, month, day));
      items.push({ key: dateKey, day, mood: moods[dateKey] || '' });
    }
    return items;
  };

  useEffect(() => {
    const load = async () => {
      const [moods, currentStreak] = await Promise.all([
        UserStore.getDailyMoods(),
        UserStore.getStreak()
      ]);
      setCalendarData(buildMonthGrid(new Date(), moods));
      setStreak(currentStreak);
    };
    load();
  }, []);

  const renderItem = ({ item }: { item: CalendarItem }) => (
    <View style={styles.dayCell}>
      <View style={[styles.circle, item.day ? (item.mood ? styles.filledCircle : styles.emptyCircle) : styles.blankCircle]}>
        {item.mood !== '' && <Text style={styles.moodEmoji}>{item.mood}</Text>}
      </View>
      {item.day ? <Text style={styles.dayNumber}>{item.day}</Text> : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backArrow}>{'\u2190'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Daily streak</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.streakHero}>
        <Text style={styles.streakNumber}>{`\u{1F525} ${streak}`}</Text>
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
          keyExtractor={item => item.key}
          numColumns={7}
          scrollEnabled={false}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F2ED' },
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 50, alignItems: 'center' },
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
  blankCircle: { backgroundColor: 'transparent' },
  moodEmoji: { fontSize: 20 },
  dayNumber: { fontSize: 12, color: '#8E8E8E' }
});

export default StreakScreen;
