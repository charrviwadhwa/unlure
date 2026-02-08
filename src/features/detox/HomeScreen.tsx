import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, RefreshControl } from 'react-native';
import PieChart from 'react-native-pie-chart';
import { ScreenTimeService, AppUsage, DailyUsageMap } from '../../services/ScreenTimeService';
import { UserStore } from '../../services/storage';

export const HomeScreen = () => {
  const [usageData, setUsageData] = useState<AppUsage[]>([]);
  const [totalMins, setTotalMins] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [limits, setLimits] = useState<Record<string, number>>({});
  const [overallMood, setOverallMood] = useState('\u{1F642}');
  const [activeRange, setActiveRange] = useState<'day' | 'week' | 'month'>('day');
  const [showPercent, setShowPercent] = useState(false);
  const [dailyMoods, setDailyMoods] = useState<Record<string, string>>({});
  const [storedDailyStats, setStoredDailyStats] = useState<DailyUsageMap>({});
  const [monthLabel, setMonthLabel] = useState('');
  const [monthDays, setMonthDays] = useState<Array<{ key: string; day: number | null; mood: string }>>([]);
  const [monthDate, setMonthDate] = useState(new Date());

  const formatDateKey = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const formatDisplayDate = (date: Date) => {
    const month = date.toLocaleString('en-US', { month: 'long' });
    return `${date.getDate()} ${month}, ${date.getFullYear()}`;
  };

  const buildWeek = (date: Date) => {
    const start = new Date(date);
    start.setDate(date.getDate() - date.getDay()); // Sunday start
    const labels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d.getDate();
    });
    const dateObjects = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
    return { labels, dates, dateObjects };
  };

  const getMoodForDate = (dateKey: string, dailyStats: DailyUsageMap, limitsMap: Record<string, number>, savedMood?: string) => {
    if (savedMood && savedMood.length > 0) return savedMood;
    const dayMap = dailyStats[dateKey];
    if (!dayMap) return '';
    const totalLimit = Object.keys(limitsMap || {}).reduce((acc, pkg) => acc + (limitsMap[pkg] || 0), 0);
    if (totalLimit === 0) return '';
    const totalLimitedUsage = Object.keys(dayMap).reduce((acc, pkg) => {
      const limit = limitsMap[pkg];
      return limit ? acc + Math.floor(dayMap[pkg] / 60000) : acc;
    }, 0);
    return totalLimitedUsage > totalLimit ? '\u{1F62D}' : '\u{1F525}';
  };

  const buildMonth = (date: Date, moods: Record<string, string>, dailyStats: DailyUsageMap, limitsMap: Record<string, number>) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const startWeekday = first.getDay();
    const totalDays = last.getDate();
    const items: Array<{ key: string; day: number | null; mood: string }> = [];

    for (let i = 0; i < startWeekday; i += 1) {
      items.push({ key: `blank-${i}`, day: null, mood: '' });
    }
    for (let day = 1; day <= totalDays; day += 1) {
      const dateKey = formatDateKey(new Date(year, month, day));
      const mood = getMoodForDate(dateKey, dailyStats, limitsMap, moods[dateKey]);
      items.push({ key: dateKey, day, mood });
    }
    return items;
  };

  // Updated formatting: 197m -> 3h 17m
  const formatTime = (totalMinutes: number) => {
    const h = Math.floor(totalMinutes / 60);
    const m = Math.round(totalMinutes % 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const loadData = async () => {
    setRefreshing(true);

    const [_, stored, storedLimits] = await Promise.all([
      ScreenTimeService.storeTodayStats(),
      ScreenTimeService.getStoredDailyStats(),
      UserStore.getAllLimits()
    ]);
    setStoredDailyStats(stored || {});
    setLimits(storedLimits || {});

    const todayKey = formatDateKey(new Date());
    const todayMap = stored[todayKey] || {};

    let stats: AppUsage[] = Object.keys(todayMap).map((pkg) => ({
      id: pkg,
      minutes: Math.floor(todayMap[pkg] / 60000)
    }));

    if (stats.length === 0) {
      stats = await ScreenTimeService.getDailyStats();
    }

    const sortedStats = stats.sort((a, b) => b.minutes - a.minutes);
    setUsageData(sortedStats.slice(0, 4));
    const total = stats.reduce((acc, curr) => acc + curr.minutes, 0);
    setTotalMins(total);

    const totalLimit = Object.keys(storedLimits || {}).reduce((acc, pkg) => acc + (storedLimits[pkg] || 0), 0);
    const totalLimitedUsage = stats.reduce((acc, curr) => {
      const limit = storedLimits?.[curr.id];
      return limit ? acc + curr.minutes : acc;
    }, 0);
    const isOver = totalLimit > 0 && totalLimitedUsage > totalLimit;
    const mood = totalLimit === 0 ? '\u{1F642}' : (isOver ? '\u{1F62D}' : '\u{1F525}');
    setOverallMood(mood);
    await UserStore.saveDailyMood(todayKey, mood);
    await UserStore.updateStreakForDate(todayKey, !isOver);

    const moods = await UserStore.getDailyMoods();
    setDailyMoods(moods);
    const current = new Date();
    setMonthDate(current);
    setMonthLabel(current.toLocaleString('en-US', { month: 'long', year: 'numeric' }));
    setMonthDays(buildMonth(current, moods, stored, storedLimits || {}));
    setRefreshing(false);
  };

  useEffect(() => { loadData(); }, []);

  const colors = ['#B1B4FF', '#FFD1A9', '#A9F4FF', '#FFB1B1']; 
  const series = usageData.map((item, i) => ({ value: item.minutes, color: colors[i] }));
  
  if (series.length === 0) series.push({ value: 1, color: '#F0F0F0' });

  const today = new Date();
  const week = buildWeek(today);
  const weekLabels = week.labels;
  const weekDates = week.dates;
  const weekDateObjects = week.dateObjects;
  const activeDate = today.getDate();

  const totalLimit = Object.keys(limits || {}).reduce((acc, pkg) => acc + (limits[pkg] || 0), 0);
  const dailyLimitedUsage = usageData.reduce((acc, curr) => {
    const limit = limits[curr.id];
    return limit ? acc + curr.minutes : acc;
  }, 0);

  const weekUsageMap: Record<string, number> = {};
  weekDateObjects.forEach((dateObj) => {
    const key = formatDateKey(dateObj);
    const dayMap = storedDailyStats[key];
    if (!dayMap) return;
    Object.keys(dayMap).forEach((pkg) => {
      const minutes = Math.floor(dayMap[pkg] / 60000);
      weekUsageMap[pkg] = (weekUsageMap[pkg] || 0) + minutes;
    });
  });
  const weekStats = Object.keys(weekUsageMap).map((pkg) => ({ id: pkg, minutes: weekUsageMap[pkg] }));
  const weekSorted = weekStats.sort((a, b) => b.minutes - a.minutes);
  const weekUsageData = weekSorted.slice(0, 4);
  const weekTotalMins = weekStats.reduce((acc, curr) => acc + curr.minutes, 0);
  const weekLimitedUsage = weekStats.reduce((acc, curr) => (limits[curr.id] ? acc + curr.minutes : acc), 0);

  const isWeek = activeRange === 'week';
  const displayUsageData = isWeek ? weekUsageData : usageData;
  const displayTotalMins = isWeek ? weekTotalMins : totalMins;
  const displayLimitedUsage = isWeek ? weekLimitedUsage : dailyLimitedUsage;
  const limitMultiplier = isWeek ? 7 : 1;
  const percent = totalLimit > 0
    ? Math.min(Math.round((displayLimitedUsage / (totalLimit * limitMultiplier)) * 100), 100)
    : Math.min(Math.round((displayTotalMins / (24 * 60 * limitMultiplier)) * 100), 100);

  const monthWeekLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const changeMonth = (delta: number) => {
    const next = new Date(monthDate);
    next.setMonth(next.getMonth() + delta);
    setMonthDate(next);
    setMonthLabel(next.toLocaleString('en-US', { month: 'long', year: 'numeric' }));
    setMonthDays(buildMonth(next, dailyMoods, storedDailyStats, limits));
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} />}
      >
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Analytics</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.iconButton}>
                <View style={styles.iconBell} />
                <View style={styles.notificationDot} />
              </TouchableOpacity>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>CW</Text>
              </View>
            </View>
          </View>

          <View style={styles.tabBar}>
            <TouchableOpacity style={activeRange === 'day' ? styles.activeTab : styles.tab} onPress={() => setActiveRange('day')}>
              <Text style={activeRange === 'day' ? styles.activeTabText : styles.tabText}>Day</Text>
            </TouchableOpacity>
            <TouchableOpacity style={activeRange === 'week' ? styles.activeTab : styles.tab} onPress={() => setActiveRange('week')}>
              <Text style={activeRange === 'week' ? styles.activeTabText : styles.tabText}>Week</Text>
            </TouchableOpacity>
            <TouchableOpacity style={activeRange === 'month' ? styles.activeTab : styles.tab} onPress={() => setActiveRange('month')}>
              <Text style={activeRange === 'month' ? styles.activeTabText : styles.tabText}>Month</Text>
            </TouchableOpacity>
          </View>
        </View>

        {activeRange !== 'month' && (
          <View style={styles.calendarCard}>
            <View style={styles.calendarHeader}>
              <View style={styles.moodCircle}>
                <Text style={styles.moodText}>{overallMood}</Text>
              </View>
              <Text style={styles.calendarDate}>{formatDisplayDate(today)}</Text>
            </View>

            <View style={styles.calendarWeek}>
              {weekLabels.map((label) => (
                <Text key={label} style={styles.weekLabel}>{label}</Text>
              ))}
            </View>

            <View style={styles.calendarDates}>
              {weekDates.map((date, idx) => {
                const dateObj = weekDateObjects[idx];
                const dateKey = formatDateKey(dateObj);
                const mood = getMoodForDate(dateKey, storedDailyStats, limits, dailyMoods[dateKey]);
                return (
                  <View key={dateKey} style={[styles.dateCircle, date === activeDate && styles.activeDate]}>
                    {mood ? (
                      <Text style={styles.dateEmoji}>{mood}</Text>
                    ) : (
                      <Text style={[styles.dateText, date === activeDate && styles.activeDateText]}>{date}</Text>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {activeRange === 'month' && (
          <View style={styles.monthCard}>
            <View style={styles.monthHeader}>
              <TouchableOpacity style={styles.monthArrow} onPress={() => changeMonth(-1)}>
                <Text style={styles.monthArrowText}>{'\u2039'}</Text>
              </TouchableOpacity>
              <Text style={styles.monthTitle}>{monthLabel}</Text>
              <TouchableOpacity style={styles.monthArrow} onPress={() => changeMonth(1)}>
                <Text style={styles.monthArrowText}>{'\u203A'}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.monthWeekRow}>
              {monthWeekLabels.map((d) => (
                <Text key={d} style={styles.monthWeekLabel}>{d}</Text>
              ))}
            </View>
            <View style={styles.monthGrid}>
              {monthDays.map((item) => (
                <View key={item.key} style={styles.monthCell}>
                  <View style={[styles.monthCircle, item.mood ? styles.monthFilled : styles.monthEmpty]}>
                    {item.mood ? <Text style={styles.monthEmoji}>{item.mood}</Text> : null}
                  </View>
                  {item.day ? <Text style={styles.monthDay}>{item.day}</Text> : null}
                </View>
              ))}
            </View>
          </View>
        )}

        {activeRange !== 'month' && (
          <View style={styles.analyticsCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{isWeek ? 'Weekly Average' : 'Daily Average'}</Text>
              <View style={styles.toggle}>
                <TouchableOpacity style={showPercent ? styles.toggleItem : styles.toggleActive} onPress={() => setShowPercent(false)}>
                  <Text style={showPercent ? styles.toggleText : styles.toggleActiveText}>Time</Text>
                </TouchableOpacity>
                <TouchableOpacity style={showPercent ? styles.toggleActive : styles.toggleItem} onPress={() => setShowPercent(true)}>
                  <Text style={showPercent ? styles.toggleActiveText : styles.toggleText}>Percents</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.chartContainer}>
              <PieChart 
                widthAndHeight={260} 
                series={displayUsageData.length > 0 ? displayUsageData.map((item, i) => ({ value: item.minutes, color: colors[i] })) : series}
                cover={0.7} 
                padAngle={0.05} // Gaps between segments
              />
              <View style={styles.chartCenter}>
                <Text style={styles.centerTime}>{showPercent ? `${percent}%` : formatTime(displayTotalMins)}</Text>
                <Text style={styles.centerSub}>{showPercent ? 'Of Limit' : (isWeek ? 'Total This Week' : 'Total Today')}</Text>
              </View>
            </View>

            <View style={styles.appList}>
              {displayUsageData.map((item, i) => (
                <View key={item.id} style={styles.appRow}>
                  <View style={[styles.dot, { backgroundColor: colors[i] }]} />
                  <Text style={styles.appName}>{item.id.split('.').pop()}</Text>
                  <Text style={[styles.appTime, limits[item.id] && item.minutes > limits[item.id] ? styles.overLimit : null]}>
                    {formatTime(item.minutes)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F7FB' },
  header: { paddingHorizontal: 24, paddingTop: 18, paddingBottom: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  title: { fontSize: 24, fontWeight: '700', color: '#1C1C1E' },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  iconButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', marginRight: 12, elevation: 2 },
  iconBell: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: '#1C1C1E' },
  notificationDot: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: '#A0A7FF', top: 7, right: 8 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E8EAFF', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontWeight: '700', color: '#4B4B4B', fontSize: 12 },

  tabBar: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 24, padding: 4, elevation: 2 },
  activeTab: { flex: 1, backgroundColor: '#1C1C1E', paddingVertical: 10, borderRadius: 20, alignItems: 'center' },
  activeTabText: { color: '#FFF', fontWeight: '600' },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  tabText: { color: '#8E8E93', fontWeight: '500' },

  calendarCard: { backgroundColor: '#FFFFFF', marginHorizontal: 20, marginTop: 8, borderRadius: 28, padding: 20, elevation: 3 },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  moodCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#C8D2FF', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  moodText: { fontWeight: '700', color: '#1C1C1E', fontSize: 12 },
  calendarDate: { fontSize: 16, fontWeight: '600', color: '#1C1C1E' },
  calendarWeek: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, paddingHorizontal: 4 },
  weekLabel: { color: '#8E8E93', fontSize: 12, width: 28, textAlign: 'center' },
  calendarDates: { flexDirection: 'row', justifyContent: 'space-between' },
  dateCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F2F3F7', justifyContent: 'center', alignItems: 'center' },
  dateEmoji: { fontSize: 14 },
  dateText: { color: '#1C1C1E', fontWeight: '600', fontSize: 12 },
  activeDate: { backgroundColor: '#C8D2FF' },
  activeDateText: { color: '#1C1C1E' },

  analyticsCard: { backgroundColor: '#FFF', marginHorizontal: 20, marginTop: 16, borderRadius: 32, padding: 24, elevation: 4, marginBottom: 24 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#1C1C1E' },
  toggle: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F2F3F7', borderRadius: 18, padding: 3 },
  toggleText: { fontSize: 12, color: '#8E8E93', marginHorizontal: 8, fontWeight: '600' },
  toggleActive: { backgroundColor: '#1C1C1E', borderRadius: 14, paddingVertical: 6, paddingHorizontal: 10 },
  toggleActiveText: { color: '#FFFFFF', fontWeight: '600', fontSize: 12 },
  toggleItem: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 14 },

  chartContainer: { justifyContent: 'center', alignItems: 'center', position: 'relative', marginTop: 10 },
  chartCenter: { position: 'absolute', alignItems: 'center' },
  centerTime: { fontSize: 28, fontWeight: '700', color: '#1C1C1E' },
  centerSub: { fontSize: 12, color: '#8E8E93', marginTop: 4 },
  appList: { marginTop: 24 },
  appRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  dot: { width: 12, height: 12, borderRadius: 6, marginRight: 12 },
  appName: { flex: 1, fontSize: 14, fontWeight: '600', textTransform: 'capitalize', color: '#2C2C2E' },
  appTime: { fontSize: 14, fontWeight: '700', color: '#1C1C1E' },
  overLimit: { color: '#D74B4B' },

  monthCard: { backgroundColor: '#FFFFFF', marginHorizontal: 20, marginTop: 12, borderRadius: 28, padding: 18, elevation: 3, marginBottom: 20 },
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  monthTitle: { fontSize: 16, fontWeight: '600', color: '#1C1C1E' },
  monthArrow: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F2F3F7', justifyContent: 'center', alignItems: 'center' },
  monthArrowText: { fontSize: 18, color: '#1C1C1E' },
  monthWeekRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  monthWeekLabel: { fontSize: 11, color: '#8E8E93', width: 28, textAlign: 'center' },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  monthCell: { width: '14.2857%', alignItems: 'center', marginBottom: 10 },
  monthCircle: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  monthFilled: { backgroundColor: '#FFF9E6' },
  monthEmpty: { backgroundColor: '#F2F2F2' },
  monthEmoji: { fontSize: 18 },
  monthDay: { fontSize: 11, color: '#8E8E8E' }
});
