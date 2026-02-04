import React, { useState, useEffect } from 'react';
import { StatusBar, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import EntryScreen from './src/features/onboarding/EntryScreen';
// import HomeScreen from './src/features/detox/HomeScreen';
// import { UserStore } from './src/services/storage';

const App = () => {
  const [isReady, setIsReady] = useState(false);
  const [showEntry, setShowEntry] = useState(true);

  // useEffect(() => {
  //   // Initializing app-level data from MMKV
  //   const setup = async () => {
  //     const name = UserStore.getName();
  //     // If no name exists, you might want to redirect to Onboarding later
  //     console.log('App Initialized for:', name);
  //     setIsReady(true);
  //   };

  //   setup();
  // }, []);

  // Handle the transition from Entry (Affirmation) to Home
  const handleEntryComplete = () => {
    setShowEntry(false);
  };

  if (!isReady) return null; // Or a simple loader while MMKV boots

  return (
    <GestureHandlerRootView style={styles.container}>
      {/* Light-content status bar for the dark "Unlure" theme */}
      <StatusBar barStyle="light-content" backgroundColor="#1A1A1A" />
      
     
    <EntryScreen onAnimationComplete={handleEntryComplete} />
     
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A1A', // Matches the "Unlure" sanctuary vibe
  },
});

export default App;