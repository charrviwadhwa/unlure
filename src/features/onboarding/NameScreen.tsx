import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Dimensions } from 'react-native';
import { UserStore } from '../../services/storage';

const { width } = Dimensions.get('window');

interface NameScreenProps {
  onComplete: () => void;
}

const NameScreen: React.FC<NameScreenProps> = ({ onComplete }) => {
  const [userName, setUserName] = useState('');

  const handleSave = () => {
    if (userName.trim().length > 0) {
      // Saving to MMKV local storage
      UserStore.setName(userName.trim());
      onComplete();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>What's your name?</Text>
        <Text style={styles.subtitle}>Let's make Unlure personal to you.</Text>

        <TextInput
          style={styles.input}
          placeholder="Enter your name"
          placeholderTextColor="#A0A0A0"
          value={userName}
          onChangeText={setUserName}
          autoFocus
        />

        <TouchableOpacity 
          style={[styles.button, { opacity: userName.length > 0 ? 1 : 0.5 }]} 
          onPress={handleSave}
          disabled={userName.length === 0}
        >
          <Text style={styles.buttonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F2ED',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 40,
    padding: 30,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 5,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#2D2D2D',
    marginBottom: 10,
    fontFamily: 'serif',
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E8E',
    marginBottom: 30,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    backgroundColor: '#F9F9F9',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 20,
    fontSize: 18,
    color: '#2D2D2D',
    marginBottom: 25,
    borderWidth: 1,
    borderColor: '#E6E2D3',
  },
  button: {
    backgroundColor: '#8E9473',
    width: '100%',
    paddingVertical: 20,
    borderRadius: 22,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});

export default NameScreen;