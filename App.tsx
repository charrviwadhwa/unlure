import React, { useState, useEffect } from 'react';
import { StyleSheet, View, StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
// Verify these paths match your folders exactly!
import EntryScreen from './src/features/onboarding/EntryScreen';
import NameScreen from './src/features/onboarding/NameScreen';
import HomeScreen from './src/features/detox/HomeScreen';
import StreakScreen from './src/features/journey/StreakScreen';
import { UserStore } from './src/services/storage';

const App = () => {
  const [currentStep, setCurrentStep] = useState<'entry' | 'name' | 'home' | 'journey'>('entry');
  const [isReady, setIsReady] = useState(false);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const initialize = async () => {
      try {
        const savedName = await UserStore.getName();
        if (savedName && savedName !== 'Guest') {
          setUserName(savedName);
          setCurrentStep('home');
        }
      } catch (e) { console.warn("Storage check failed."); }
      finally { setIsReady(true); }
    };
    initialize();
  }, []);

  if (!isReady) return <View style={{ flex: 1, backgroundColor: '#F5F2ED' }} />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F2ED" />
      <View style={styles.container}>
        {currentStep === 'entry' && <EntryScreen onAnimationComplete={() => setCurrentStep('name')} />}
        {currentStep === 'name' && (
          <NameScreen onComplete={async () => {
            const name = await UserStore.getName();
            setUserName(name);
            setCurrentStep('home');
          }} />
        )}
        {currentStep === 'home' && (
          <HomeScreen 
            userName={userName} 
            onPressStreak={() => setCurrentStep('journey')} 
          />
        )}
        {currentStep === 'journey' && (
          <StreakScreen onBack={() => setCurrentStep('home')} />
        )}
      </View>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#F5F2ED' } });

export default App;