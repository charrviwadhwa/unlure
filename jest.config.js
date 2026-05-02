module.exports = {
  preset: 'react-native',
  setupFiles: ['react-native-gesture-handler/jestSetup', './jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native|react-native-linear-gradient|react-native-svg|react-native-wheel-pick|@react-native-async-storage)/)',
  ],
};
