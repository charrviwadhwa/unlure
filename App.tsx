import React, { useState, useEffect } from 'react';
import { StyleSheet, View, StatusBar, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import EntryScreen from './src/features/onboarding/EntryScreen';
import NameScreen from './src/features/onboarding/NameScreen';
import { UserStore } from './src/services/storage';

const App = () => {
  const [currentStep, setCurrentStep] = useState<'entry' | 'name' | 'home'>('entry');
  const [isReady, setIsReady] = useState(false);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const initializeApp = async () => {
      // 1. Await the name from Async Storage
      const savedName = await UserStore.getName();
      
      if (savedName && savedName !== 'Guest') {
        setUserName(savedName);
        setCurrentStep('home');
      }
      setIsReady(true);
    };

    initializeApp();
  }, []);

  // Show a blank background with the theme color while loading
  if (!isReady) {
    return <View style={[styles.container, { backgroundColor: '#F5F2ED' }]} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F2ED" />
      
      <View style={styles.container}>
        {currentStep === 'entry' && (
          <EntryScreen onAnimationComplete={() => setCurrentStep('name')} />
        )}

        {currentStep === 'name' && (
          <NameScreen onComplete={async () => {
            // Refresh name state after user enters it
            const name = await UserStore.getName();
            setUserName(name);
            setCurrentStep('home');
          }} />
        )}

        {currentStep === 'home' && (
          <View style={styles.center}>
            <Text style={styles.welcomeText}>Welcome, {userName} ✨</Text>
          </View>
        )}
      </View>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F2ED',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: 24,
    color: '#2D2D2D',
    fontFamily: 'serif',
  },
});

export default App;