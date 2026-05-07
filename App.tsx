import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BackHandler, StyleSheet, View, StatusBar, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import EntryScreen from './src/features/onboarding/EntryScreen';
import { PermissionSetupScreen } from './src/features/onboarding/PermissionSetupScreen';
import { AppSelectionScreen } from './src/features/onboarding/AppSelectionScreen'; 
import  OverviewScreen  from './src/features/home/OverviewScreen';
import StreakScreen from './src/features/journey/StreakScreen';
import { HomeScreen } from './src/features/detox/HomeScreen';
import { BottomNav } from './src/components/BottomNav';
import { UserStore } from './src/services/storage';
import { ScreenTimeService } from './src/services/ScreenTimeService';

type AppStep = 'entry' | 'permissions' | 'settings' | 'selection' | 'main';
type MainTab = 'home' | 'streak' | 'analytics';
type Route = {
  step: AppStep;
  tab: MainTab;
};

const App = () => {
  const isDark = useColorScheme() === 'dark';
  const appBg = isDark ? '#121418' : '#FFFFFF';
  const [currentStep, setCurrentStep] = useState<AppStep>('entry');
  const [activeTab, setActiveTab] = useState<MainTab>('home');
  const [mountedTabs, setMountedTabs] = useState<Record<MainTab, boolean>>({
    home: true,
    streak: false,
    analytics: false
  });
  const [isReady, setIsReady] = useState(false);
  const routeRef = useRef<Route>({ step: 'entry', tab: 'home' });
  const historyRef = useRef<Route[]>([]);
  const isMain = currentStep === 'main';

  const applyRoute = useCallback((route: Route) => {
    routeRef.current = route;
    setCurrentStep(route.step);
    setActiveTab(route.tab);
    setMountedTabs(prev => (prev[route.tab] ? prev : { ...prev, [route.tab]: true }));
  }, []);

  const navigate = useCallback((next: Partial<Route>, options: { replace?: boolean } = {}) => {
    const current = routeRef.current;
    const route = { ...current, ...next };
    if (route.step === current.step && route.tab === current.tab) return;
    if (!options.replace) historyRef.current = [...historyRef.current, current];
    applyRoute(route);
  }, [applyRoute]);

  const handleTabChange = useCallback((tab: MainTab) => {
    setMountedTabs(prev => (prev[tab] ? prev : { ...prev, [tab]: true }));
    navigate({ step: 'main', tab });
  }, [navigate]);

  useEffect(() => {
    const initialize = async () => {
      try {
        const [savedLimits, hasCompletedOnboarding] = await Promise.all([
          UserStore.getAllLimits(),
          UserStore.hasCompletedOnboarding()
        ]);
        if (hasCompletedOnboarding || Object.keys(savedLimits).length > 0) {
          if (!hasCompletedOnboarding) await UserStore.completeOnboarding();
          historyRef.current = [];
          applyRoute({ step: 'main', tab: 'home' });
        } else {
          historyRef.current = [];
          applyRoute({ step: 'entry', tab: 'home' });
        }
        try {
          const installedApps = await ScreenTimeService.getInstalledApps();
          const appNames = installedApps.reduce<Record<string, string>>((acc, app) => {
            acc[app.packageName] = app.appName;
            return acc;
          }, {});
          await ScreenTimeService.syncFocusModeConfig(savedLimits, appNames);
        } catch { console.warn('Focus config sync failed.'); }
      } catch { console.warn('Storage check failed.'); }
      finally { setIsReady(true); }
    };
    initialize();
  }, [applyRoute]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      const previous = historyRef.current.pop();
      if (!previous) return false;
      applyRoute(previous);
      return true;
    });
    return () => subscription.remove();
  }, [applyRoute]);

  useEffect(() => {
    if (!isMain) return;
    const timer = setTimeout(() => {
      setMountedTabs({ home: true, streak: true, analytics: true });
    }, 350);
    return () => clearTimeout(timer);
  }, [isMain]);

  if (!isReady) return <View style={{ flex: 1, backgroundColor: appBg }} />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={appBg} />
      <View style={[styles.container, { backgroundColor: appBg }]}>
        {currentStep === 'entry' && <EntryScreen onAnimationComplete={() => navigate({ step: 'permissions', tab: 'home' })} />}

        {currentStep === 'permissions' && (
          <PermissionSetupScreen onComplete={() => navigate({ step: 'selection', tab: 'home' })} />
        )}

        {currentStep === 'settings' && (
          <PermissionSetupScreen actionLabel="Done" onComplete={() => navigate({ step: 'main' })} />
        )}

        {currentStep === 'selection' && (
          <AppSelectionScreen
            onComplete={async () => {
              await UserStore.completeOnboarding();
              navigate({ step: 'main' });
            }}
          />
        )}

        {currentStep === 'main' && (
          <View style={styles.main}>
            {mountedTabs.home && (
              <View pointerEvents={isMain && activeTab === 'home' ? 'auto' : 'none'} style={[styles.tabScreen, activeTab === 'home' ? styles.tabVisible : styles.tabHidden]}>
                <OverviewScreen active={activeTab === 'home'} />
              </View>
            )}
            {mountedTabs.streak && (
              <View pointerEvents={isMain && activeTab === 'streak' ? 'auto' : 'none'} style={[styles.tabScreen, activeTab === 'streak' ? styles.tabVisible : styles.tabHidden]}>
                <StreakScreen
                  active={activeTab === 'streak'}
                  onEditApps={() => navigate({ step: 'selection' })}
                  onOpenFocusSetup={() => navigate({ step: 'settings' })}
                />
              </View>
            )}
            {mountedTabs.analytics && (
              <View pointerEvents={isMain && activeTab === 'analytics' ? 'auto' : 'none'} style={[styles.tabScreen, activeTab === 'analytics' ? styles.tabVisible : styles.tabHidden]}>
                <HomeScreen active={activeTab === 'analytics'} />
              </View>
            )}
            <View pointerEvents="box-none" style={styles.bottomNavWrap}>
              <BottomNav active={activeTab} onChange={handleTabChange} />
            </View>
          </View>
        )}
      </View>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({ 
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  main: { flex: 1 },
  tabScreen: {
    ...StyleSheet.absoluteFillObject
  },
  tabVisible: {
    opacity: 1
  },
  tabHidden: {
    opacity: 0
  },
  bottomNavWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10
  }
});

export default App;
