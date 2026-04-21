import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, RefreshControl, Animated } from 'react-native';
import PieChart from 'react-native-pie-chart';
import { ScreenTimeService, AppUsage, DailyUsageMap } from '../../services/ScreenTimeService';
import { UserStore } from '../../services/storage';

type RangeType = 'day' | 'week' | 'month';

type MonthCell = {
  key: string;
  day: number | null;
  mood: string;
};

const FONT = {
  title: 'PlayfairDisplay-Bold',
  heading: 'PlayfairDisplay-SemiBold',
  body: 'sans-serif',
  regular: 'sans-serif'
};

const RANGE_LABELS: Record<RangeType, string> = {
  day: 'Day',
  week: 'Week',
  month: 'Month'
};

const MOOD_CIRCLE_COLORS: Record<string, string> = {
  '\u{1F525}': '#BFCBFF',
  '\u{1F62D}': '#FFD9BE'
};

const FALLBACK_MOOD_BG = '#E9EDF7';

export const HomeScreen = () => {
  const [liveTodayUsage, setLiveTodayUsage] = useState<AppUsage[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [limits, setLimits] = useState<Record<string, number>>({});
  const [overallMood, setOverallMood] = useState('\u{1F642}');
  const [activeRange, setActiveRange] = useState<RangeType>('day');
  const [showPercent, setShowPercent] = useState(false);
  const [dailyMoods, setDailyMoods] = useState<Record<string, string>>({});
  const [storedDailyStats, setStoredDailyStats] = useState<DailyUsageMap>({});
  const [monthLabel, setMonthLabel] = useState('');
  const [monthDays, setMonthDays] = useState<MonthCell[]>([]);
  const [monthDate, setMonthDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [appNameMap, setAppNameMap] = useState<Record<string, string>>({});
  const toggleX = useRef(new Animated.Value(0)).current;

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
    start.setHours(0, 0, 0, 0);
    start.setDate(date.getDate() - date.getDay());
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

  const getMoodForDate = (
    dateKey: string,
    dailyStats: DailyUsageMap,
    limitsMap: Record<string, number>,
    savedMood?: string
  ) => {
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

  const buildMonth = (
    date: Date,
    moods: Record<string, string>,
    dailyStats: DailyUsageMap,
    limitsMap: Record<string, number>
  ) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const startWeekday = first.getDay();
    const totalDays = last.getDate();
    const items: MonthCell[] = [];

    for (let i = 0; i < startWeekday; i += 1) {
      items.push({ key: `blank-${i}`, day: null, mood: '' });
    }

    for (let day = 1; day <= totalDays; day += 1) {
      const dateKey = formatDateKey(new Date(year, month, day));
      const mood = getMoodForDate(dateKey, dailyStats, limitsMap, moods[dateKey]);
      items.push({ key: dateKey, day, mood });
    }

    const rem = items.length % 7;
    if (rem !== 0) {
      for (let i = 0; i < 7 - rem; i += 1) {
        items.push({ key: `tail-${i}`, day: null, mood: '' });
      }
    }

    return items;
  };

  const formatTime = (totalMinutes: number) => {
    const h = Math.floor(totalMinutes / 60);
    const m = Math.round(totalMinutes % 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const formatAppName = (pkg: string) => {
    if (appNameMap[pkg]) return appNameMap[pkg];
    const raw = pkg.split('.').pop() || pkg;
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  };

  const loadData = async () => {
    setRefreshing(true);

    await ScreenTimeService.storeTodayStats();
    const [stored, storedLimits, installedApps] = await Promise.all([
      ScreenTimeService.getStoredDailyStats(),
      UserStore.getAllLimits(),
      ScreenTimeService.getInstalledApps()
    ]);
    setStoredDailyStats(stored || {});
    setLimits(storedLimits || {});
    setAppNameMap(installedApps.reduce<Record<string, string>>((acc, app) => {
      acc[app.packageName] = app.appName;
      return acc;
    }, {}));

    const todayKey = formatDateKey(new Date());
    const todayMap = stored[todayKey] || {};

    let stats: AppUsage[] = Object.keys(todayMap).map((pkg) => ({
      id: pkg,
      minutes: Math.floor(todayMap[pkg] / 60000)
    }));

    if (stats.length === 0) {
      stats = await ScreenTimeService.getDailyStats();
    }

    setLiveTodayUsage(stats);
    stats.sort((a, b) => b.minutes - a.minutes);

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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadData(); }, []);

  const colors = ['#7E8CF8', '#99C9F5', '#F1B46A', '#BFA6F4'];
  const today = new Date();

  const week = buildWeek(selectedDate);
  const weekLabels = week.labels;
  const weekDates = week.dates;
  const weekDateObjects = week.dateObjects;
  const activeDate = selectedDate.getDate();

  const totalLimit = Object.keys(limits || {}).reduce((acc, pkg) => acc + (limits[pkg] || 0), 0);

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

  const selectedDateKey = formatDateKey(selectedDate);
  const todayKey = formatDateKey(today);
  const selectedMap = storedDailyStats[selectedDateKey] || {};
  let selectedStats: AppUsage[] = Object.keys(selectedMap).map((pkg) => ({
    id: pkg,
    minutes: Math.floor(selectedMap[pkg] / 60000)
  }));
  if (selectedStats.length === 0 && selectedDateKey === todayKey) {
    selectedStats = liveTodayUsage;
  }

  const selectedSorted = selectedStats.sort((a, b) => b.minutes - a.minutes);
  const selectedTop = selectedSorted.slice(0, 4);
  const selectedTotalMins = selectedStats.reduce((acc, curr) => acc + curr.minutes, 0);
  const selectedLimitedUsage = selectedStats.reduce((acc, curr) => {
    const limit = limits[curr.id];
    return limit ? acc + curr.minutes : acc;
  }, 0);

  const displayUsageData = activeRange === 'week' ? weekUsageData : selectedTop;
  const displayTotalMins = activeRange === 'week' ? weekTotalMins : selectedTotalMins;
  const displayLimitedUsage = activeRange === 'week' ? weekLimitedUsage : selectedLimitedUsage;
  const limitMultiplier = activeRange === 'week' ? 7 : 1;

  const percent = totalLimit > 0
    ? Math.min(Math.round((displayLimitedUsage / (totalLimit * limitMultiplier)) * 100), 100)
    : Math.min(Math.round((displayTotalMins / (24 * 60 * limitMultiplier)) * 100), 100);

  const daySeries = displayUsageData.map((item, i) => ({ value: item.minutes, color: colors[i] || '#D3D8E8' }));
  if (daySeries.length === 0) daySeries.push({ value: 1, color: '#E2E6F3' });

  const weekDailyTotals = weekDateObjects.map((dateObj) => {
    const key = formatDateKey(dateObj);
    const dayMap = storedDailyStats[key];
    if (!dayMap) return 0;
    return Object.keys(dayMap).reduce((acc, pkg) => acc + Math.floor(dayMap[pkg] / 60000), 0);
  });
  const maxDaily = Math.max(...weekDailyTotals, 1);

  const monthWeekLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const changeMonth = (delta: number) => {
    const next = new Date(monthDate);
    next.setMonth(next.getMonth() + delta);
    setMonthDate(next);
    setMonthLabel(next.toLocaleString('en-US', { month: 'long', year: 'numeric' }));
    setMonthDays(buildMonth(next, dailyMoods, storedDailyStats, limits));
  };

  const changeWeek = (deltaWeeks: number) => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + (deltaWeeks * 7));
    setSelectedDate(next);
  };

  useEffect(() => {
    Animated.timing(toggleX, {
      toValue: showPercent ? 1 : 0,
      duration: 220,
      useNativeDriver: true
    }).start();
  }, [showPercent, toggleX]);

  const selectedMood = getMoodForDate(selectedDateKey, storedDailyStats, limits, dailyMoods[selectedDateKey]);
  const calendarMood = selectedMood || overallMood;

  const weekStart = weekDateObjects[0];
  const weekEnd = weekDateObjects[6];
  const weekRangeText = `${weekStart.getDate()} ${weekStart.toLocaleString('en-US', { month: 'short' })} - ${weekEnd.getDate()} ${weekEnd.toLocaleString('en-US', { month: 'short' })}`;
  const legendData = displayUsageData.map((item, index) => ({
    id: item.id,
    color: colors[index] || '#D3D8E8',
    label: formatAppName(item.id)
  }));

  const renderDayLayout = () => (
    <>
      <View style={styles.dayCalendarCard}>
        <View style={styles.dayCalendarHeader}>
          <View style={[styles.dayMoodCircle, { backgroundColor: MOOD_CIRCLE_COLORS[calendarMood] || FALLBACK_MOOD_BG }]}>
            <Text style={styles.dayMoodText}>{calendarMood}</Text>
          </View>
          <Text style={styles.dayDateText}>{formatDisplayDate(selectedDate)}</Text>
        </View>

        <View style={styles.weekLettersRow}>
          {weekLabels.map((label, idx) => (
            <Text key={`${label}-${idx}`} style={styles.weekLetter}>{label}</Text>
          ))}
        </View>

        <View style={styles.dayDatePillsRow}>
          {weekDates.map((date, idx) => {
            const dateObj = weekDateObjects[idx];
            const dateKey = formatDateKey(dateObj);
            const mood = getMoodForDate(dateKey, storedDailyStats, limits, dailyMoods[dateKey]);
            const isActive = date === activeDate;
            return (
              <TouchableOpacity key={dateKey} activeOpacity={0.85} onPress={() => setSelectedDate(dateObj)} style={[styles.dayDatePill, isActive && styles.dayDatePillActive]}>
                <Text style={[styles.dayDateNumber, isActive && styles.dayDateNumberActive]}>{date}</Text>
                <View style={[styles.dayPillMood, { backgroundColor: MOOD_CIRCLE_COLORS[mood] || '#F3F5FB' }]}>
                  {mood ? <Text style={styles.dayPillMoodText}>{mood}</Text> : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.dayAnalyticsCard}>
        <View style={styles.dayAnalyticsHeader}>
          <Text style={styles.dayAnalyticsTitle}>Daily Average</Text>
          <View style={styles.metricToggle}>
            <Animated.View
              style={[
                styles.metricTogglePill,
                {
                  transform: [{
                    translateX: toggleX.interpolate({ inputRange: [0, 1], outputRange: [0, 58] })
                  }]
                }
              ]}
            />
            <TouchableOpacity style={styles.metricToggleBtn} onPress={() => setShowPercent(false)}>
              <Text style={!showPercent ? styles.metricToggleTextActive : styles.metricToggleText}>Time</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.metricToggleBtn} onPress={() => setShowPercent(true)}>
              <Text style={showPercent ? styles.metricToggleTextActive : styles.metricToggleText}>Percents</Text>
            </TouchableOpacity>
          </View>
        </View>

        {showPercent ? (
          <View style={styles.pieWrap}>
            <PieChart widthAndHeight={220} series={daySeries} cover={0.72} padAngle={0.03} />
            <View style={styles.pieCenter}>
              <Text style={styles.pieCenterValue}>{`${percent}%`}</Text>
              <Text style={styles.pieCenterLabel}>Usage Score</Text>
            </View>
          </View>
        ) : (
          <View style={styles.timeBarsWrap}>
            <View style={styles.timeBarsGrid}>
              {[60, 45, 30, 0].map((val, idx) => (
                <View key={`line-${val}`} style={[styles.gridLine, { top: 10 + (idx * 65) }]}>
                  <Text style={styles.gridLabel}>{val === 0 ? '0' : `${val}m`}</Text>
                </View>
              ))}
              <View style={styles.barsRow}>
                {weekDailyTotals.map((value, idx) => {
                  const height = Math.max(8, Math.round((value / maxDaily) * 130));
                  return (
                    <View key={`daily-bar-${idx}`} style={styles.barCol}>
                      <View style={[styles.dayBar, styles.dayBarFill, { height }]} />
                      <Text style={styles.barColLabel}>{weekLabels[idx]}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
            <Text style={styles.totalTimeText}>{formatTime(displayTotalMins)}</Text>
          </View>
        )}

        {legendData.length > 0 && (
          <View style={styles.legendWrap}>
            {legendData.map((item) => (
              <View key={`day-legend-${item.id}`} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                <Text numberOfLines={1} style={styles.legendText}>{item.label}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </>
  );

  const renderWeekLayout = () => (
    <View style={styles.periodCard}>
      <View style={styles.periodHeader}>
        <TouchableOpacity style={styles.navArrow} onPress={() => changeWeek(-1)}>
          <Text style={styles.navArrowText}>{'\u2039'}</Text>
        </TouchableOpacity>
        <Text style={styles.periodTitle}>{weekRangeText}</Text>
        <TouchableOpacity style={styles.navArrow} onPress={() => changeWeek(1)}>
          <Text style={styles.navArrowText}>{'\u203A'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.dayChipRow}>
        {monthWeekLabels.map((d) => (
          <View key={d} style={styles.dayChip}><Text style={styles.dayChipText}>{d}</Text></View>
        ))}
      </View>

      <View style={styles.weekGraphCard}>
        <View style={styles.weekGraphRow}>
          {weekDateObjects.map((dateObj, idx) => {
            const key = formatDateKey(dateObj);
            const mood = getMoodForDate(key, storedDailyStats, limits, dailyMoods[key]);
            const value = weekDailyTotals[idx] || 0;
            const height = Math.max(10, Math.round((value / maxDaily) * 230));
            return (
              <View key={key} style={styles.weekGraphCol}>
                <View style={styles.weekTrack}>
                  <View style={[styles.weekFill, styles.weekFillColor, { height }]} />
                  <View style={[styles.weekDot, { backgroundColor: MOOD_CIRCLE_COLORS[mood] || '#8EA3F7' }]} />
                </View>
                <Text style={styles.weekDate}>{dateObj.getDate()}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {legendData.length > 0 && (
        <View style={styles.legendWrap}>
          {legendData.map((item) => (
            <View key={`week-legend-${item.id}`} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: item.color }]} />
              <Text numberOfLines={1} style={styles.legendText}>{item.label}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  const renderMonthLayout = () => (
    <View style={styles.periodCard}>
      <View style={styles.periodHeader}>
        <TouchableOpacity style={styles.navArrow} onPress={() => changeMonth(-1)}>
          <Text style={styles.navArrowText}>{'\u2039'}</Text>
        </TouchableOpacity>
        <Text style={styles.periodTitle}>{monthLabel}</Text>
        <TouchableOpacity style={styles.navArrow} onPress={() => changeMonth(1)}>
          <Text style={styles.navArrowText}>{'\u203A'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.dayChipRow}>
        {monthWeekLabels.map((d) => (
          <View key={d} style={styles.dayChip}><Text style={styles.dayChipText}>{d}</Text></View>
        ))}
      </View>

      <View style={styles.monthGrid}>
        {monthDays.map((item) => {
          const isEmpty = item.day === null;
          const moodBg = item.mood ? (MOOD_CIRCLE_COLORS[item.mood] || FALLBACK_MOOD_BG) : '#F4F6FB';
          return (
            <View key={item.key} style={[styles.monthCell, isEmpty && styles.monthCellEmpty]}>
              <Text style={[styles.monthDayNumber, isEmpty && styles.monthDayNumberEmpty]}>{item.day ?? ''}</Text>
              <View style={[styles.monthMoodDot, { backgroundColor: moodBg }]}>
                {item.mood ? <Text style={styles.monthMoodText}>{item.mood}</Text> : null}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} />}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Analytics</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconButton}>
              <Text style={styles.iconGlyph}>{'\u23F0'}</Text>
              <View style={styles.notificationDot} />
            </TouchableOpacity>
            <View style={styles.avatar}><Text style={styles.avatarText}>CW</Text></View>
          </View>
        </View>

        <View style={styles.rangeTabsWrap}>
          {(Object.keys(RANGE_LABELS) as RangeType[]).map((range) => (
            <TouchableOpacity key={range} style={[styles.rangeTab, activeRange === range && styles.rangeTabActive]} onPress={() => setActiveRange(range)}>
              <Text style={[styles.rangeTabText, activeRange === range && styles.rangeTabTextActive]}>{RANGE_LABELS[range]}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeRange === 'day' && renderDayLayout()}
        {activeRange === 'week' && renderWeekLayout()}
        {activeRange === 'month' && renderMonthLayout()}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EEF1FA'
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 100
  },
  header: {
    marginTop: 10,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  title: {
    fontSize: 30,
    color: '#2A2F4A',
    fontFamily: FONT.title
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FDFEFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    position: 'relative'
  },
  iconGlyph: {
    fontSize: 18
  },
  notificationDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    top: 6,
    right: 6,
    backgroundColor: '#9BAAF6'
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#C1C9FF',
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarText: {
    color: '#3A4267',
    fontFamily: FONT.heading,
    fontSize: 12
  },

  rangeTabsWrap: {
    flexDirection: 'row',
    backgroundColor: '#FDFEFF',
    borderRadius: 24,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#DCE2F6'
  },
  rangeTab: {
    flex: 1,
    borderRadius: 20,
    paddingVertical: 12,
    alignItems: 'center'
  },
  rangeTabActive: {
    backgroundColor: '#7E8CF8'
  },
  rangeTabText: {
    color: '#68708C',
    fontSize: 14,
    fontFamily: FONT.body
  },
  rangeTabTextActive: {
    color: '#FFFFFF',
    fontFamily: FONT.heading
  },

  dayCalendarCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#DDE3F7'
  },
  dayCalendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14
  },
  dayMoodCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  dayMoodText: {
    fontSize: 22
  },
  dayDateText: {
    fontSize: 14,
    color: '#161A27',
    fontFamily: FONT.heading
  },
  weekLettersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 2
  },
  weekLetter: {
    width: 42,
    textAlign: 'center',
    color: '#6E7385',
    fontSize: 12,
    fontFamily: FONT.body
  },
  dayDatePillsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  dayDatePill: {
    width: 42,
    borderRadius: 21,
    paddingVertical: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8ECF5'
  },
  dayDatePillActive: {
    borderColor: '#A9B4FF',
    backgroundColor: '#EFF2FF'
  },
  dayDateNumber: {
    fontSize: 12,
    color: '#3A3F4D',
    fontFamily: FONT.heading,
    marginBottom: 4
  },
  dayDateNumberActive: {
    color: '#131724'
  },
  dayPillMood: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  dayPillMoodText: {
    fontSize: 13
  },

  dayAnalyticsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 18,
    borderWidth: 1,
    borderColor: '#DDE3F7'
  },
  dayAnalyticsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  dayAnalyticsTitle: {
    fontSize: 16,
    color: '#141924',
    fontFamily: FONT.heading
  },
  metricToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 3,
    backgroundColor: '#F2F4FD',
    borderRadius: 18,
    position: 'relative'
  },
  metricTogglePill: {
    position: 'absolute',
    left: 3,
    top: 3,
    bottom: 3,
    width: 58,
    borderRadius: 15,
    backgroundColor: '#7E8CF8'
  },
  metricToggleBtn: {
    width: 58,
    alignItems: 'center',
    paddingVertical: 6
  },
  metricToggleText: {
    color: '#7A8092',
    fontFamily: FONT.body
  },
  metricToggleTextActive: {
    color: '#FFFFFF',
    fontFamily: FONT.heading
  },
  pieWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 250
  },
  pieCenter: {
    position: 'absolute',
    alignItems: 'center'
  },
  pieCenterValue: {
    fontSize: 34,
    color: '#151A26',
    fontFamily: FONT.title
  },
  pieCenterLabel: {
    marginTop: 2,
    color: '#7E85A0',
    fontFamily: FONT.body,
    fontSize: 14
  },
  timeBarsWrap: {
    marginTop: 6
  },
  timeBarsGrid: {
    height: 220,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ECEFF7',
    paddingTop: 10,
    paddingHorizontal: 10,
    justifyContent: 'flex-end'
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderColor: '#F1F3F9'
  },
  gridLabel: {
    position: 'absolute',
    left: 6,
    top: -9,
    fontSize: 11,
    color: '#8B92A6',
    fontFamily: FONT.regular
  },
  barsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end'
  },
  barCol: {
    alignItems: 'center',
    width: 24
  },
  dayBar: {
    width: 14,
    borderRadius: 7
  },
  dayBarFill: {
    backgroundColor: '#A9B4F8'
  },
  barColLabel: {
    marginTop: 8,
    fontSize: 11,
    color: '#788098',
    fontFamily: FONT.body
  },
  totalTimeText: {
    marginTop: 10,
    alignSelf: 'center',
    fontSize: 18,
    color: '#1F2742',
    fontFamily: FONT.heading
  },

  periodCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 18,
    borderWidth: 1,
    borderColor: '#DDE3F7'
  },
  periodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14
  },
  navArrow: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F5F7FF',
    alignItems: 'center',
    justifyContent: 'center'
  },
  navArrowText: {
    fontSize: 26,
    color: '#232A3E'
  },
  periodTitle: {
    color: '#171C2B',
    fontSize: 16,
    fontFamily: FONT.heading
  },
  dayChipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  dayChip: {
    minWidth: 44,
    height: 30,
    paddingHorizontal: 8,
    borderRadius: 15,
    backgroundColor: '#F3F5FD',
    alignItems: 'center',
    justifyContent: 'center'
  },
  dayChipText: {
    fontSize: 11,
    color: '#5E6578',
    fontFamily: FONT.body
  },

  weekGraphCard: {
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#ECEFF7',
    padding: 14
  },
  weekGraphRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    minHeight: 280
  },
  weekGraphCol: {
    alignItems: 'center',
    width: 38
  },
  weekTrack: {
    height: 240,
    width: 28,
    borderRadius: 14,
    backgroundColor: '#F7F8FC',
    justifyContent: 'flex-end',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden'
  },
  weekFill: {
    width: '100%',
    borderRadius: 14
  },
  weekFillColor: {
    backgroundColor: '#BFC9F766'
  },
  weekDot: {
    position: 'absolute',
    top: 8,
    width: 16,
    height: 16,
    borderRadius: 8
  },
  weekDate: {
    marginTop: 8,
    fontSize: 13,
    color: '#2E344A',
    fontFamily: FONT.body
  },

  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between'
  },
  monthCell: {
    width: '13.7%',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ECEFF7',
    paddingVertical: 8,
    marginBottom: 8,
    alignItems: 'center'
  },
  monthCellEmpty: {
    backgroundColor: '#FAFBFE',
    borderColor: '#F1F3F8'
  },
  monthDayNumber: {
    fontSize: 12,
    color: '#31384D',
    fontFamily: FONT.heading,
    marginBottom: 6
  },
  monthDayNumberEmpty: {
    color: '#BCC2D3'
  },
  monthMoodDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center'
  },
  monthMoodText: {
    fontSize: 13
  },
  legendWrap: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4F5FE',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6
  },
  legendText: {
    maxWidth: 110,
    color: '#5E6578',
    fontSize: 11,
    fontFamily: FONT.body
  }
});
