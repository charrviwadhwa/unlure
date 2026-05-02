import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
  Animated,
  RefreshControl,
  Dimensions,
  Platform,
  StatusBar,
  AppState,
} from 'react-native';
import { ScreenTimeService, DailyUsageMap } from '../../services/ScreenTimeService';
import { useMidnightRefresh } from '../../hooks/useMidnightRefresh';

const { width } = Dimensions.get('window');

const COLORS = {
  social: { solid: '#528DF5', light: '#DEEAFE', border: '#7CA0E6' },
  games: { solid: '#9B6EF3', light: '#EEE8FE', border: '#A987EC' },
  entertainment: { solid: '#E8B63F', light: '#FDF0D5', border: '#E2BD6D' },
  creativity: { solid: '#F06F9A', light: '#FDE7EF', border: '#E989A9' },
  productivityFinance: { solid: '#4DB1B4', light: '#E1F6F5', border: '#81C5C7' },
  education: { solid: '#5A9A62', light: '#E4F3E7', border: '#7FB586' },
  informationReading: { solid: '#8A7D6D', light: '#F0ECE6', border: '#A29584' },
  healthFitness: { solid: '#EF7F52', light: '#FDE9DF', border: '#E79A79' },
  utilities: { solid: '#6F8FAF', light: '#E8EEF5', border: '#86A1BC' },
  shoppingFood: { solid: '#D66D75', light: '#FBE7E9', border: '#DF8A91' },
  travel: { solid: '#45A6D8', light: '#E3F2FA', border: '#74B9DE' },
  others: { solid: '#9B9BA3', light: '#EFEFF2', border: '#B8B8BE' },
  textMain: '#000000',
  textSecondary: '#8E8E93',
  bg: '#FFFFFF',
  cardBg: '#F2F2F7',
};

type AppRow = {
  id: string;
  name: string;
  minutes: number;
  iconBase64?: string;
};

type CategoryKey =
  | 'social'
  | 'games'
  | 'entertainment'
  | 'creativity'
  | 'productivityFinance'
  | 'education'
  | 'informationReading'
  | 'healthFitness'
  | 'utilities'
  | 'shoppingFood'
  | 'travel'
  | 'others';

type ChartCategory = {
  key: CategoryKey | 'otherSummary';
  label: string;
  minutes: number;
  color: { light: string; border: string };
  includedKeys: CategoryKey[];
};

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
const GAME_KEYWORDS = ['game', 'games', 'pubg', 'freefire', 'minecraft', 'roblox', 'chess', 'ludo', 'scrabble', 'candycrush', 'clash'];
const ENTERTAINMENT_KEYWORDS = ['youtube', 'netflix', 'primevideo', 'spotify', 'music', 'hotstar', 'jio', 'mxplayer', 'twitch', 'gaana', 'wynk', 'video'];
const CREATIVITY_KEYWORDS = ['camera', 'photos', 'gallery', 'canva', 'picsart', 'capcut', 'lightroom', 'snapseed', 'editor', 'figma'];
const PRODUCTIVITY_FINANCE_KEYWORDS = ['notion', 'docs', 'sheets', 'slides', 'calendar', 'meet', 'zoom', 'teams', 'gmail', 'outlook', 'drive', 'slack', 'todo', 'trello', 'asana', 'bank', 'pay', 'wallet', 'finance', 'hdfc', 'sbi', 'icici', 'phonepe', 'gpay', 'paytm'];
const EDUCATION_KEYWORDS = ['classroom', 'duolingo', 'coursera', 'udemy', 'khan', 'learn', 'python', 'study', 'school', 'college'];
const INFORMATION_READING_KEYWORDS = ['kindle', 'news', 'reader', 'medium', 'ndtv', 'times', 'browser', 'chrome', 'firefox', 'wikipedia'];
const HEALTH_FITNESS_KEYWORDS = ['health', 'fitness', 'fit', 'workout', 'steps', 'activity', 'beato', 'calm', 'meditation'];
const UTILITIES_KEYWORDS = ['settings', 'clock', 'calculator', 'notes', 'files', 'recorder', 'measure', 'voice', 'scanner'];
const SHOPPING_FOOD_KEYWORDS = ['amazon', 'flipkart', 'myntra', 'shop', 'store', 'swiggy', 'zomato', 'food', 'blinkit', 'zepto'];
const TRAVEL_KEYWORDS = ['maps', 'uber', 'ola', 'travel', 'booking', 'airbnb', 'train', 'rail', 'flight'];

const CATEGORY_KEYS: CategoryKey[] = [
  'social',
  'games',
  'entertainment',
  'creativity',
  'productivityFinance',
  'education',
  'informationReading',
  'healthFitness',
  'utilities',
  'shoppingFood',
  'travel',
  'others'
];

const CATEGORY_LABELS: Record<CategoryKey, string> = {
  social: 'Social',
  games: 'Games',
  entertainment: 'Entertainment',
  creativity: 'Creativity',
  productivityFinance: 'Productivity & Finance',
  education: 'Education',
  informationReading: 'Information & Reading',
  healthFitness: 'Health & Fitness',
  utilities: 'Utilities',
  shoppingFood: 'Shopping & Food',
  travel: 'Travel',
  others: 'Others'
};

const CATEGORY_ICONS: Record<CategoryKey | 'otherSummary', string> = {
  social: '@',
  games: '+',
  entertainment: '▶',
  creativity: '✎',
  productivityFinance: '$',
  education: 'A',
  informationReading: '≡',
  healthFitness: '+',
  utilities: '⚙',
  shoppingFood: '□',
  travel: '⌖',
  others: '…',
  otherSummary: '…'
};

const createEmptyCategoryTotals = () =>
  CATEGORY_KEYS.reduce<Record<CategoryKey, number>>((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {} as Record<CategoryKey, number>);

const categorizeApp = (name: string, packageName: string): CategoryKey => {
  const text = `${name} ${packageName}`.toLowerCase();
  if (SOCIAL_KEYWORDS.some((k) => text.includes(k))) return 'social';
  if (GAME_KEYWORDS.some((k) => text.includes(k))) return 'games';
  if (ENTERTAINMENT_KEYWORDS.some((k) => text.includes(k))) return 'entertainment';
  if (CREATIVITY_KEYWORDS.some((k) => text.includes(k))) return 'creativity';
  if (PRODUCTIVITY_FINANCE_KEYWORDS.some((k) => text.includes(k))) return 'productivityFinance';
  if (EDUCATION_KEYWORDS.some((k) => text.includes(k))) return 'education';
  if (INFORMATION_READING_KEYWORDS.some((k) => text.includes(k))) return 'informationReading';
  if (HEALTH_FITNESS_KEYWORDS.some((k) => text.includes(k))) return 'healthFitness';
  if (UTILITIES_KEYWORDS.some((k) => text.includes(k))) return 'utilities';
  if (SHOPPING_FOOD_KEYWORDS.some((k) => text.includes(k))) return 'shoppingFood';
  if (TRAVEL_KEYWORDS.some((k) => text.includes(k))) return 'travel';
  return 'others';
};

const buildChartCategories = (totals: Record<CategoryKey, number>): ChartCategory[] => {
  const specificKeys = CATEGORY_KEYS.filter((key) => key !== 'others');
  const sorted = specificKeys
    .map((key) => ({ key, minutes: totals[key] || 0 }))
    .filter((item) => item.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);
  const top = sorted.slice(0, 3);
  const rest = [...sorted.slice(3), { key: 'others' as CategoryKey, minutes: totals.others || 0 }]
    .filter((item) => item.minutes > 0);
  const result: ChartCategory[] = top.map(({ key, minutes }) => ({
    key,
    label: CATEGORY_LABELS[key],
    minutes,
    color: COLORS[key],
    includedKeys: [key]
  }));
  const restMinutes = rest.reduce((acc, item) => acc + item.minutes, 0);
  if (restMinutes > 0) {
    result.push({
      key: 'otherSummary',
      label: 'Other',
      minutes: restMinutes,
      color: COLORS.others,
      includedKeys: rest.map((item) => item.key)
    });
  }
  return result;
};

const formatTime = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

export default function ScreenTimeDashboard() {
  const [viewMode, setViewMode] = useState('day');
  const [todayApps, setTodayApps] = useState<AppRow[]>([]);
  const [storedStats, setStoredStats] = useState<DailyUsageMap>({});
  const [appNames, setAppNames] = useState<Record<string, string>>({});
  const [appIcons, setAppIcons] = useState<Record<string, string | undefined>>({});
  const [selectedCategory, setSelectedCategory] = useState<ChartCategory | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [todayKey, setTodayKey] = useState(formatDateKey(new Date()));
  const [fadeAnim] = useState(new Animated.Value(1));
  const [toggleAnim] = useState(new Animated.Value(1));
  const sheetTranslateY = useRef(new Animated.Value(320)).current;
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
    const iconMap = installedApps.reduce<Record<string, string | undefined>>((acc, app) => {
      acc[app.packageName] = app.iconBase64;
      return acc;
    }, {});
    setAppNames(nameMap);
    setAppIcons(iconMap);

    const now = new Date();
    const nextTodayKey = formatDateKey(now);
    setCurrentTime(now);
    setTodayKey(nextTodayKey);
    const todayMap = dailyStats[nextTodayKey] || {};
    const rows = Object.keys(todayMap)
      .map((pkg) => ({
        id: pkg,
        name: nameMap[pkg] || labelFromPackage(pkg),
        minutes: Math.floor(todayMap[pkg] / 60000),
        iconBase64: iconMap[pkg]
      }))
      .filter((row) => row.minutes > 0)
      .sort((a, b) => b.minutes - a.minutes);

    setTodayApps(rows);
    setStoredStats(dailyStats);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const interval = setInterval(load, 30000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        load();
      }
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [load]);

  useMidnightRefresh(load);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const todayLabel = `Today, ${currentTime.toLocaleDateString('en-US', { day: 'numeric', month: 'long' })}`;
  const updatedLabel = `updated today at ${currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`;

  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const date = new Date(`${todayKey}T00:00:00`);
        date.setDate(date.getDate() - (6 - i));
        return {
          key: formatDateKey(date),
          label: date.toLocaleDateString('en-US', { weekday: 'short' }).charAt(0)
        };
      }),
    [todayKey]
  );

  const categoryMinutes = useMemo(() => {
    const totals = createEmptyCategoryTotals();
    todayApps.forEach((app) => {
      const category = categorizeApp(app.name, app.id);
      totals[category] += app.minutes;
    });
    return totals;
  }, [todayApps]);

  const categoryApps = useMemo(() => {
    const grouped = CATEGORY_KEYS.reduce<Record<CategoryKey, AppRow[]>>((acc, key) => {
      acc[key] = [];
      return acc;
    }, {} as Record<CategoryKey, AppRow[]>);
    todayApps.forEach((app) => {
      const key = categorizeApp(app.name, app.id);
      grouped[key].push(app);
    });
    (Object.keys(grouped) as CategoryKey[]).forEach((key) => {
      grouped[key] = grouped[key].sort((a, b) => b.minutes - a.minutes);
    });
    return grouped;
  }, [todayApps]);

  const weekData = useMemo(() => {
    return weekDays.map((day) => {
      const dayMap = storedStats[day.key] || {};
      const totals = createEmptyCategoryTotals();
      Object.entries(dayMap).forEach(([pkg, ms]) => {
        const appName = appNames[pkg] || labelFromPackage(pkg);
        const category = categorizeApp(appName, pkg);
        totals[category] += Math.floor(ms / 60000);
      });
      return { day: day.label, totals };
    });
  }, [appNames, storedStats, weekDays]);

  const weekCategoryApps = useMemo(() => {
    const grouped = CATEGORY_KEYS.reduce<Record<CategoryKey, AppRow[]>>((acc, key) => {
      acc[key] = [];
      return acc;
    }, {} as Record<CategoryKey, AppRow[]>);

    weekDays.forEach((day) => {
      const dayMap = storedStats[day.key] || {};
      Object.entries(dayMap).forEach(([pkg, ms]) => {
        const name = appNames[pkg] || labelFromPackage(pkg);
        const category = categorizeApp(name, pkg);
        const minutes = Math.floor(ms / 60000);
        if (minutes <= 0) return;
        const existing = grouped[category].find((app) => app.id === pkg);
        if (existing) {
          existing.minutes += minutes;
        } else {
          grouped[category].push({ id: pkg, name, minutes, iconBase64: appIcons[pkg] });
        }
      });
    });

    (Object.keys(grouped) as CategoryKey[]).forEach((key) => {
      grouped[key] = grouped[key].sort((a, b) => b.minutes - a.minutes);
    });

    return grouped;
  }, [appIcons, appNames, storedStats, weekDays]);

  const weekTotalMinutes = useMemo(
    () => weekData.reduce((acc, d) => acc + CATEGORY_KEYS.reduce((sum, key) => sum + d.totals[key], 0), 0),
    [weekData]
  );
  const weekCategoryMinutes = useMemo(
    () => weekData.reduce((acc, d) => {
      CATEGORY_KEYS.forEach((key) => {
        acc[key] += d.totals[key];
      });
      return acc;
    }, createEmptyCategoryTotals()),
    [weekData]
  );
  const weekChartCategories = useMemo(() => buildChartCategories(weekCategoryMinutes), [weekCategoryMinutes]);
  const dayChartCategories = useMemo(() => buildChartCategories(categoryMinutes), [categoryMinutes]);
  const weekAverageMinutes = Math.floor(weekTotalMinutes / 7);
  const dayTotalMinutes = CATEGORY_KEYS.reduce((acc, key) => acc + categoryMinutes[key], 0);
  const weekMaxMinutes = Math.max(...weekData.map((d) => CATEGORY_KEYS.reduce((acc, key) => acc + d.totals[key], 0)), 1);
  const dayMaxMinutes = Math.max(...dayChartCategories.map((item) => item.minutes), 1);
  const maxTodayAppMinutes = Math.max(...todayApps.map((app) => app.minutes), 1);
  const maxWeekCategoryMinutes = Math.max(...weekChartCategories.map((category) => category.minutes), 1);
  const dayScale = 280 / dayMaxMinutes;
  const selectedApps = selectedCategory
    ? selectedCategory.includedKeys
        .flatMap((key) => (isWeek ? weekCategoryApps[key] : categoryApps[key]))
        .sort((a, b) => b.minutes - a.minutes)
    : [];

  const handleToggleMode = (mode: 'week' | 'day') => {
    if (mode === viewMode) return;
    setViewMode(mode);
    fadeAnim.setValue(0.65);
    Animated.spring(toggleAnim, {
      toValue: mode === 'week' ? 0 : 1,
      useNativeDriver: true,
      friction: 10,
      tension: 160
    }).start();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 100,
      useNativeDriver: true
    }).start();
  };

  useEffect(() => {
    if (!selectedCategory) return;
    sheetTranslateY.setValue(320);
    Animated.timing(sheetTranslateY, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true
    }).start();
  }, [selectedCategory, sheetTranslateY]);

  const closeCategorySheet = useCallback(() => {
    setSelectedCategory(null);
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          overScrollMode="never"
          bounces={false}
          alwaysBounceVertical={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.textMain} />}
        >
          
          {/* --- COMMON HEADER --- */}
          <View style={styles.header}>
            <Text style={styles.title}>Screen time</Text>
            
            <View style={styles.toggleContainer}>
              <Animated.View
                style={[
                  styles.activeSegment,
                  { transform: [{ translateX: toggleAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 69] }) }] }
                ]}
              />
              <TouchableOpacity 
                style={styles.toggleButton}
                onPress={() => handleToggleMode('week')}
                activeOpacity={0.7}
              >
                <Text style={[styles.toggleText, isWeek && styles.toggleTextActive]}>
                  week
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.toggleButton} 
                onPress={() => handleToggleMode('day')}
                activeOpacity={0.7}
              >
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
          <Animated.View style={{ opacity: fadeAnim }}>
          {isWeek ? (
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
                    const segments = weekChartCategories.map((category) => {
                      const minutes = category.includedKeys.reduce((acc, key) => acc + item.totals[key], 0);
                      return {
                        ...category,
                        minutes,
                        height: minutes > 0 ? Math.max((minutes / weekMaxMinutes) * 140, 6) : 0
                      };
                    }).filter((segment) => segment.height > 0);
                    return (
                    <View key={index} style={styles.barColumn}>
                      <View style={styles.weekBarStack}>
                        {segments.map((segment, segmentIndex) => (
                          <View style={[
                            styles.weekBarSegment,
                            {
                              height: segment.height,
                              backgroundColor: segment.color.light,
                              borderColor: segment.color.border,
                              borderTopLeftRadius: segmentIndex === 0 ? 4 : 2,
                              borderTopRightRadius: segmentIndex === 0 ? 4 : 2,
                              borderBottomLeftRadius: segmentIndex === segments.length - 1 ? 4 : 2,
                              borderBottomRightRadius: segmentIndex === segments.length - 1 ? 4 : 2,
                              marginBottom: segmentIndex === segments.length - 1 ? 0 : 2
                            }
                          ]} key={segment.key} />
                        ))}
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
                {weekChartCategories.map((category) => (
                  <View style={styles.legendItem} key={category.key}>
                    <Text style={[styles.legendLabel, { color: category.color.border }]} numberOfLines={1}>{category.label}</Text>
                    <Text style={styles.legendValue}>{formatTime(category.minutes)}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.updatedText}>{updatedLabel}</Text>

              <Text style={styles.sectionTitle}>Categories</Text>
              <View style={styles.iosList}>
                {weekChartCategories.map((category) => (
                  <Pressable
                    key={category.key}
                    style={({ pressed }) => [styles.iosUsageRow, pressed && styles.iosUsageRowPressed]}
                    onPress={() => setSelectedCategory(category)}
                  >
                    <View style={styles.iosUsageMain}>
                      <View style={[styles.iosGlyph, { backgroundColor: category.color.light }]}>
                        <Text style={[styles.iosGlyphText, { color: category.color.border }]}>{CATEGORY_ICONS[category.key]}</Text>
                      </View>
                      <Text style={styles.iosUsageName} numberOfLines={1}>{category.label}</Text>
                    </View>
                    <View style={styles.iosUsageRight}>
                      <Text style={styles.iosUsageTime}>{formatTime(category.minutes)}</Text>
                      <View style={styles.iosMiniTrack}>
                        <View
                          style={[
                            styles.iosMiniFill,
                            {
                              width: `${Math.max((category.minutes / maxWeekCategoryMinutes) * 100, 4)}%`,
                              backgroundColor: category.color.border
                            }
                          ]}
                        />
                      </View>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.dayViewContainer}>
              
              <View style={[
                styles.dayChartContainer,
                dayChartCategories.length >= 3 ? styles.dayChartContainerSpread : styles.dayChartContainerCompact
              ]}>
                {dayChartCategories.map((category) => (
                  <View style={styles.dayBarColumn} key={category.key}>
                    <View style={styles.dayBarLabelContainer}>
                      <Text style={[styles.dayBarLabelTitle, { color: category.color.border }]} numberOfLines={1}>{category.label}</Text>
                      <Text style={styles.dayBarLabelValue}>{formatTime(category.minutes)}</Text>
                    </View>
                    <View style={[
                      styles.giantBar,
                      {
                        height: Math.max(category.minutes * dayScale, category.minutes > 0 ? 30 : 0),
                        backgroundColor: category.color.light,
                        borderColor: category.color.border
                      }
                    ]} />
                  </View>
                ))}
              </View>

              {/* Day Bottom Stats */}
              <View style={styles.dayFooter}>
                <View>
                  <Text style={styles.totalTodayText}>total today</Text>
                  <Text style={styles.subText}>Resets at midnight</Text>
                </View>
                <Text style={styles.timeBigTextDay}>{formatTime(dayTotalMinutes)}</Text>
              </View>

              <Text style={styles.sectionTitle}>Apps today</Text>
              <View style={styles.iosList}>
                {todayApps.slice(0, 6).map((app) => {
                  const category = categorizeApp(app.name, app.id);
                  const theme = COLORS[category];
                  return (
                    <View style={styles.iosUsageRow} key={app.id}>
                      <View style={styles.iosUsageMain}>
                        {app.iconBase64 ? (
                          <Image source={{ uri: `data:image/png;base64,${app.iconBase64}` }} style={styles.appIconImage} resizeMode="cover" />
                        ) : (
                          <View style={styles.appIconFallback}>
                            <Text style={[styles.iosGlyphText, { color: theme.border }]}>{app.name.charAt(0).toUpperCase()}</Text>
                          </View>
                        )}
                        <Text style={styles.iosUsageName} numberOfLines={1}>{app.name}</Text>
                      </View>
                      <View style={styles.iosUsageRight}>
                        <Text style={styles.iosUsageTime}>{formatTime(app.minutes)}</Text>
                        <View style={styles.iosMiniTrack}>
                          <View
                            style={[
                              styles.iosMiniFill,
                              {
                                width: `${Math.max((app.minutes / maxTodayAppMinutes) * 100, 4)}%`,
                                backgroundColor: theme.border
                              }
                            ]}
                          />
                        </View>
                      </View>
                    </View>
                  );
                })}
                {todayApps.length === 0 ? (
                  <View style={styles.iosEmpty}>
                    <Text style={styles.sheetEmpty}>No app usage tracked yet today.</Text>
                  </View>
                ) : null}
              </View>

            </View>
          )}
          </Animated.View>

        </ScrollView>
      </View>
      <Modal visible={Boolean(selectedCategory)} transparent statusBarTranslucent animationType="none" onRequestClose={closeCategorySheet}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.sheetBackdrop} onPress={closeCategorySheet} />
          <Animated.View style={[styles.sheetWrap, { transform: [{ translateY: sheetTranslateY }] }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>
              {selectedCategory ? `${selectedCategory.label} Apps` : 'Apps'}
            </Text>
            {selectedApps.length > 0 ? (
              selectedApps.map((app) => (
                <View key={app.id} style={styles.sheetRow}>
                  <View style={styles.sheetAppLeft}>
                    {app.iconBase64 ? (
                      <Image source={{ uri: `data:image/png;base64,${app.iconBase64}` }} style={styles.sheetAppIcon} resizeMode="cover" />
                    ) : (
                      <View style={styles.sheetAppFallback}>
                        <Text style={styles.sheetAppFallbackText}>{app.name.charAt(0).toUpperCase()}</Text>
                      </View>
                    )}
                    <Text style={styles.sheetAppName} numberOfLines={1}>{app.name}</Text>
                  </View>
                  <Text style={styles.sheetAppTime}>{formatTime(app.minutes)}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.sheetEmpty}>No usage in this category yet.</Text>
            )}
          </Animated.View>
        </View>
      </Modal>
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
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 15 : 15,
    paddingBottom: 140,
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
    borderRadius: 22,
    paddingHorizontal: 6,
    paddingVertical: 6,
    position: 'relative',
    width: 150,
    height: 44
  },
  toggleButton: {
    width: 69,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1
  },
  activeSegment: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 69,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2
  },
  toggleText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '600',
    textAlign: 'center'
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
    gap: 10,
    marginBottom: 8,
  },
  legendItem: {
    alignItems: 'flex-start',
    flex: 1,
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
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMain,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  iosList: {
    marginBottom: 10,
  },
  iosUsageRow: {
    minHeight: 52,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFF4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  iosUsageRowPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.992 }]
  },
  iosUsageMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 14
  },
  iosGlyph: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10
  },
  iosGlyphDot: {
    width: 10,
    height: 10,
    borderRadius: 5
  },
  iosGlyphText: {
    fontSize: 11,
    fontWeight: '700'
  },
  appIconImage: {
    width: 28,
    height: 28,
    borderRadius: 7,
    marginRight: 10
  },
  appIconFallback: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F2F7',
    marginRight: 10
  },
  iosUsageName: {
    flex: 1,
    color: COLORS.textMain,
    fontSize: 14,
    fontWeight: '500'
  },
  iosUsageRight: {
    width: 78,
    alignItems: 'flex-end'
  },
  iosUsageTime: {
    color: COLORS.textMain,
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 5
  },
  iosMiniTrack: {
    width: 66,
    height: 3,
    borderRadius: 999,
    backgroundColor: '#E5E5EA',
    overflow: 'hidden'
  },
  iosMiniFill: {
    height: '100%',
    borderRadius: 999
  },
  iosEmpty: {
    width: '100%',
    minHeight: 64,
    paddingVertical: 14,
    justifyContent: 'center'
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end'
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.38)'
  },
  sheetWrap: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 28,
    minHeight: 260,
    shadowOpacity: 0,
    elevation: 0
  },
  sheetHandle: {
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#D2D3D9',
    alignSelf: 'center',
    marginBottom: 10
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 12
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFF4'
  },
  sheetAppLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10
  },
  sheetAppIcon: {
    width: 26,
    height: 26,
    borderRadius: 7,
    marginRight: 10
  },
  sheetAppFallback: {
    width: 26,
    height: 26,
    borderRadius: 7,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F2F7'
  },
  sheetAppFallbackText: {
    fontSize: 11,
    color: '#6E6E73',
    fontWeight: '800'
  },
  sheetAppName: {
    flex: 1,
    color: '#1C1C1E',
    fontSize: 15,
    fontWeight: '500'
  },
  sheetAppTime: {
    color: '#1C1C1E',
    fontSize: 14,
    fontWeight: '600'
  },
  sheetEmpty: {
    color: '#75757A',
    fontSize: 14
  },

  // --- Day View Styles ---
  dayViewContainer: {
    marginTop: 20,
    flex: 1,
  },
  dayChartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 370,
    marginBottom: 28,
  },
  dayChartContainerCompact: {
    justifyContent: 'center',
    gap: 34
  },
  dayChartContainerSpread: {
    justifyContent: 'space-between',
    gap: 10
  },
  dayBarColumn: {
    alignItems: 'flex-start',
    width: (width - 48 - 30) / 4,
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
    marginBottom: 26
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
