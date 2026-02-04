import AsyncStorage from '@react-native-async-storage/async-storage';

export const UserStore = {
  // MUST be async now
  setName: async (name: string) => {
    try {
      await AsyncStorage.setItem('user_name', name);
    } catch (e) {
      console.error("Error saving name", e);
    }
  },

  // MUST be async now
  getName: async (): Promise<string> => {
    try {
      const name = await AsyncStorage.getItem('user_name');
      return name || 'Guest';
    } catch (e) {
      return 'Guest';
    }
  },

  clearAll: async () => {
    await AsyncStorage.clear();
  }
};