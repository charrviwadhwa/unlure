import React from 'react';
import { Text, View, StyleSheet } from 'react-native';

type CheckMarkProps = {
  filled: boolean;
  variant?: 'fire';
};

const CheckMark: React.FC<CheckMarkProps> = ({ filled }) => {
  if (!filled) {
    return <View style={styles.emptyCircle} />;
  }

  return (
    <View style={styles.fireCircle}>
      <Text style={styles.fireText}>{'🔥'}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  fireCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFE8C6',
    borderWidth: 1,
    borderColor: '#F7C980'
  },
  fireText: { fontSize: 18 },
  emptyCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#C8CFDA'
  }
});

export default CheckMark;
