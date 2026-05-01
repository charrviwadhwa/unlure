import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
  StatusBar,
} from 'react-native';
import { ScreenTimeService, DailyUsageMap } from '../../services/ScreenTimeService';

const { width } = Dimensions.get('window');

const COLORS = {
  social: { solid: '#528DF5', light: '#DEEAFE', border: '#7CA0E6' },
  entertainment: { solid: '#E8B63F', light: '#FDF0D5', border: '#E2BD6D' },
  other: { solid: '#4DB1B4', light: '#E1F6F5', border: '#81C5C7' },
  textMain: '#000000',
  textSecondary: '#8E8E93',
  bg: '#FFFFFF',
  cardBg: '#F2F2F7',
};

type AppRow = {
  id: string;
  name: string;
  minutes: number;
};

type CategoryKey = 'social' | 'entertainment' | 'productivity';

const formatDateKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const labelFromPackage = (pkg: string) => {
  const raw = pkg.split('.').pop() || pkg;
  return raw.charAt(0).toUpperCase() + raw.slice(1);
};

const SOCIAL_KEYWORDS = ['instagram', 'facebook', 'whatsapp', 'snapchat', 'telegram', 'discord', 'twitter', 'x.com', 'reddit', 'messenger'];
const ENTERTAINMENT_KEYWORDS = ['youtube', 'netflix', 'primevideo', 'spotify', 'music', 'hotstar', 'jio', 'mxplayer', 'twitch', 'gaana', 'wynk'];
const PRODUCTIVITY_KEYWORDS = ['notion', 'docs', 'sheets', 'slides', 'calendar', 'meet', 'zoom', 'teams', 'gmail', 'outlook', 'drive', 'slack', 'todo', 'trello', 'asana'];

const categorizeApp = (name: string, packageName: string): CategoryKey => {
  const text = `${name} ${packageName}`.toLowerCase();
  if (SOCIAL_KEYWORDS.some((k) => text.includes(k))) return 'social';
  if (ENTERTAINMENT_KEYWORDS.some((k) => text.includes(k))) return 'entertainment';
  if (PRODUCTIVITY_KEYWORDS.some((k) => text.includes(k))) return 'productivity';
  return 'productivity';
};

const formatTime = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

export default function ScreenTimeDashboard() {
  const [viewMode, setViewMode] = useState('week');
  const [todayApps, setTodayApps] = useState<AppRow[]>([]);
  const [storedStats, setStoredStats] = useState<DailyUsageMap>({});
  const isWeek = viewMode === 'week';

  const load = useCallback(async () => {
    await ScreenTimeService.storeTodayStats();
    const [dailyStats, installedApps] = await Promise.all([
      ScreenTimeService.getStoredDailyStats(),
      ScreenTimeService.getInstalledApps()
    ]);

    const nameMap = installedApps.reduce<Record<string, string>>((acc, app) => {
      acc[app.packageName] = app.appName;
      return acc;
    }, {});

    const todayKey = formatDateKey(new Date());
    const todayMap = dailyStats[todayKey] || {};
    const rows = Object.keys(todayMap)
      .map((pkg) => ({
        id: pkg,
        name: nameMap[pkg] || labelFromPackage(pkg),
        minutes: Math.floor(todayMap[pkg] / 60000)
      }))
      .filter((row) => row.minutes > 0)
      .sort((a, b) => b.minutes - a.minutes);

    setTodayApps(rows);
    setStoredStats(dailyStats);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const today = new Date();
  const todayLabel = `Today, ${today.toLocaleDateString('en-US', { day: 'numeric', month: 'long' })}`;
  const updatedLabel = `updated today at ${today.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`;

  const dayKeys = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        return formatDateKey(date);
      }),
    []
  );

  const categoryMinutes = useMemo(() => {
    const totals: Record<CategoryKey, number> = {
      social: 0,
      entertainment: 0,
      productivity: 0
    };
    todayApps.forEach((app) => {
      const category = categorizeApp(app.name, app.id);
      totals[category] += app.minutes;
    });
    return totals;
  }, [todayApps]);

  const weekData = useMemo(() => {
    const labels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    return dayKeys.map((key, index) => {
      const dayMap = storedStats[key] || {};
      const totals: Record<CategoryKey, number> = {
        social: 0,
        entertainment: 0,
        productivity: 0
      };
      Object.entries(dayMap).forEach(([pkg, ms]) => {
        const appName = todayApps.find((app) => app.id === pkg)?.name || labelFromPackage(pkg);
        const category = categorizeApp(appName, pkg);
        totals[category] += Math.floor(ms / 60000);
      });
      return { day: labels[index], ...totals };
    });
  }, [dayKeys, storedStats, todayApps]);

  const weekTotalMinutes = useMemo(
    () => weekData.reduce((acc, d) => acc + d.social + d.entertainment + d.productivity, 0),
    [weekData]
  );
  const weekAverageMinutes = Math.floor(weekTotalMinutes / 7);
  const dayTotalMinutes = categoryMinutes.social + categoryMinutes.entertainment + categoryMinutes.productivity;
  const weekMaxMinutes = Math.max(...weekData.map((d) => d.social + d.entertainment + d.productivity), 1);
  const dayMaxMinutes = Math.max(categoryMinutes.social, categoryMinutes.entertainment, categoryMinutes.productivity, 1);
  const dayScale = 350 / dayMaxMinutes;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          
          {/* --- COMMON HEADER --- */}
          <View style={styles.header}>
            <Text style={styles.title}>Screen time</Text>
            
            <View style={styles.toggleContainer}>
              <TouchableOpacity 
                style={[styles.toggleButton, { marginRight: 12 }]} 
                onPress={() => setViewMode('week')}
                activeOpacity={0.7}
              >
                {isWeek && <View style={styles.activeDot} />}
                <Text style={[styles.toggleText, isWeek && styles.toggleTextActive]}>
                  week
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.toggleButton} 
                onPress={() => setViewMode('day')}
                activeOpacity={0.7}
              >
                {!isWeek && <View style={styles.activeDot} />}
                <Text style={[styles.toggleText, !isWeek && styles.toggleTextActive]}>
                  day
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.dateHeader}>
            <Text style={styles.dateText}>{todayLabel}</Text>
            {!isWeek && <Text style={styles.updatedSmall}>{updatedLabel}</Text>}
          </View>

          {/* ========================================= */}
          {/*               WEEK VIEW                   */}
          {/* ========================================= */}
          {isWeek && (
            <View style={styles.weekViewContainer}>
              {/* Week Top Stats */}
              <Text style={styles.timeBigText}>{formatTime(weekTotalMinutes)}</Text>
              <Text style={styles.subTextMain}>Total usage this week</Text>
              <Text style={styles.subText}>Daily Average this week {formatTime(weekAverageMinutes)}</Text>

              {/* Week Chart */}
              <View style={styles.weekChartContainer}>
                
                {/* 
                  The gridLineContainer bottom is perfectly aligned to match the height 
                  of the xLabel (16px) + the margin of the bars (8px) = 24px total 
                */}
                <View style={styles.gridLineContainer}>
                  <View style={styles.gridLine}><Text style={styles.gridText}>6h</Text></View>
                  <View style={styles.gridLine}><Text style={styles.gridText}>4h</Text></View>
                  <View style={styles.gridLine}><Text style={styles.gridText}>2h</Text></View>
                  <View style={styles.gridLine}><Text style={styles.gridText}>0h</Text></View>
                </View>

                <View style={styles.barsWrapper}>
                  {weekData.map((item, index) => {
                    const total = item.social + item.entertainment + item.productivity;
                    const scaledSocial = total > 0 ? Math.max((item.social / weekMaxMinutes) * 140, item.social > 0 ? 6 : 0) : 0;
                    const scaledEnt = total > 0 ? Math.max((item.entertainment / weekMaxMinutes) * 140, item.entertainment > 0 ? 6 : 0) : 0;
                    const scaledProductivity = total > 0 ? Math.max((item.productivity / weekMaxMinutes) * 140, item.productivity > 0 ? 6 : 0) : 0;
                    return (
                    <View key={index} style={styles.barColumn}>
                      <View style={styles.weekBarStack}>
                        
                        {/* Other (Top Segment) */}
                        <View style={[
                          styles.weekBarSegment, 
                          { 
                            height: scaledProductivity,
                            backgroundColor: COLORS.other.light,
                            borderColor: COLORS.other.border,
                            borderTopLeftRadius: 4, 
                            borderTopRightRadius: 4,
                            marginBottom: 2 
                          }
                        ]} />
                        
                        {/* Entertainment (Middle Segment) */}
                        <View style={[
                          styles.weekBarSegment, 
                          { 
                            height: scaledEnt, 
                            backgroundColor: COLORS.entertainment.light,
                            borderColor: COLORS.entertainment.border,
                            marginBottom: 2
                          }
                        ]} />
                        
                        {/* Social (Bottom Segment) */}
                        <View style={[
                          styles.weekBarSegment, 
                          { 
                            height: scaledSocial, 
                            backgroundColor: COLORS.social.light,
                            borderColor: COLORS.social.border,
                            borderBottomLeftRadius: 4, 
                            borderBottomRightRadius: 4 
                          }
                        ]} />
                      </View>
                      
                      {/* Fixed X-Axis Label */}
                      <Text style={styles.xLabel}>{item.day}</Text>
                    </View>
                    );
                  })}
                </View>
              </View>

              {/* Categories Legend */}
              <View style={styles.legendContainer}>
                <View style={styles.legendItem}>
                  <Text style={[styles.legendLabel, { color: COLORS.social.border }]}>Social</Text>
                  <Text style={styles.legendValue}>{formatTime(categoryMinutes.social)}</Text>
                </View>
                <View style={styles.legendItem}>
                  <Text style={[styles.legendLabel, { color: COLORS.other.border }]}>Productivity</Text>
                  <Text style={styles.legendValue}>{formatTime(categoryMinutes.productivity)}</Text>
                </View>
                <View style={styles.legendItem}>
                  <Text style={[styles.legendLabel, { color: COLORS.entertainment.border }]}>Entertainment</Text>
                  <Text style={styles.legendValue}>{formatTime(categoryMinutes.entertainment)}</Text>
                </View>
              </View>
              <Text style={styles.updatedText}>{updatedLabel}</Text>

              {/* Limits Section */}
              <Text style={styles.sectionTitle}>Limits</Text>
              <View style={styles.limitsContainer}>
                <View style={[styles.limitCard, { marginRight: 16 }]}>
                  <View style={styles.limitIconPlaceholder} />
                  <Text style={styles.limitLabel}>Social</Text>
                  <Text style={styles.limitValue}>{formatTime(Math.max(categoryMinutes.social, 60))}</Text>
                </View>
                <View style={styles.limitCard}>
                  <View style={styles.limitIconPlaceholder} />
                  <Text style={styles.limitLabel}>Entertainment</Text>
                  <Text style={styles.limitValue}>{formatTime(Math.max(categoryMinutes.entertainment, 150))}</Text>
                </View>
              </View>
            </View>
          )}

          {/* ========================================= */}
          {/*               DAY VIEW                    */}
          {/* ========================================= */}
          {!isWeek && (
            <View style={styles.dayViewContainer}>
              
              <View style={styles.dayChartContainer}>
                {/* Social Bar */}
                <View style={styles.dayBarColumn}>
                  <View style={styles.dayBarLabelContainer}>
                    <Text style={[styles.dayBarLabelTitle, { color: COLORS.social.border }]}>Social</Text>
                    <Text style={styles.dayBarLabelValue}>{formatTime(categoryMinutes.social)}</Text>
                  </View>
                  <View style={[styles.giantBar, { height: Math.max(categoryMinutes.social * dayScale, categoryMinutes.social > 0 ? 30 : 0), backgroundColor: COLORS.social.light, borderColor: COLORS.social.border }]} />
                </View>

                {/* Entertainment Bar */}
                <View style={styles.dayBarColumn}>
                  <View style={styles.dayBarLabelContainer}>
                    <Text style={[styles.dayBarLabelTitle, { color: COLORS.entertainment.border }]}>Entertainment</Text>
                    <Text style={styles.dayBarLabelValue}>{formatTime(categoryMinutes.entertainment)}</Text>
                  </View>
                  <View style={[styles.giantBar, { height: Math.max(categoryMinutes.entertainment * dayScale, categoryMinutes.entertainment > 0 ? 30 : 0), backgroundColor: COLORS.entertainment.light, borderColor: COLORS.entertainment.border }]} />
                </View>

                {/* Other Bar */}
                <View style={styles.dayBarColumn}>
                  <View style={styles.dayBarLabelContainer}>
                    <Text style={[styles.dayBarLabelTitle, { color: COLORS.other.border }]}>Productivity</Text>
                    <Text style={styles.dayBarLabelValue}>{formatTime(categoryMinutes.productivity)}</Text>
                  </View>
                  <View style={[styles.giantBar, { height: Math.max(categoryMinutes.productivity * dayScale, categoryMinutes.productivity > 0 ? 30 : 0), backgroundColor: COLORS.other.light, borderColor: COLORS.other.border }]} />
                </View>
              </View>

              {/* Day Bottom Stats */}
              <View style={styles.dayFooter}>
                <View>
                  <Text style={styles.totalTodayText}>total today</Text>
                  <Text style={styles.subText}>Average time this week  {formatTime(weekAverageMinutes)}</Text>
                </View>
                <Text style={styles.timeBigTextDay}>{formatTime(dayTotalMinutes)}</Text>
              </View>

            </View>
          )}

        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 15 : 15,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.textMain,
    letterSpacing: -0.5,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#F2F2F7',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.textMain,
    marginRight: 6,
  },
  toggleText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  toggleTextActive: {
    color: COLORS.textMain,
    fontWeight: '700',
  },
  dateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dateText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  updatedSmall: {
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  
  // --- Week View Styles ---
  weekViewContainer: {
    marginTop: 10,
  },
  timeBigText: {
    fontSize: 64,
    fontWeight: '400',
    color: COLORS.textMain,
    letterSpacing: -2,
    lineHeight: 70,
  },
  subTextMain: {
    fontSize: 15,
    color: COLORS.textMain,
    fontWeight: '600',
    marginTop: 4,
  },
  subText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  weekChartContainer: {
    height: 250,
    marginTop: 30,
    marginBottom: 40,
    flexDirection: 'row',
  },
  gridLineContainer: {
    position: 'absolute',
    top: 0,
    bottom: 24, // ALIGNMENT FIX: Matched to label height (16) + margin (8)
    left: 0,
    right: 0,
    justifyContent: 'space-between',
    zIndex: -1,
  },
  gridLine: {
    borderBottomWidth: 1,
    borderBottomColor: '#EAEAEA',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    paddingBottom: 4,
  },
  gridText: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  barsWrapper: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingRight: 35, 
    paddingLeft: 10,
  },
  barColumn: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
  },
  weekBarStack: {
    width: 28,
    justifyContent: 'flex-end',
    marginBottom: 8, // ALIGNMENT FIX: Space between bar and text
  },
  weekBarSegment: {
    width: '100%',
    borderWidth: 1.5,
    borderRadius: 2,
  },
  xLabel: {
    fontSize: 12,
    color: COLORS.textMain,
    fontWeight: '600',
    height: 16, // ALIGNMENT FIX: Consistent height so flexbox keeps bottom aligned
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingRight: 40,
    marginBottom: 8,
  },
  legendItem: {
    alignItems: 'flex-start',
  },
  legendLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  legendValue: {
    fontSize: 22,
    fontWeight: '400',
    color: COLORS.textMain,
  },
  updatedText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textMain,
    marginBottom: 16,
  },
  limitsContainer: {
    flexDirection: 'row',
  },
  limitCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    padding: 16,
    flex: 1,
    minHeight: 110,
    justifyContent: 'space-between',
  },
  limitIconPlaceholder: {
    width: 24,
    height: 24,
    backgroundColor: '#D1D1D6',
    borderRadius: 6,
    marginBottom: 20,
  },
  limitLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 4,
    fontWeight: '500',
  },
  limitValue: {
    fontSize: 24,
    fontWeight: '400',
    color: COLORS.textMain,
  },

  // --- Day View Styles ---
  dayViewContainer: {
    marginTop: 20,
    flex: 1,
  },
  dayChartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 450, 
    marginBottom: 40,
  },
  dayBarColumn: {
    alignItems: 'flex-start',
    width: (width - 48 - 20) / 3,
  },
  dayBarLabelContainer: {
    marginBottom: 8,
  },
  dayBarLabelTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  dayBarLabelValue: {
    fontSize: 24,
    fontWeight: '400',
    color: COLORS.textMain,
  },
  giantBar: {
    width: '100%',
    borderWidth: 1.5,
    borderRadius: 6,
  },
  dayFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#EAEAEA',
    paddingTop: 20,
  },
  totalTodayText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textMain,
    marginBottom: 4,
  },
  timeBigTextDay: {
    fontSize: 48,
    fontWeight: '400',
    color: COLORS.textMain,
    letterSpacing: -1,
  },
});
