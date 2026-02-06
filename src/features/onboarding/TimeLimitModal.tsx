import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Picker } from 'react-native-wheel-pick';

interface TimeLimitModalProps {
  visible: boolean;
  appName: string;
  onConfirm: (totalMinutes: number) => void;
  onCancel: () => void;
}

const hourData = ['0', '1', '2', '3', '4', '5'];
const minuteData = ['0', '5', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

export const TimeLimitModal = ({ visible, appName, onConfirm, onCancel }: TimeLimitModalProps) => {
  const [hours, setHours] = useState('0');
  const [minutes, setMinutes] = useState('30');

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.content}>
          <Text style={styles.label}>Set Limit</Text>
          <Text style={styles.appName}>{appName}</Text>

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
                selectTextColor="#000"
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
                selectTextColor="#000"
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
                const totalMinutes = (parseInt(hours) * 60) + parseInt(minutes);
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
  label: { fontSize: 12, color: '#999', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1.5 },
  appName: { fontSize: 28, fontWeight: '800', color: '#000', marginBottom: 25 },
  pickerContainer: { 
    flexDirection: 'row', 
    backgroundColor: '#F7F7F7', 
    borderRadius: 25, 
    overflow: 'hidden',
    paddingVertical: 10
  },
  column: { flex: 1, alignItems: 'center' },
  columnLabel: { fontSize: 13, color: '#BBB', fontWeight: 'bold', marginTop: 10, marginBottom: -10 },
  picker: { width: '100%', height: 200, backgroundColor: 'transparent' },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 35 },
  cancelText: { color: '#666', fontSize: 16, fontWeight: '600' },
  confirmButton: { backgroundColor: '#000', paddingHorizontal: 50, paddingVertical: 18, borderRadius: 18, elevation: 6 },
  confirmText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 }
});