import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, StatusBar, useColorScheme } from 'react-native';
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

const App = () => {
  const isDark = useColorScheme() === 'dark';
  const appBg = isDark ? '#121418' : '#FFFFFF';
  const [currentStep, setCurrentStep] = useState<'entry' | 'permissions' | 'settings' | 'selection' | 'main'>('entry');
  const [activeTab, setActiveTab] = useState<'home' | 'streak' | 'analytics'>('home');
  const [mountedTabs, setMountedTabs] = useState<Record<'home' | 'streak' | 'analytics', boolean>>({
    home: true,
    streak: false,
    analytics: false
  });
  const [isReady, setIsReady] = useState(false);
  const isMain = currentStep === 'main';

  const handleTabChange = useCallback((tab: 'home' | 'streak' | 'analytics') => {
    setMountedTabs(prev => (prev[tab] ? prev : { ...prev, [tab]: true }));
    setActiveTab(prev => (prev === tab ? prev : tab));
  }, []);

  useEffect(() => {
    const initialize = async () => {
      try {
        const [savedLimits, installedApps] = await Promise.all([
          UserStore.getAllLimits(),
          ScreenTimeService.getInstalledApps()
        ]);
        const appNames = installedApps.reduce<Record<string, string>>((acc, app) => {
          acc[app.packageName] = app.appName;
          return acc;
        }, {});
        await ScreenTimeService.syncFocusModeConfig(savedLimits, appNames);
        if (Object.keys(savedLimits).length > 0) {
          setCurrentStep('main');
        } else {
          setCurrentStep('entry');
        }
      } catch { console.warn('Storage check failed.'); }
      finally { setIsReady(true); }
    };
    initialize();
  }, []);

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
        {currentStep === 'entry' && <EntryScreen onAnimationComplete={() => setCurrentStep('permissions')} />}

        {currentStep === 'permissions' && (
          <PermissionSetupScreen onComplete={() => setCurrentStep('selection')} />
        )}

        {currentStep === 'settings' && (
          <PermissionSetupScreen actionLabel="Done" onComplete={() => setCurrentStep('main')} />
        )}

        {currentStep === 'selection' && (
          <AppSelectionScreen onComplete={() => setCurrentStep('main')} />
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
                  onEditApps={() => setCurrentStep('selection')}
                  onOpenFocusSetup={() => setCurrentStep('settings')}
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
