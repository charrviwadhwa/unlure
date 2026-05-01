import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import EntryScreen from './src/features/onboarding/EntryScreen';
import { AppSelectionScreen } from './src/features/onboarding/AppSelectionScreen'; 
import  OverviewScreen  from './src/features/home/OverviewScreen';
import StreakScreen from './src/features/journey/StreakScreen';
import { HomeScreen } from './src/features/detox/HomeScreen';
import { BottomNav } from './src/components/BottomNav';
import { UserStore } from './src/services/storage';

const App = () => {
  const [currentStep, setCurrentStep] = useState<'entry' | 'selection' | 'main'>('entry');
  const [activeTab, setActiveTab] = useState<'home' | 'streak' | 'analytics'>('home');
  const [isReady, setIsReady] = useState(false);
  const isMain = currentStep === 'main';

  const handleTabChange = useCallback((tab: 'home' | 'streak' | 'analytics') => {
    setActiveTab(prev => (prev === tab ? prev : tab));
  }, []);

  useEffect(() => {
    const initialize = async () => {
      try {
        const savedLimits = await UserStore.getAllLimits();
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

  if (!isReady) return <View style={{ flex: 1, backgroundColor: '#FFFFFF' }} />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.container}>
        {currentStep === 'entry' && <EntryScreen onAnimationComplete={() => setCurrentStep('selection')} />}

        {currentStep === 'selection' && (
          <AppSelectionScreen onComplete={() => setCurrentStep('main')} />
        )}

        {currentStep === 'main' && (
          <View style={styles.main}>
            <View pointerEvents={isMain && activeTab === 'home' ? 'auto' : 'none'} style={[styles.tabScreen, activeTab === 'home' ? styles.tabVisible : styles.tabHidden]}>
              <OverviewScreen />
            </View>
            <View pointerEvents={isMain && activeTab === 'streak' ? 'auto' : 'none'} style={[styles.tabScreen, activeTab === 'streak' ? styles.tabVisible : styles.tabHidden]}>
              <StreakScreen />
            </View>
            <View pointerEvents={isMain && activeTab === 'analytics' ? 'auto' : 'none'} style={[styles.tabScreen, activeTab === 'analytics' ? styles.tabVisible : styles.tabHidden]}>
              <HomeScreen />
            </View>
            <View style={styles.bottomNavWrap}>
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
