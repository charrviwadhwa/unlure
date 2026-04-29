import React from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface EntryScreenProps {
  onAnimationComplete: () => void;
}

const EntryScreen: React.FC<EntryScreenProps> = ({ onAnimationComplete }) => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Welcome to Unlure</Text>
        <Text style={styles.description}>
          Set app time constraints, track your daily usage, and build stronger focus streaks.
        </Text>

        <TouchableOpacity style={styles.button} onPress={onAnimationComplete} activeOpacity={0.85}>
          <Text style={styles.buttonText}>Get Started</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F6FB',
    justifyContent: 'center',
    paddingHorizontal: 20
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E8ECF5'
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#111111',
    marginBottom: 10
  },
  description: {
    fontSize: 16,
    color: '#475467',
    lineHeight: 23,
    marginBottom: 24
  },
  button: {
    backgroundColor: '#111111',
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 14
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700'
  }
});

export default EntryScreen;
