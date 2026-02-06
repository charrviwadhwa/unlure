import React, { useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Image, 
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import { UserStore } from '../../services/storage';

const { width, height } = Dimensions.get('window');

interface NameScreenProps {
  onComplete: () => void;
}

const NameScreen: React.FC<NameScreenProps> = ({ onComplete }) => {
  const [name, setName] = useState('');

  const handleContinue = async () => {
    if (name.trim()) {
      // Use await to ensure Async Storage saves before we switch screens
      await UserStore.saveName(name.trim()); 
      onComplete();
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 1. New Illustration Section */}
        <View style={styles.imageSection}>
          <Image 
            source={require('../../assets/login1.png')} 
            style={styles.illustration}
            resizeMode="contain"
          />
        </View>

        {/* 2. Text Content */}
        <View style={styles.formSection}>
          <Text style={styles.title}>What should we call you?</Text>
          
          <View style={styles.inputContainer}>
             <TextInput
              style={styles.input}
              placeholder="Your name"
              value={name}
              onChangeText={setName}
              placeholderTextColor="#A0A0A0"
              autoCorrect={false}
            />
          </View>

          {/* 3. The Olive Button */}
          <TouchableOpacity 
            style={[styles.button, { opacity: name ? 1 : 0.6 }]} 
            onPress={handleContinue}
            disabled={!name}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F2ED', // Consistent Amanda cream theme
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  imageSection: {
    height: height * 0.4,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 40,
  },
  illustration: {
    width: width * 0.8,
    height: '100%',
  },
  formSection: {
    paddingHorizontal: 35,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 25,
    textAlign: 'center',
    fontFamily: 'serif',
  },
  inputContainer: {
    width: '100%',
    marginBottom: 30,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 18,
    fontSize: 18,
    color: '#2D2D2D',
    borderWidth: 1,
    borderColor: '#E6E2D3',
    // Subtle shadow for the "Bear" look
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  button: {
    backgroundColor: '#8E9473', // Exact olive color
    width: '100%',
    paddingVertical: 20,
    borderRadius: 22,
    alignItems: 'center',
    shadowColor: '#8E9473',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});

export default NameScreen;