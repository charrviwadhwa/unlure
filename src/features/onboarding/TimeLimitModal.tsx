import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Image } from 'react-native';
import { Picker } from 'react-native-wheel-pick';

interface TimeLimitModalProps {
  visible: boolean;
  appName: string;
  iconBase64?: string;
  onConfirm: (totalMinutes: number) => void;
  onCancel: () => void;
}

const hourData = Array.from({ length: 13 }, (_, i) => String(i));
const minuteData = Array.from({ length: 60 }, (_, i) => String(i));

export const TimeLimitModal = ({ visible, appName, iconBase64, onConfirm, onCancel }: TimeLimitModalProps) => {
  const [hours, setHours] = useState('0');
  const [minutes, setMinutes] = useState('30');

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.content}>
          <Text style={styles.label}>Set Limit</Text>
          <View style={styles.appHeader}>
            {iconBase64 ? (
              <Image source={{ uri: `data:image/png;base64,${iconBase64}` }} style={styles.appIcon} resizeMode="cover" />
            ) : (
              <View style={styles.appIconFallback}>
                <Text style={styles.appIconFallbackText}>{appName.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <Text style={styles.appName} numberOfLines={1}>{appName}</Text>
          </View>

          <View style={styles.pickerContainer}>
            {/* Hours Infinite Roller */}
            <View style={styles.column}>
              <Text style={styles.columnLabel}>hrs</Text>
             <Picker
                style={styles.picker}
                selectedValue={hours}
                pickerData={hourData}
                // Change (value) to (value: string)
                onValueChange={(value: string) => setHours(value)}
                isCyclic={true}
                selectTextColor="#111111"
                textSize={22}
                />
            </View>

            {/* Minutes Infinite Roller */}
            <View style={styles.column}>
              <Text style={styles.columnLabel}>mins</Text>
              <Picker
                style={styles.picker}
                selectedValue={minutes}
                pickerData={minuteData}
                onValueChange={(value: string) => setMinutes(value)}
                isCyclic={true} // Infinite scrolling
                selectTextColor="#111111"
                textSize={22}
              />
            </View>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity onPress={onCancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.confirmButton} 
              onPress={() => {
                // Convert strings to numbers before math
                const totalMinutes = (parseInt(hours, 10) * 60) + parseInt(minutes, 10);
                onConfirm(totalMinutes);
                }}
            >
              <Text style={styles.confirmText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  content: { backgroundColor: '#FFF', borderTopLeftRadius: 35, borderTopRightRadius: 35, padding: 30, paddingBottom: 40 },
  label: { fontSize: 12, color: '#666', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1.5 },
  appHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 8, marginBottom: 25 },
  appIcon: { width: 38, height: 38, borderRadius: 10, marginRight: 12 },
  appIconFallback: {
    width: 38,
    height: 38,
    borderRadius: 10,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F2F7'
  },
  appIconFallbackText: { color: '#6E6E73', fontSize: 15, fontWeight: '800' },
  appName: { flex: 1, fontSize: 26, fontWeight: '800', color: '#111111' },
  pickerContainer: { 
    flexDirection: 'row', 
    backgroundColor: '#F2F2F2',
    borderRadius: 25, 
    overflow: 'hidden',
    paddingVertical: 10
  },
  column: { flex: 1, alignItems: 'center' },
  columnLabel: { fontSize: 13, color: '#777', fontWeight: 'bold', marginTop: 10, marginBottom: -10 },
  picker: { width: '100%', height: 200, backgroundColor: 'transparent' },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 35 },
  cancelText: { color: '#666', fontSize: 16, fontWeight: '600' },
  confirmButton: { backgroundColor: '#1C1C1E', paddingHorizontal: 50, paddingVertical: 18, borderRadius: 18, elevation: 3 },
  confirmText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 }
});
