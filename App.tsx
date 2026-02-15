import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import EntryScreen from './src/features/onboarding/EntryScreen';
import NameScreen from './src/features/onboarding/NameScreen';
// 1. IMPORT the selection screen (Named import uses { })
import { AppSelectionScreen } from './src/features/onboarding/AppSelectionScreen'; 
import { HomeScreen } from './src/features/detox/HomeScreen';
import { OverviewScreen } from './src/features/home/OverviewScreen';
import { ProfileScreen } from './src/features/user/ProfileScreen';
import { BottomNav } from './src/components/BottomNav';
import { UserStore } from './src/services/storage';

const App = () => {
  // 2. ADD 'selection' to the state type
  const [currentStep, setCurrentStep] = useState<'entry' | 'name' | 'selection' | 'main'>('entry');
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'profile'>('overview');
  const [isReady, setIsReady] = useState(false);
  const [userName, setUserName] = useState('');
  const isMain = currentStep === 'main';

  const handleTabChange = useCallback((tab: 'overview' | 'analytics' | 'profile') => {
    setActiveTab(prev => (prev === tab ? prev : tab));
  }, []);

  useEffect(() => {
    const initialize = async () => {
      try {
        const savedName = await UserStore.getName();
        const savedLimits = await UserStore.getAllLimits();
        
        if (savedName && savedName !== 'Guest') {
          setUserName(savedName);
          // 3. LOGIC: If name exists but NO apps are picked, go to selection
          if (Object.keys(savedLimits).length > 0) {
            setCurrentStep('main');
          } else {
            setCurrentStep('selection');
          }
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
        {currentStep === 'entry' && <EntryScreen onAnimationComplete={() => setCurrentStep('name')} />}
        
        {currentStep === 'name' && (
          <NameScreen onComplete={async () => {
            const name = await UserStore.getName();
            setUserName(name);
            // 4. MOVE to selection after name is entered
            setCurrentStep('selection');
          }} />
        )}

        {/* 5. RENDER the selection screen */}
        {currentStep === 'selection' && (
          <AppSelectionScreen onComplete={() => setCurrentStep('main')} />
        )}

        {currentStep === 'main' && (
          <View style={styles.main}>
            <View pointerEvents={isMain && activeTab === 'overview' ? 'auto' : 'none'} style={[styles.tabScreen, activeTab === 'overview' ? styles.tabVisible : styles.tabHidden]}>
              <OverviewScreen userName={userName} />
            </View>
            <View pointerEvents={isMain && activeTab === 'analytics' ? 'auto' : 'none'} style={[styles.tabScreen, activeTab === 'analytics' ? styles.tabVisible : styles.tabHidden]}>
              <HomeScreen />
            </View>
            <View pointerEvents={isMain && activeTab === 'profile' ? 'auto' : 'none'} style={[styles.tabScreen, activeTab === 'profile' ? styles.tabVisible : styles.tabHidden]}>
              <ProfileScreen
                userName={userName}
                onOpenLimits={() => setCurrentStep('selection')}
                onLogout={async () => {
                  await UserStore.saveName('Guest');
                  await UserStore.saveAllLimits({});
                  setUserName('');
                  setCurrentStep('entry');
                }}
              />
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
