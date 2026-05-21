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
  AppState,
  InteractionManager,
  useColorScheme,
} from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenTimeService, DailyUsageMap } from '../../services/ScreenTimeService';
import { UserStore } from '../../services/storage';
import { useMidnightRefresh } from '../../hooks/useMidnightRefresh';

const { width, height: windowHeight } = Dimensions.get('window');
const CATEGORY_SHEET_HEIGHT = Math.min(430, Math.max(340, windowHeight * 0.48));

const COLORS = {
  social: { solid: '#2563EB', light: '#EAF2FF', border: '#2563EB' },
  games: { solid: '#EF4444', light: '#FFEDEA', border: '#EF4444' },
  entertainment: { solid: '#F59E0B', light: '#FFF5D6', border: '#C47A00' },
  creativity: { solid: '#D946EF', light: '#FCEBFF', border: '#B92ED1' },
  productivityFinance: { solid: '#0D9488', light: '#E0F7F4', border: '#0D9488' },
  education: { solid: '#16A34A', light: '#EAF8EC', border: '#15803D' },
  informationReading: { solid: '#7C3AED', light: '#F1EAFF', border: '#7C3AED' },
  healthFitness: { solid: '#F97316', light: '#FFF0E2', border: '#EA580C' },
  utilities: { solid: '#64748B', light: '#EEF2F7', border: '#475569' },
  shoppingFood: { solid: '#DB2777', light: '#FCE7F3', border: '#BE185D' },
  travel: { solid: '#06B6D4', light: '#E2F8FC', border: '#0891B2' },
  others: { solid: '#111827', light: '#F1F5F9', border: '#111827' },
  textMain: '#000000',
  textSecondary: '#6F737C',
  bg: '#FFFFFF',
  cardBg: '#F2F2F7',
};

type AppRow = {
  id: string;
  name: string;
  minutes: number;
  totalMs: number;
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

type CategoryPalette = Record<CategoryKey, { light: string; border: string }>;

const DARK_CATEGORY_COLORS: Record<CategoryKey, { solid: string; light: string; border: string }> = {
  social: { solid: '#60A5FA', light: '#142D4E', border: '#60A5FA' },
  games: { solid: '#F87171', light: '#421C1C', border: '#F87171' },
  entertainment: { solid: '#FBBF24', light: '#3D2C12', border: '#FBBF24' },
  creativity: { solid: '#E879F9', light: '#3B1645', border: '#E879F9' },
  productivityFinance: { solid: '#2DD4BF', light: '#103B38', border: '#2DD4BF' },
  education: { solid: '#4ADE80', light: '#15351F', border: '#4ADE80' },
  informationReading: { solid: '#A78BFA', light: '#2A2145', border: '#A78BFA' },
  healthFitness: { solid: '#FB923C', light: '#3F2615', border: '#FB923C' },
  utilities: { solid: '#CBD5E1', light: '#26303D', border: '#CBD5E1' },
  shoppingFood: { solid: '#F472B6', light: '#42172D', border: '#F472B6' },
  travel: { solid: '#22D3EE', light: '#123A42', border: '#22D3EE' },
  others: { solid: '#E5E7EB', light: '#202633', border: '#E5E7EB' },
};

type ChartCategory = {
  key: CategoryKey | 'otherSummary';
  label: string;
  minutes: number;
  color: { light: string; border: string };
  includedKeys: CategoryKey[];
};

type SelectedDay = {
  key: string;
  label: string;
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

const GLYPH_SIZE = 18;
const WEEK_CHART_MIN_HEIGHT = 120;
const WEEK_CHART_MAX_HEIGHT = 200;
const WEEK_CHART_LABEL_HEIGHT = 24;
const WEEK_AXIS_LABEL_HEIGHT = 14;
const WEEK_AXIS_LABEL_MIN_GAP = 22;
const FONT_SANS = Platform.select({ ios: 'Geist-Regular', android: 'Geist-Regular', default: 'System' });
const FONT_SANS_SEMIBOLD = Platform.select({ ios: 'Geist-SemiBold', android: 'Geist-SemiBold', default: 'System' });
const FONT_MONO = Platform.select({ ios: 'GeistMono-Regular', android: 'GeistMono-Regular', default: 'monospace' });
const FONT_SCRIPT = Platform.select({ ios: 'PlaywriteDESAS-Light', android: 'PlaywriteDESAS-Light', default: 'System' });

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

const buildChartCategories = (totals: Record<CategoryKey, number>, palette: CategoryPalette, topCount = 3): ChartCategory[] => {
  const specificKeys = CATEGORY_KEYS.filter((key) => key !== 'others');
  const sorted = specificKeys
    .map((key) => ({ key, minutes: totals[key] || 0 }))
    .filter((item) => item.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);
  const top = sorted.slice(0, topCount);
  const rest = [...sorted.slice(topCount), { key: 'others' as CategoryKey, minutes: totals.others || 0 }]
    .filter((item) => item.minutes > 0);
  const result: ChartCategory[] = top.map(({ key, minutes }) => ({
    key,
    label: CATEGORY_LABELS[key],
    minutes,
    color: palette[key],
    includedKeys: [key]
  }));
  const restMinutes = rest.reduce((acc, item) => acc + item.minutes, 0);
  if (restMinutes > 0) {
    result.push({
      key: 'otherSummary',
      label: 'Other',
      minutes: restMinutes,
      color: palette.others,
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

const formatCompactTime = (mins: number) => formatTime(mins).replace(' ', '');

const formatAxisTime = (mins: number) => {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

const getTotalMinutesForDay = (dayMap: Record<string, number> | undefined) =>
  Math.floor(Object.values(dayMap || {}).reduce((sum, ms) => sum + ms, 0) / 60000);

const getSavedMinutesForDay = (
  dayMap: Record<string, number> | undefined,
  baselineMinutes: number
) => Math.max(baselineMinutes - getTotalMinutesForDay(dayMap), 0);

const getRoundedWeekAxisMax = (minutes: number) => {
  if (minutes <= 10) return Math.ceil(minutes / 5) * 5;
  if (minutes <= 60) return Math.ceil(minutes / 20) * 20;
  if (minutes <= 180) return Math.ceil(minutes / 30) * 30;
  if (minutes <= 720) return Math.ceil(minutes / 60) * 60;
  return Math.ceil(minutes / 120) * 120;
};

const getPacingFace = (usageMinutes: number, limitMinutes: number) => {
  if (limitMinutes <= 0) return ':)';
  const ratio = usageMinutes / limitMinutes;
  if (ratio >= 1) return ':|';
  if (ratio >= 0.8) return ':o';
  return ':)';
};

const getDaysSince = (startDateKey: string | null, endDateKey: string) => {
  if (!startDateKey) return 1;
  const start = new Date(`${startDateKey}T00:00:00`).getTime();
  const end = new Date(`${endDateKey}T00:00:00`).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 1;
  return Math.floor((end - start) / 86400000) + 1;
};

const hexToRgba = (hex: string, alpha: number) => {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const CategoryGlyph = ({ category, color }: { category: CategoryKey | 'otherSummary'; color: string }) => {
  const soft = hexToRgba(color, 0.14);
  const medium = hexToRgba(color, 0.24);
  const common = { stroke: color, strokeWidth: 1.85, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (category) {
    case 'social':
      return (
        <Svg width={GLYPH_SIZE} height={GLYPH_SIZE} viewBox="0 0 24 24">
          <Path d="M5 6.5h9.2a3.2 3.2 0 0 1 3.3 3.2v1.9a3.2 3.2 0 0 1-3.3 3.2H9.4L5.3 18v-3.2H5a3.2 3.2 0 0 1-3.2-3.2V9.7A3.2 3.2 0 0 1 5 6.5z" fill={soft} {...common} />
          <Path d="M12 15.6h2.9l3.8 2.9v-3h.2a3 3 0 0 0 3-3v-1.4a3 3 0 0 0-3-3h-.7" fill="none" {...common} opacity={0.58} />
          <Path d="M6.3 10.5h6.4M6.3 13h4.1" fill="none" {...common} />
        </Svg>
      );
    case 'games':
      return (
        <Svg width={GLYPH_SIZE} height={GLYPH_SIZE} viewBox="0 0 24 24">
          <Path d="M6.5 7.2h11c2.3 0 3.8 1.6 4.2 3.8l.5 3.9c.3 2.6-1.3 4.5-3.4 3.2l-2.5-1.5H7.7l-2.5 1.5c-2.1 1.3-3.7-.6-3.4-3.2l.5-3.9c.4-2.2 1.9-3.8 4.2-3.8z" fill={soft} {...common} />
          <Path d="M7.2 10v5M4.7 12.5h5" fill="none" {...common} />
          <Circle cx={16.4} cy={11.1} r={1.25} fill={color} />
          <Circle cx={19} cy={14.2} r={1.25} fill={color} opacity={0.78} />
        </Svg>
      );
    case 'entertainment':
      return (
        <Svg width={GLYPH_SIZE} height={GLYPH_SIZE} viewBox="0 0 24 24">
          <Rect x={3} y={5} width={18} height={14} rx={3.2} fill={soft} {...common} />
          <Path d="M10 9l5 3-5 3V9z" fill={color} stroke="none" />
          <Path d="M6.2 7.8h2.1M16 7.8h1.8" fill="none" {...common} opacity={0.6} />
        </Svg>
      );
    case 'creativity':
      return (
        <Svg width={GLYPH_SIZE} height={GLYPH_SIZE} viewBox="0 0 24 24">
          <Path d="M6.2 16.8 16.8 6.2l2.8 2.8L9 19.6l-4.2.9 1.4-3.7z" fill={soft} {...common} />
          <Path d="M14.8 8.2l2.9 2.9" fill="none" {...common} />
          <Path d="M6.2 5.6l.7-1.7.7 1.7 1.7.7-1.7.7-.7 1.7-.7-1.7-1.7-.7 1.7-.7z" fill={medium} stroke="none" />
        </Svg>
      );
    case 'productivityFinance':
      return (
        <Svg width={GLYPH_SIZE} height={GLYPH_SIZE} viewBox="0 0 24 24">
          <Rect x={4} y={5} width={16} height={15} rx={3} fill={soft} {...common} />
          <Path d="M8 3.6v3.3M16 3.6v3.3M4 10h16" fill="none" {...common} />
          <Path d="m8 15 2 2 5-5" fill="none" {...common} />
          <Path d="M17.3 15.5h1.1" fill="none" {...common} opacity={0.6} />
        </Svg>
      );
    case 'education':
      return (
        <Svg width={GLYPH_SIZE} height={GLYPH_SIZE} viewBox="0 0 24 24">
          <Path d="M3 8.2 12 4l9 4.2-9 4.2-9-4.2z" fill={soft} {...common} />
          <Path d="M6.5 10.2v4.5c1.8 1.7 9.2 1.7 11 0v-4.5" fill="none" {...common} />
          <Path d="M20.8 8.7v5.1" fill="none" {...common} />
          <Circle cx={20.8} cy={16} r={1.1} fill={color} />
        </Svg>
      );
    case 'informationReading':
      return (
        <Svg width={GLYPH_SIZE} height={GLYPH_SIZE} viewBox="0 0 24 24">
          <Rect x={4} y={5} width={16} height={14} rx={2.5} fill={soft} {...common} />
          <Path d="M8 8.5h8M8 12h8M8 15.5h5.5" fill="none" {...common} />
          <Path d="M17 15.2l1.5 1.5 2.3-3" fill="none" {...common} />
        </Svg>
      );
    case 'healthFitness':
      return (
        <Svg width={GLYPH_SIZE} height={GLYPH_SIZE} viewBox="0 0 24 24">
          <Path d="M12 20s-7-4.2-8.7-8.8C2.2 8 4.1 5 7.2 5c1.8 0 3.1 1 4.8 3 1.7-2 3-3 4.8-3 3.1 0 5 3 3.9 6.2C19 15.8 12 20 12 20z" fill={soft} {...common} />
          <Path d="M5.9 12.7h3l1.2-2.4 2.1 4.9 1.7-3.2h4.1" fill="none" {...common} />
        </Svg>
      );
    case 'utilities':
      return (
        <Svg width={GLYPH_SIZE} height={GLYPH_SIZE} viewBox="0 0 24 24">
          <Path d="M4 7h16M4 12h16M4 17h16" fill="none" {...common} />
          <Circle cx={8.2} cy={7} r={2.1} fill={soft} {...common} />
          <Circle cx={15.8} cy={12} r={2.1} fill={soft} {...common} />
          <Circle cx={10.8} cy={17} r={2.1} fill={soft} {...common} />
        </Svg>
      );
    case 'shoppingFood':
      return (
        <Svg width={GLYPH_SIZE} height={GLYPH_SIZE} viewBox="0 0 24 24">
          <Path d="M6.8 8.8h10.4l1 10.2H5.8l1-10.2z" fill={soft} {...common} />
          <Path d="M9 8.8c0-2.2 1.2-4.1 3-4.1s3 1.9 3 4.1" fill="none" {...common} />
          <Path d="M9.2 13.5h5.6M10.4 16h3.2" fill="none" {...common} opacity={0.72} />
        </Svg>
      );
    case 'travel':
      return (
        <Svg width={GLYPH_SIZE} height={GLYPH_SIZE} viewBox="0 0 24 24">
          <Circle cx={12} cy={12} r={8.5} fill={soft} {...common} />
          <Path d="m15.8 8.2-2.1 5.5-5.5 2.1 2.1-5.5 5.5-2.1z" fill={medium} {...common} />
          <Circle cx={12} cy={12} r={1} fill={color} />
        </Svg>
      );
    case 'others':
    case 'otherSummary':
    default:
      return (
        <Svg width={GLYPH_SIZE} height={GLYPH_SIZE} viewBox="0 0 24 24">
          <Circle cx={7} cy={7} r={2.7} fill={soft} {...common} />
          <Circle cx={17} cy={7} r={2.7} fill={soft} {...common} />
          <Circle cx={7} cy={17} r={2.7} fill={soft} {...common} />
          <Circle cx={17} cy={17} r={2.7} fill={soft} {...common} />
        </Svg>
      );
  }
};

export default function ScreenTimeDashboard({ active = true }: { active?: boolean }) {
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const ui = {
    bg: isDark ? '#121418' : COLORS.bg,
    text: isDark ? '#FFFFFF' : COLORS.textMain,
    textSecondary: isDark ? '#A5ACB8' : COLORS.textSecondary,
    border: isDark ? 'rgba(255,255,255,0.08)' : '#EEE8DC',
    track: isDark ? '#2B313B' : '#E5E5EA',
    sheet: isDark ? '#171C24' : '#FFFFFF'
  };
  const categoryPalette: CategoryPalette = isDark ? DARK_CATEGORY_COLORS : COLORS;
  const screenGradientColors = isDark
    ? ['#121418', '#14171A', '#171A16', '#121418']
    : ['#FFFFFF', '#FFFCF6', '#FFFFFF'];
  const chartFadeTail = isDark ? '#1E232B' : '#FFFFFF';
  const [viewMode, setViewMode] = useState('day');
  const [storedStats, setStoredStats] = useState<DailyUsageMap>({});
  const [trackingStartDate, setTrackingStartDate] = useState<string | null>(null);
  const [limits, setLimits] = useState<Record<string, number>>({});
  const [appNames, setAppNames] = useState<Record<string, string>>({});
  const [appIcons, setAppIcons] = useState<Record<string, string | undefined>>({});
  const [selectedCategory, setSelectedCategory] = useState<ChartCategory | null>(null);
  const [categorySheetVisible, setCategorySheetVisible] = useState(false);
  const [selectedDay, setSelectedDay] = useState<SelectedDay | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [todayKey, setTodayKey] = useState(formatDateKey(new Date()));
  const [fadeAnim] = useState(new Animated.Value(1));
  const [toggleAnim] = useState(new Animated.Value(1));
  const sheetTranslateY = useRef(new Animated.Value(320)).current;
  const daySheetTranslateY = useRef(new Animated.Value(260)).current;
  const isWeek = viewMode === 'week';

  const load = useCallback(async () => {
    const savedTrackingStartDate = UserStore.ensureTrackingStartDate();
    await ScreenTimeService.storeTodayStats(false, savedTrackingStartDate);
    const [dailyStats, installedApps, savedLimits] = await Promise.all([
      ScreenTimeService.getStoredDailyStats(),
      ScreenTimeService.getInstalledApps(),
      UserStore.getAllLimits()
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
    setStoredStats(dailyStats);
    setTrackingStartDate(savedTrackingStartDate);
    setLimits(savedLimits || {});
  }, []);

  useEffect(() => {
    if (!active) return;
    const task = InteractionManager.runAfterInteractions(load);
    return () => task.cancel();
  }, [active, load]);

  useEffect(() => {
    if (!active) return;
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
  }, [active, load]);

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
  const weekRangeLabel = useMemo(() => {
    const first = new Date(`${weekDays[0]?.key || todayKey}T00:00:00`);
    const last = new Date(`${weekDays[6]?.key || todayKey}T00:00:00`);
    const firstLabel = first.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const lastLabel = last.toLocaleDateString('en-US', first.getMonth() === last.getMonth() ? { day: 'numeric' } : { month: 'short', day: 'numeric' });
    return `${firstLabel} - ${lastLabel}`;
  }, [todayKey, weekDays]);

  const todayApps = useMemo(() => {
    const todayMap = storedStats[todayKey] || {};
    return Object.entries(todayMap)
      .map(([pkg, ms]) => ({
        id: pkg,
        name: appNames[pkg] || labelFromPackage(pkg),
        minutes: Math.floor(ms / 60000),
        totalMs: ms,
        iconBase64: appIcons[pkg]
      }))
      .filter((row) => row.totalMs > 0)
      .sort((a, b) => b.totalMs - a.totalMs);
  }, [appIcons, appNames, storedStats, todayKey]);

  const visibleTodayApps = useMemo(
    () => todayApps.filter((app) => app.minutes > 0),
    [todayApps]
  );

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

  const categoryMinutes = useMemo(() => {
    const totals = createEmptyCategoryTotals();
    CATEGORY_KEYS.forEach((key) => {
      totals[key] = Math.floor(categoryApps[key].reduce((sum, app) => sum + app.totalMs, 0) / 60000);
    });
    return totals;
  }, [categoryApps]);

  const weekData = useMemo(() => {
    return weekDays.map((day) => {
      const dayMap = storedStats[day.key] || {};
      const totals = createEmptyCategoryTotals();
      Object.entries(dayMap).forEach(([pkg, ms]) => {
        const appName = appNames[pkg] || labelFromPackage(pkg);
        const category = categorizeApp(appName, pkg);
        totals[category] += Math.floor(ms / 60000);
      });
      return { key: day.key, day: day.label, totals };
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
          existing.totalMs += ms;
        } else {
          grouped[category].push({ id: pkg, name, minutes, totalMs: ms, iconBase64: appIcons[pkg] });
        }
      });
    });

    (Object.keys(grouped) as CategoryKey[]).forEach((key) => {
      grouped[key] = grouped[key].sort((a, b) => b.minutes - a.minutes);
    });

    return grouped;
  }, [appIcons, appNames, storedStats, weekDays]);

  const weekTopApp = useMemo(() => {
    const totals: Record<string, AppRow> = {};
    weekDays.forEach((day) => {
      const dayMap = storedStats[day.key] || {};
      Object.entries(dayMap).forEach(([pkg, ms]) => {
        const minutes = Math.floor(ms / 60000);
        if (minutes <= 0) return;
        const existing = totals[pkg];
        if (existing) {
          existing.minutes += minutes;
          existing.totalMs += ms;
        } else {
          totals[pkg] = {
            id: pkg,
            name: appNames[pkg] || labelFromPackage(pkg),
            minutes,
            totalMs: ms,
            iconBase64: appIcons[pkg]
          };
        }
      });
    });
    return Object.values(totals).sort((a, b) => b.minutes - a.minutes)[0] || null;
  }, [appIcons, appNames, storedStats, weekDays]);
  const weekCategoryMinutes = useMemo(
    () => weekData.reduce((acc, d) => {
      CATEGORY_KEYS.forEach((key) => {
        acc[key] += d.totals[key];
      });
      return acc;
    }, createEmptyCategoryTotals()),
    [weekData]
  );
  const weekChartCategories = useMemo(
    () => buildChartCategories(weekCategoryMinutes, categoryPalette, 3),
    [categoryPalette, weekCategoryMinutes]
  );
  const weekTotalMinutes = useMemo(
    () => weekData.reduce((acc, d) => acc + CATEGORY_KEYS.reduce((sum, key) => sum + d.totals[key], 0), 0),
    [weekData]
  );
  const dayChartCategories = useMemo(() => buildChartCategories(categoryMinutes, categoryPalette, 2), [categoryMinutes, categoryPalette]);
  const weekAverageMinutes = Math.floor(weekTotalMinutes / 7);
  const dayTotalMinutes = Math.floor(todayApps.reduce((acc, app) => acc + app.totalMs, 0) / 60000);
  const totalLimitMinutes = Object.values(limits).reduce((sum, limit) => sum + Math.max(0, limit || 0), 0);
  const pacingFace = getPacingFace(dayTotalMinutes, totalLimitMinutes);
  const daysTracked = getDaysSince(trackingStartDate, todayKey);
  const baselineAverageMinutes = useMemo(() => {
    if (!trackingStartDate) return 0;
    const baselineDays = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(`${trackingStartDate}T00:00:00`);
      date.setDate(date.getDate() + i);
      return formatDateKey(date);
    });
    const total = baselineDays.reduce((sum, key) => sum + getTotalMinutesForDay(storedStats[key]), 0);
    return Math.floor(total / baselineDays.length);
  }, [storedStats, trackingStartDate]);
  const canShowSavedTime = daysTracked > 7 && baselineAverageMinutes > 0;
  const daySavedMinutes = useMemo(
    () => getSavedMinutesForDay(storedStats[todayKey], baselineAverageMinutes),
    [baselineAverageMinutes, storedStats, todayKey]
  );
  const shouldShowSavedTime = canShowSavedTime;
  const weekMaxMinutes = Math.max(...weekData.map((d) => CATEGORY_KEYS.reduce((acc, key) => acc + d.totals[key], 0)), 1);
  const weekChartHeight = Math.max(WEEK_CHART_MIN_HEIGHT, Math.min(WEEK_CHART_MAX_HEIGHT, weekMaxMinutes * 20));
  const weekBarMaxHeight = weekChartHeight - WEEK_CHART_LABEL_HEIGHT;
  const weekAxisMaxMinutes = getRoundedWeekAxisMax(Math.max(weekMaxMinutes / 0.85, 1));
  const weekAxisTicks = [weekAxisMaxMinutes, Math.round(weekAxisMaxMinutes / 2), 0];
  const weekAverageLineBottom = WEEK_CHART_LABEL_HEIGHT + Math.min((weekAverageMinutes / weekAxisMaxMinutes) * weekBarMaxHeight, weekBarMaxHeight);
  const weekAverageAxisLabelBottom = Math.min(
    Math.max(weekAverageLineBottom - WEEK_AXIS_LABEL_HEIGHT / 2, WEEK_CHART_LABEL_HEIGHT),
    WEEK_CHART_LABEL_HEIGHT + weekBarMaxHeight - WEEK_AXIS_LABEL_HEIGHT
  );
  const weekAxisLabelItems = weekAxisTicks
    .map((tick) => {
      const rawBottom = Math.min((tick / weekAxisMaxMinutes) * weekBarMaxHeight, weekBarMaxHeight) - WEEK_AXIS_LABEL_HEIGHT / 2;
      const bottom = Math.min(Math.max(rawBottom, 0), weekBarMaxHeight - WEEK_AXIS_LABEL_HEIGHT);
      return {
        key: `week-axis-${tick}`,
        text: tick === 0 ? '0' : formatAxisTime(tick),
        bottom,
        chartBottom: WEEK_CHART_LABEL_HEIGHT + bottom
      };
    })
    .filter((item, index, items) => items.findIndex((candidate) => candidate.text === item.text) === index)
    .filter((item) => (
      weekAverageMinutes <= 0
      || Math.abs(item.chartBottom - weekAverageAxisLabelBottom) >= WEEK_AXIS_LABEL_MIN_GAP
    ));
  const dayMaxMinutes = Math.max(...dayChartCategories.map((item) => item.minutes), 1);
  const maxTodayAppMinutes = Math.max(...visibleTodayApps.map((app) => app.minutes), 1);
  const maxWeekCategoryMinutes = Math.max(...weekChartCategories.map((category) => category.minutes), 1);
  const dayScale = 280 / dayMaxMinutes;
  const selectedApps = selectedCategory
    ? selectedCategory.includedKeys
        .flatMap((key) => (isWeek ? weekCategoryApps[key] : categoryApps[key]))
        .sort((a, b) => b.minutes - a.minutes)
    : [];
  const selectedDayApps = selectedDay
    ? Object.entries(limits)
        .filter(([, limit]) => limit > 0)
        .map(([pkg, limit]) => ({
          id: pkg,
          name: appNames[pkg] || labelFromPackage(pkg),
          minutes: Math.floor(((storedStats[selectedDay.key] || {})[pkg] || 0) / 60000),
          limit
        }))
        .sort((a, b) => (b.minutes / Math.max(b.limit, 1)) - (a.minutes / Math.max(a.limit, 1)) || b.minutes - a.minutes)
        .slice(0, 4)
    : [];
  const selectedDayWasUnderLimit = selectedDayApps.every((app) => app.minutes < app.limit);
  const selectedDayTitle = selectedDay
    ? new Date(`${selectedDay.key}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    : '';

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
    setCategorySheetVisible(true);
    sheetTranslateY.setValue(320);
    Animated.timing(sheetTranslateY, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true
    }).start();
  }, [selectedCategory, sheetTranslateY]);

  useEffect(() => {
    if (!selectedDay) return;
    daySheetTranslateY.setValue(260);
    Animated.timing(daySheetTranslateY, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true
    }).start();
  }, [daySheetTranslateY, selectedDay]);

  const openCategorySheet = useCallback((category: ChartCategory) => {
    setCategorySheetVisible(true);
    setSelectedCategory(category);
  }, []);

  const closeCategorySheet = useCallback(() => {
    Animated.timing(sheetTranslateY, {
      toValue: 320,
      duration: 190,
      useNativeDriver: true
    }).start(({ finished }) => {
      if (finished) {
        setCategorySheetVisible(false);
        setSelectedCategory(null);
      }
    });
  }, [sheetTranslateY]);

  const closeDaySheet = useCallback(() => {
    setSelectedDay(null);
  }, []);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: ui.bg }]}>
      <LinearGradient colors={screenGradientColors} style={styles.container}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + 15,
              paddingBottom: Math.max(insets.bottom, 0) + 176
            }
          ]}
          showsVerticalScrollIndicator={false}
          overScrollMode="never"
          bounces={false}
          alwaysBounceVertical={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.textMain} />}
        >
          
          {/* --- COMMON HEADER --- */}
          <View style={styles.header}>
            <View style={styles.titleWrap}>
              <Text style={[styles.brandMark, { color: isDark ? '#AAB0BD' : '#6E6E73' }]}>unlure</Text>
              <Text style={[styles.title, { color: ui.text }]}>Screen time</Text>
            </View>
            
            <View style={[styles.toggleContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F2F2F7', borderColor: isDark ? 'rgba(255,255,255,0.09)' : '#ECECF2' }]}>
              <Animated.View
                style={[
                  styles.activeSegment,
                  { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#D8D8DE' },
                  { transform: [{ translateX: toggleAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 69] }) }] }
                ]}
              />
              <TouchableOpacity 
                style={styles.toggleButton}
                onPress={() => handleToggleMode('week')}
                activeOpacity={0.7}
              >
                <Text style={[styles.toggleText, { color: isDark ? '#AAB0BD' : '#6F737C' }, isWeek && { color: isDark ? '#F3F4F6' : '#111111' }]}>
                  week
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.toggleButton} 
                onPress={() => handleToggleMode('day')}
                activeOpacity={0.7}
              >
                <Text style={[styles.toggleText, { color: isDark ? '#AAB0BD' : '#6F737C' }, !isWeek && { color: isDark ? '#F3F4F6' : '#111111' }]}>
                  day
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.dateHeader}>
            <Text style={[styles.dateText, { color: ui.textSecondary }]}>{isWeek ? weekRangeLabel : `${todayLabel} ${pacingFace}`}</Text>
            {!isWeek && <Text style={[styles.updatedSmall, { color: ui.textSecondary }]}>{updatedLabel}</Text>}
          </View>

          {/* ========================================= */}
          {/*               WEEK VIEW                   */}
          {/* ========================================= */}
          <Animated.View style={{ opacity: fadeAnim }}>
          {isWeek ? (
            <View style={styles.weekViewContainer}>
              <Text style={[styles.timeBigText, { color: ui.text }]}>{formatTime(weekTotalMinutes)}</Text>
              <Text style={[styles.subTextMain, { color: ui.text }]}>Total usage this week</Text>
              <Text style={[styles.subText, { color: ui.textSecondary }]}>Daily average this week: {formatTime(weekAverageMinutes)}</Text>

              <View style={[styles.weekInsightRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.028)' : 'rgba(255,255,255,0.74)', borderColor: isDark ? 'transparent' : ui.border }, isDark && styles.darkSoftBand]}>
                <View style={styles.weekInsightBlock}>
                  <Text style={[styles.weekInsightLabel, { color: ui.textSecondary }]}>Most used app</Text>
                  {weekTopApp ? (
                    <View style={styles.weekInsightIconWrap}>
                      {weekTopApp.iconBase64 ? (
                        <Image source={{ uri: `data:image/png;base64,${weekTopApp.iconBase64}` }} style={styles.weekInsightIcon} resizeMode="cover" />
                      ) : (
                        <View style={[styles.weekInsightIconFallback, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF' }]}>
                          <Text style={[styles.weekInsightIconFallbackText, { color: ui.textSecondary }]}>{weekTopApp.name.charAt(0).toUpperCase()}</Text>
                        </View>
                      )}
                    </View>
                  ) : (
                    <Text style={[styles.weekInsightValue, { color: ui.text }]} numberOfLines={1}>No usage yet</Text>
                  )}
                </View>
                <Text style={[styles.weekInsightTime, { color: ui.text }]}>{weekTopApp ? formatTime(weekTopApp.minutes) : '0m'}</Text>
              </View>

              <View style={[styles.weekChartContainer, { height: weekChartHeight }]}>
                <View style={styles.gridLineContainer}>
                  {weekAxisTicks.map((tick) => (
                    <View style={[styles.gridLine, { borderBottomColor: ui.border }]} key={tick} />
                  ))}
                </View>

                <View style={styles.barsWrapper}>
                  {weekData.map((item) => {
                    const segments = weekChartCategories.map((category) => {
                      const minutes = category.includedKeys.reduce((acc, key) => acc + item.totals[key], 0);
                      return {
                        ...category,
                        minutes,
                        height: minutes > 0 ? Math.max((minutes / weekAxisMaxMinutes) * weekBarMaxHeight, 6) : 0
                      };
                    }).filter((segment) => segment.height > 0);
                    return (
                      <Pressable
                        key={item.key}
                        style={({ pressed }) => [
                          styles.barColumn,
                          pressed && styles.barColumnPressed
                        ]}
                        onPress={() => setSelectedDay({ key: item.key, label: item.day })}
                      >
                        <View style={[styles.weekBarStack, { height: weekBarMaxHeight }]}>
                          {segments.map((segment, segmentIndex) => (
                            <LinearGradient
                              key={segment.key}
                              colors={
                                isDark
                                  ? [hexToRgba(segment.color.border, 0.54), hexToRgba(segment.color.border, 0.16)]
                                  : [segment.color.light, chartFadeTail]
                              }
                              start={{ x: 0.5, y: 0 }}
                              end={{ x: 0.5, y: 1 }}
                              style={[
                                styles.weekBarSegment,
                                {
                                  height: segment.height,
                                  borderColor: segment.color.border,
                                  borderTopLeftRadius: segmentIndex === 0 ? 6 : 3,
                                  borderTopRightRadius: segmentIndex === 0 ? 6 : 3,
                                  borderBottomLeftRadius: segmentIndex === segments.length - 1 ? 6 : 3,
                                  borderBottomRightRadius: segmentIndex === segments.length - 1 ? 6 : 3,
                                  marginBottom: segmentIndex === segments.length - 1 ? 0 : 2
                                }
                              ]}
                            />
                          ))}
                        </View>
                        <Text style={[styles.xLabel, { color: ui.text }]}>{item.day}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                {weekAverageMinutes > 0 && (
                  <View pointerEvents="none" style={[styles.averageLineWrap, { bottom: weekAverageLineBottom }]}>
                    <View style={[styles.averageLine, { borderColor: ui.textSecondary }]} />
                  </View>
                )}
                {weekAverageMinutes > 0 && (
                  <Text
                    pointerEvents="none"
                    style={[
                      styles.averageAxisLabel,
                      {
                        bottom: weekAverageAxisLabelBottom,
                        color: ui.textSecondary
                      }
                    ]}
                  >
                    avg
                  </Text>
                )}
                <View pointerEvents="none" style={styles.weekAxisLabels}>
                  {weekAxisLabelItems.map((item) => (
                    <Text
                      key={item.key}
                      style={[
                        styles.weekAxisLabel,
                        {
                          bottom: item.bottom,
                          color: ui.textSecondary
                        }
                      ]}
                    >
                      {item.text}
                    </Text>
                  ))}
                </View>
              </View>

              <View style={styles.legendContainer}>
                {weekChartCategories.map((category) => (
                  <View style={styles.legendItem} key={category.key}>
                    <Text style={[styles.legendLabel, { color: category.color.border }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.82}>{category.label}</Text>
                    <Text style={[styles.legendValue, { color: ui.text }]}>{formatTime(category.minutes)}</Text>
                  </View>
                ))}
              </View>
              <Text style={[styles.updatedText, { color: ui.textSecondary }]}>{updatedLabel}</Text>

              <Text style={[styles.sectionTitle, { color: ui.text }]}>Categories</Text>
              <View style={styles.iosList}>
                {weekChartCategories.map((category) => (
                  <Pressable
                    key={category.key}
                    style={({ pressed }) => [styles.iosUsageRow, { borderBottomColor: ui.border }, pressed && styles.iosUsageRowPressed]}
                    onPress={() => openCategorySheet(category)}
                  >
                    <View style={styles.iosUsageMain}>
                      <View
                        accessibilityLabel={CATEGORY_ICONS[category.key]}
                        style={[
                          styles.iosGlyph,
                          {
                            backgroundColor: isDark ? 'rgba(255,255,255,0.055)' : 'rgba(255,255,255,0.72)',
                            borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#EEE8DC'
                          }
                        ]}
                      >
                        <CategoryGlyph category={category.key} color={category.color.border} />
                      </View>
                      <Text style={[styles.iosUsageName, styles.weekCategoryName, { color: ui.text }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.82}>{category.label}</Text>
                    </View>
                    <View style={styles.iosUsageRight}>
                      <Text style={[styles.iosUsageTime, { color: ui.text }]}>{formatTime(category.minutes)}</Text>
                      <View style={[styles.iosMiniTrack, { backgroundColor: ui.track }]}>
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
              <Text style={[styles.timeBigText, { color: ui.text }]}>
                {formatTime(dayTotalMinutes)}
              </Text>
              <Text style={[styles.subTextMain, { color: ui.text }]}>Screen time today</Text>
              <Text style={[styles.savedVsAverage, { color: shouldShowSavedTime ? '#39B987' : ui.textSecondary }]}>
                {shouldShowSavedTime
                  ? `↓ ${formatTime(daySavedMinutes)} saved vs your average`
                  : 'Building your first week baseline'}
              </Text>
              
              <View style={[
                styles.dayChartContainer,
                dayChartCategories.length === 0
                  ? styles.dayChartContainerQuiet
                  : dayChartCategories.length >= 3
                    ? styles.dayChartContainerSpread
                    : styles.dayChartContainerCompact
              ]}>
                {dayChartCategories.length === 0 ? (
                  <View style={styles.quietDayState}>
                    <Text style={[styles.quietDayTitle, { color: ui.text }]}>The day is quiet.</Text>
                    <Text style={[styles.quietDayCaption, { color: ui.textSecondary }]}>No tracked app time yet.</Text>
                  </View>
                ) : dayChartCategories.map((category) => (
                  <View style={styles.dayBarColumn} key={category.key}>
                    <View style={styles.dayBarLabelContainer}>
                      <Text style={[styles.dayBarLabelTitle, { color: category.color.border }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.76}>{category.label}</Text>
                      <Text style={[styles.dayBarLabelValue, { color: ui.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82}>
                        {formatCompactTime(category.minutes)}
                      </Text>
                    </View>
                    <LinearGradient
                      colors={
                        isDark
                          ? [hexToRgba(category.color.border, 0.54), hexToRgba(category.color.border, 0.16)]
                          : [category.color.light, chartFadeTail]
                      }
                      start={{ x: 0.5, y: 0 }}
                      end={{ x: 0.5, y: 1 }}
                      style={[
                        styles.giantBar,
                        {
                          height: Math.max(category.minutes * dayScale, category.minutes > 0 ? 30 : 0),
                          borderColor: category.color.border
                        }
                      ]}
                    />
                  </View>
                ))}
              </View>

              <Text style={[styles.sectionTitle, { color: ui.text }]}>Apps today</Text>
              <View style={styles.iosList}>
                {visibleTodayApps.map((app) => {
                  const category = categorizeApp(app.name, app.id);
                  const theme = categoryPalette[category];
                  return (
                    <View style={[styles.iosUsageRow, { borderBottomColor: ui.border }]} key={app.id}>
                      <View style={styles.iosUsageMain}>
                        {app.iconBase64 ? (
                          <Image source={{ uri: `data:image/png;base64,${app.iconBase64}` }} style={styles.appIconImage} resizeMode="cover" />
                        ) : (
                          <View style={styles.appIconFallback}>
                            <Text style={[styles.iosGlyphText, { color: theme.border }]}>{app.name.charAt(0).toUpperCase()}</Text>
                          </View>
                        )}
                        <Text style={[styles.iosUsageName, { color: ui.text }]} numberOfLines={1}>{app.name}</Text>
                      </View>
                      <View style={styles.iosUsageRight}>
                      <Text style={[styles.iosUsageTime, { color: ui.text }]}>{formatTime(app.minutes)}</Text>
                        <View style={[styles.iosMiniTrack, { backgroundColor: ui.track }]}>
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
                {visibleTodayApps.length === 0 ? (
                  <View style={styles.iosEmpty}>
                    <Text style={[styles.emptySerif, { color: ui.text }]}>No apps tracked today.</Text>
                    <Text style={[styles.emptyHint, { color: ui.textSecondary }]}>Your timeline will appear when there is something to count.</Text>
                  </View>
                ) : null}
              </View>

            </View>
          )}
          </Animated.View>

        </ScrollView>
      </LinearGradient>
      <Modal visible={categorySheetVisible} transparent statusBarTranslucent animationType="none" onRequestClose={closeCategorySheet}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.sheetBackdrop} onPress={closeCategorySheet} />
          <Animated.View style={[styles.sheetWrap, { backgroundColor: ui.sheet, transform: [{ translateY: sheetTranslateY }] }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetTitleRow}>
              <Text style={[styles.sheetTitle, { color: ui.text }]}>
                {selectedCategory ? `${selectedCategory.label} Apps` : 'Apps'}
              </Text>
              <Pressable style={styles.sheetCloseButton} onPress={closeCategorySheet} hitSlop={10}>
                <Text style={[styles.sheetCloseText, { color: ui.textSecondary }]}>Close</Text>
              </Pressable>
            </View>
            <ScrollView
              style={styles.sheetList}
              contentContainerStyle={selectedApps.length > 0 ? styles.sheetListContent : styles.sheetEmptyContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {selectedApps.length > 0 ? (
                selectedApps.map((app) => (
                  <View key={app.id} style={[styles.sheetRow, { borderBottomColor: ui.border }]}>
                    <View style={styles.sheetAppLeft}>
                      {app.iconBase64 ? (
                        <Image source={{ uri: `data:image/png;base64,${app.iconBase64}` }} style={styles.sheetAppIcon} resizeMode="cover" />
                      ) : (
                        <View style={styles.sheetAppFallback}>
                          <Text style={[styles.sheetAppFallbackText, { color: ui.textSecondary }]}>{app.name.charAt(0).toUpperCase()}</Text>
                        </View>
                      )}
                      <Text style={[styles.sheetAppName, { color: ui.text }]} numberOfLines={1}>{app.name}</Text>
                    </View>
                    <Text style={[styles.sheetAppTime, { color: ui.text }]}>{formatTime(app.minutes)}</Text>
                  </View>
                ))
              ) : (
                <Text style={[styles.sheetEmpty, { color: ui.textSecondary }]}>No usage in this category yet.</Text>
              )}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
      <Modal visible={Boolean(selectedDay)} transparent statusBarTranslucent animationType="none" onRequestClose={closeDaySheet}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.sheetBackdrop} onPress={closeDaySheet} />
          <Animated.View style={[styles.daySheetWrap, { backgroundColor: ui.sheet, transform: [{ translateY: daySheetTranslateY }] }]}>
            <View style={styles.sheetHandle} />
            <Text style={[styles.daySheetTitle, { color: ui.text }]}>{selectedDayTitle}</Text>
            <View style={[styles.daySheetRule, { backgroundColor: ui.border }]} />
            <Text style={[styles.daySheetStatus, { color: ui.text }]}>
              {selectedDayApps.length === 0
                ? ':) No limited apps that day'
                : selectedDayWasUnderLimit
                  ? ':) Under limit all day'
                  : ':| A limit was crossed'}
            </Text>
            <View style={styles.daySheetApps}>
              {selectedDayApps.map((app) => (
                <View key={app.id} style={styles.daySheetAppRow}>
                  <Text style={[styles.daySheetAppName, { color: ui.textSecondary }]} numberOfLines={1}>{app.name}</Text>
                  <Text style={[styles.daySheetAppUsage, { color: ui.text }]}>{`${formatTime(app.minutes)} / ${formatTime(app.limit)}`}</Text>
                </View>
              ))}
            </View>
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
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    lineHeight: 32,
    fontFamily: FONT_SANS_SEMIBOLD,
    fontWeight: '600',
    color: COLORS.textMain,
    letterSpacing: 0,
  },
  titleWrap: {
    flex: 1,
    paddingRight: 14
  },
  brandMark: {
    color: '#6E6E73',
    fontSize: 18,
    lineHeight: 22,
    fontFamily: FONT_SCRIPT,
    fontWeight: '600',
    letterSpacing: 0,
    marginBottom: 2
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#F2F2F7',
    borderRadius: 22,
    borderWidth: 1,
    padding: 5,
    position: 'relative',
    width: 150,
    height: 44,
    alignItems: 'center'
  },
  toggleButton: {
    flex: 1,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1
  },
  activeSegment: {
    position: 'absolute',
    top: 5,
    left: 5,
    width: 69,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2
  },
  toggleText: {
    fontFamily: FONT_SANS_SEMIBOLD,
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '600',
    textAlign: 'center'
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
    fontFamily: FONT_SANS,
    fontWeight: '500',
  },
  updatedSmall: {
    fontFamily: FONT_MONO,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  
  // --- Week View Styles ---
  weekViewContainer: {
    marginTop: 10,
  },
  timeBigText: {
    fontSize: 64,
    fontFamily: FONT_MONO,
    fontWeight: '500',
    color: COLORS.textMain,
    letterSpacing: 0,
    lineHeight: 70,
  },
  subTextMain: {
    fontSize: 14,
    color: COLORS.textMain,
    fontFamily: FONT_SANS,
    fontWeight: '600',
    marginTop: 4,
  },
  subText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: FONT_SANS,
    fontWeight: '500',
    marginTop: 4,
  },
  savedVsAverage: {
    fontSize: 13,
    fontFamily: FONT_SANS_SEMIBOLD,
    fontWeight: '600',
    marginTop: 5,
    marginBottom: 8
  },
  weekChartContainer: {
    marginTop: 24,
    marginBottom: 30,
    flexDirection: 'row',
  },
  gridLineContainer: {
    position: 'absolute',
    top: 0,
    bottom: WEEK_CHART_LABEL_HEIGHT,
    left: 0,
    right: 0,
    justifyContent: 'space-between',
    zIndex: -1,
  },
  gridLine: {
    borderBottomWidth: 1,
    borderBottomColor: '#EAEAEA',
  },
  averageLineWrap: {
    position: 'absolute',
    left: 10,
    right: 64,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 2
  },
  averageAxisLabel: {
    position: 'absolute',
    right: 0,
    width: 58,
    color: '#6E6E73',
    fontFamily: FONT_MONO,
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 14,
    textAlign: 'right',
    zIndex: 3
  },
  weekAxisLabels: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: WEEK_CHART_LABEL_HEIGHT,
    width: 58,
    zIndex: 3
  },
  weekAxisLabel: {
    position: 'absolute',
    right: 0,
    width: 58,
    fontFamily: FONT_MONO,
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 14,
    textAlign: 'right'
  },
  averageLine: {
    flex: 1,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#B8B8BE'
  },
  barsWrapper: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingRight: 62,
    paddingLeft: 10,
  },
  barColumn: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
    borderRadius: 8,
    paddingHorizontal: 4
  },
  barColumnPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }]
  },
  weekBarStack: {
    width: 20,
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  weekBarSegment: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 6,
  },
  xLabel: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    color: COLORS.textMain,
    fontWeight: '500',
    height: 16, // ALIGNMENT FIX: Consistent height so flexbox keeps bottom aligned
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 10,
  },
  legendItem: {
    alignItems: 'flex-start',
    flex: 1,
  },
  legendLabel: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
    lineHeight: 15,
    flexShrink: 1,
  },
  legendValue: {
    fontFamily: FONT_MONO,
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.textMain,
  },
  weekInsightRow: {
    minHeight: 58,
    borderRadius: 8,
    backgroundColor: '#F7F7FA',
    borderWidth: 1,
    borderColor: '#ECECF2',
    marginTop: 18,
    paddingHorizontal: 14,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  weekInsightBlock: {
    flex: 1,
    marginRight: 12
  },
  weekInsightLabel: {
    fontFamily: FONT_SANS,
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
    marginBottom: 3,
    letterSpacing: 0
  },
  weekInsightValue: {
    fontFamily: FONT_SANS_SEMIBOLD,
    fontSize: 15,
    color: COLORS.textMain,
    fontWeight: '600'
  },
  weekInsightIconWrap: {
    marginTop: 2,
    width: 38,
    height: 38
  },
  weekInsightIcon: {
    width: 38,
    height: 38,
    borderRadius: 10
  },
  weekInsightIconFallback: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ECECF2'
  },
  weekInsightIconFallbackText: {
    fontSize: 15,
    fontFamily: FONT_SANS_SEMIBOLD,
    fontWeight: '800'
  },
  weekInsightTime: {
    fontFamily: FONT_MONO,
    fontSize: 22,
    color: COLORS.textMain,
    fontWeight: '500'
  },
  distributionTrack: {
    height: 14,
    borderRadius: 999,
    flexDirection: 'row',
    overflow: 'hidden',
    marginTop: 24
  },
  distributionSegment: {
    height: '100%'
  },
  distributionLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 18,
    marginBottom: 14
  },
  distributionLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '48%'
  },
  distributionGlyph: {
    width: 18,
    height: 18,
    marginRight: 5,
    alignItems: 'center',
    justifyContent: 'center'
  },
  distributionText: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    fontWeight: '500'
  },
  darkCardLift: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 4
  },
  darkSoftBand: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0
  },
  updatedText: {
    fontFamily: FONT_MONO,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 30,
  },
  sectionTitle: {
    fontFamily: FONT_SANS,
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textMain,
    marginBottom: 6,
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
    marginRight: 10,
    backgroundColor: '#F7F7FA',
    borderWidth: 1,
    borderColor: '#ECECF2'
  },
  iosGlyphDot: {
    width: 10,
    height: 10,
    borderRadius: 5
  },
  iosGlyphText: {
    fontSize: 11,
    fontFamily: FONT_SANS_SEMIBOLD,
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
    fontFamily: FONT_SANS,
    fontWeight: '500',
    lineHeight: 18,
    flexShrink: 1
  },
  weekCategoryName: {
    fontSize: 13,
    lineHeight: 16
  },
  iosUsageRight: {
    width: 78,
    alignItems: 'flex-end'
  },
  iosUsageTime: {
    color: COLORS.textMain,
    fontFamily: FONT_MONO,
    fontSize: 16,
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
    minHeight: 88,
    paddingVertical: 18,
    justifyContent: 'center',
    alignItems: 'flex-start'
  },
  quietDayState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24
  },
  quietDayTitle: {
    fontFamily: FONT_SANS,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '400',
    fontStyle: 'italic',
    textAlign: 'center',
    letterSpacing: 0
  },
  quietDayCaption: {
    marginTop: 9,
    fontSize: 13,
    fontFamily: FONT_SANS,
    fontWeight: '500',
    textAlign: 'center'
  },
  emptySerif: {
    fontFamily: FONT_SANS_SEMIBOLD,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '600',
    letterSpacing: 0
  },
  emptyHint: {
    marginTop: 6,
    fontSize: 12,
    color: '#A0A0A6',
    fontFamily: FONT_SANS,
    lineHeight: 16
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end'
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)'
  },
  sheetWrap: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'android' ? 18 : 24,
    height: CATEGORY_SHEET_HEIGHT,
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
    fontFamily: FONT_SANS_SEMIBOLD,
    fontWeight: '600',
    color: '#111111',
    flex: 1
  },
  sheetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  sheetCloseButton: {
    minHeight: 30,
    justifyContent: 'center',
    paddingLeft: 14
  },
  sheetCloseText: {
    color: '#8E8E93',
    fontSize: 13,
    fontFamily: FONT_SANS,
    fontWeight: '500'
  },
  sheetList: {
    flex: 1
  },
  sheetListContent: {
    paddingBottom: 8
  },
  sheetEmptyContent: {
    flexGrow: 1,
    justifyContent: 'center'
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
    fontFamily: FONT_SANS_SEMIBOLD,
    fontWeight: '800'
  },
  sheetAppName: {
    flex: 1,
    color: '#1C1C1E',
    fontSize: 15,
    fontFamily: FONT_SANS,
    fontWeight: '500'
  },
  sheetAppTime: {
    color: '#1C1C1E',
    fontFamily: FONT_MONO,
    fontSize: 16,
    fontWeight: '500'
  },
  sheetEmpty: {
    color: '#75757A',
    fontFamily: FONT_SANS,
    fontSize: 14
  },
  daySheetWrap: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'android' ? 24 : 30,
    shadowOpacity: 0,
    elevation: 0
  },
  daySheetTitle: {
    fontSize: 18,
    lineHeight: 23,
    fontFamily: FONT_SANS_SEMIBOLD,
    fontWeight: '600',
    color: '#111111',
    marginTop: 4
  },
  daySheetRule: {
    height: 1,
    backgroundColor: '#EFEFF4',
    marginTop: 12,
    marginBottom: 13
  },
  daySheetStatus: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: FONT_SANS,
    fontWeight: '600',
    color: '#111111',
    marginBottom: 10
  },
  daySheetApps: {
    gap: 7
  },
  daySheetAppRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 24
  },
  daySheetAppName: {
    flex: 1,
    marginRight: 12,
    fontSize: 14,
    lineHeight: 19,
    fontFamily: FONT_SANS,
    fontWeight: '500'
  },
  daySheetAppUsage: {
    fontSize: 14,
    lineHeight: 19,
    fontFamily: FONT_MONO,
    fontWeight: '500'
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
  dayChartContainerQuiet: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0
  },
  dayChartContainerCompact: {
    justifyContent: 'center',
    gap: 18
  },
  dayChartContainerSpread: {
    justifyContent: 'center',
    gap: 12
  },
  dayBarColumn: {
    alignItems: 'flex-start',
    width: Math.min(128, Math.max(96, (width - 48 - 24) / 3)),
  },
  dayBarLabelContainer: {
    marginBottom: 8,
    width: '100%'
  },
  dayBarLabelTitle: {
    fontFamily: FONT_SANS,
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
    lineHeight: 17,
    flexShrink: 1
  },
  dayBarLabelValue: {
    fontSize: 24,
    fontFamily: FONT_MONO,
    fontWeight: '500',
    color: COLORS.textMain,
    includeFontPadding: false
  },
  giantBar: {
    width: '100%',
    borderWidth: 1.5,
    borderRadius: 10,
    overflow: 'hidden'
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
    fontFamily: FONT_SANS,
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textMain,
    marginBottom: 4,
  },
  timeBigTextDay: {
    fontSize: 48,
    fontFamily: FONT_MONO,
    fontWeight: '500',
    color: COLORS.textMain,
    letterSpacing: 0,
  },
});
