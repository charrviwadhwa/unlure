import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Image, Platform, Vibration, useColorScheme } from 'react-native';
import { Picker } from 'react-native-wheel-pick';

interface TimeLimitModalProps {
  visible: boolean;
  appName: string;
  iconBase64?: string;
  initialMinutes?: number;
  onConfirm: (totalMinutes: number) => void;
  onCancel: () => void;
}

const hourData = Array.from({ length: 13 }, (_, i) => String(i));
const minuteData = Array.from({ length: 60 }, (_, i) => String(i));
const FONT_SANS = Platform.select({ ios: 'Geist-Regular', android: 'Geist-Regular', default: 'System' });
const FONT_SANS_SEMIBOLD = Platform.select({ ios: 'Geist-SemiBold', android: 'Geist-SemiBold', default: 'System' });

export const TimeLimitModal = ({ visible, appName, iconBase64, initialMinutes = 30, onConfirm, onCancel }: TimeLimitModalProps) => {
  const isDark = useColorScheme() === 'dark';
  const theme = {
    surface: isDark ? '#171C24' : '#FFFFFF',
    panel: isDark ? 'rgba(255,255,255,0.045)' : '#FFFFFF',
    text: isDark ? '#F3F4F6' : '#111111',
    textSecondary: isDark ? '#A5ACB8' : '#6F737C',
    border: isDark ? 'transparent' : '#ECECF2',
    pickerText: isDark ? '#8E96A6' : '#6F737C'
  };
  const [hours, setHours] = useState('0');
  const [minutes, setMinutes] = useState('30');

  useEffect(() => {
    if (!visible) return;
    const safeInitialMinutes = Math.max(0, Math.floor(initialMinutes || 0));
    setHours(String(Math.floor(safeInitialMinutes / 60)));
    setMinutes(String(safeInitialMinutes % 60));
  }, [initialMinutes, visible]);

  const tick = useCallback(() => {
    if (Platform.OS === 'android') Vibration.vibrate(8);
  }, []);
  const settle = useCallback(() => {
    if (Platform.OS === 'android') Vibration.vibrate(16);
  }, []);

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent navigationBarTranslucent>
      <View style={styles.overlay}>
        <View style={[styles.content, { backgroundColor: theme.surface }]}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Set Limit</Text>
          <View style={styles.appHeader}>
            {iconBase64 ? (
              <Image source={{ uri: `data:image/png;base64,${iconBase64}` }} style={styles.appIcon} resizeMode="cover" />
            ) : (
              <View style={[styles.appIconFallback, { backgroundColor: theme.panel }]}>
                <Text style={styles.appIconFallbackText}>{appName.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <Text style={[styles.appName, { color: theme.text }]} numberOfLines={1}>{appName}</Text>
          </View>

          <View style={[styles.pickerContainer, { backgroundColor: theme.panel, borderColor: theme.border, borderWidth: isDark ? 0 : 1 }]}>
            {/* Hours Infinite Roller */}
            <View style={styles.column}>
              <Text style={styles.columnLabel}>hrs</Text>
             <Picker
                style={styles.picker}
                selectedValue={hours}
                pickerData={hourData}
                onValueChange={(value: string) => {
                  tick();
                  setHours(value);
                }}
                isCyclic={true}
                selectTextColor={theme.text}
                textColor={theme.pickerText}
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
                onValueChange={(value: string) => {
                  tick();
                  setMinutes(value);
                }}
                isCyclic={true}
                selectTextColor={theme.text}
                textColor={theme.pickerText}
                textSize={22}
              />
            </View>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                settle();
                onCancel();
              }}
            >
              <Text style={[styles.cancelText, { color: theme.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.confirmButton, isDark && { backgroundColor: '#FFFFFF' }]} 
              onPress={() => {
                settle();
                const totalMinutes = (parseInt(hours, 10) * 60) + parseInt(minutes, 10);
                onConfirm(totalMinutes);
                }}
            >
              <Text style={[styles.confirmText, isDark && { color: '#101319' }]}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  content: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 35,
    borderTopRightRadius: 35,
    padding: 30,
    paddingBottom: Platform.OS === 'android' ? 58 : 40
  },
  label: { fontSize: 12, color: '#666', fontFamily: FONT_SANS_SEMIBOLD, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0 },
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
  appIconFallbackText: { color: '#6E6E73', fontSize: 15, fontFamily: FONT_SANS_SEMIBOLD, fontWeight: '600' },
  appName: { flex: 1, fontSize: 26, fontFamily: FONT_SANS_SEMIBOLD, fontWeight: '600', color: '#111111' },
  pickerContainer: { 
    flexDirection: 'row', 
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#ECECF2',
    overflow: 'hidden',
    paddingVertical: 10,
    position: 'relative'
  },
  column: { flex: 1, alignItems: 'center' },
  columnLabel: { fontSize: 13, color: '#777', fontFamily: FONT_SANS_SEMIBOLD, fontWeight: '600', marginTop: 10, marginBottom: -10 },
  picker: { width: '100%', height: 200, backgroundColor: 'transparent' },
  buttonRow: { flexDirection: 'row', alignItems: 'center', marginTop: 35, gap: 14 },
  cancelButton: {
    flex: 1,
    minHeight: 54,
    justifyContent: 'center',
    alignItems: 'flex-start'
  },
  cancelText: { color: '#666', fontSize: 16, fontFamily: FONT_SANS, fontWeight: '500' },
  confirmButton: {
    flex: 1,
    minHeight: 54,
    backgroundColor: '#1C1C1E',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    elevation: 3
  },
  confirmText: { color: '#FFF', fontFamily: FONT_SANS_SEMIBOLD, fontWeight: '600', fontSize: 16 }
});
