/* global jest */

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('react-native-wheel-pick', () => ({
  Picker: 'Picker',
}));

jest.mock('@op-engineering/op-sqlite', () => {
  const rows = {
    _array: [],
    length: 0,
    item: jest.fn(),
    [Symbol.iterator]: function* () {},
  };
  const result = { rows, rowsAffected: 0, insertId: undefined };
  const db = {
    execute: jest.fn(async () => result),
    executeAsync: jest.fn(async () => result),
    executeSync: jest.fn(() => result),
    executeSql: jest.fn((sql, params, success) => {
      if (typeof success === 'function') success(null, result);
      return Promise.resolve(result);
    }),
    transaction: jest.fn((callback) => callback(db)),
    close: jest.fn(),
  };
  return {
    open: jest.fn(() => db),
  };
});
