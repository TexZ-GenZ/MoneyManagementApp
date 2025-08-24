import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { tokens } from '@/src/ui/tokens';

interface ClockHourPickerProps {
  value: number | null; // stored UTC hour 0-23
  onChange: (utcHour: number) => void;
  size?: number;
  // Fixed IST display (UTC+5:30)
}

// IST-only 24h dial. We store UTC hour but display and edit as IST local hour.
export const ClockHourPicker: React.FC<ClockHourPickerProps> = ({ value, onChange, size = 260 }) => {
  const IST_OFFSET_MINUTES = 330; // +5h30m
  const offsetHoursFloat = IST_OFFSET_MINUTES / 60; // 5.5
  const [displayHour, setDisplayHour] = useState<number>(0); // 0-23 IST displayed
  const lastDisplayRef = useRef<number>(displayHour);

  // Sync incoming UTC value -> display hour
  useEffect(() => {
    const utc = (value ?? 0) % 24;
    const disp = ((utc + offsetHoursFloat) % 24 + 24) % 24; // add 5.5
    // For half-hour offset we bias to conventional local hour (round .5 up)
    const rounded = Math.round(disp) % 24;
    setDisplayHour(rounded);
    lastDisplayRef.current = rounded;
  }, [value]);

  const commitDisplayHour = (hDisp: number) => {
    const d = ((hDisp % 24) + 24) % 24;
    lastDisplayRef.current = d;
    setDisplayHour(d);
    // Convert back to UTC (subtract 5.5 hours)
    let utcFloat = d - offsetHoursFloat; // could be .5 step (x - 5.5)
    // Use floor for .5 to bias earlier so 9:00 IST maps to 3 UTC not 4 (display will still show 9)
    let utc = Math.floor(((utcFloat % 24) + 24) % 24);
    onChange(utc);
  };

  const angle = (displayHour / 24) * 360;

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      {Array.from({ length: 24 }).map((_, i) => {
        const a = (i / 24) * 360;
        const rad = (a - 90) * Math.PI / 180;
        const major = i % 6 === 0;
        const tickSize = major ? 12 : 6;
        const inset = major ? 0 : 6; // major ticks at edge
        const ring = (size / 2) - tickSize - inset;
        const x = (size / 2) + ring * Math.cos(rad);
        const y = (size / 2) + ring * Math.sin(rad);
        return (
          <TouchableOpacity key={i} activeOpacity={0.7} onPress={() => commitDisplayHour(i)} style={[styles.tickTouch, { left: x - 22, top: y - 22 }]}>
            <View style={[styles.tick, {
              width: tickSize,
              height: tickSize,
              borderRadius: tickSize / 2,
              backgroundColor: displayHour === i ? tokens.colors.accent : 'rgba(255,255,255,0.4)',
              opacity: displayHour === i ? 1 : major ? 0.7 : 0.35,
            }]} />
          </TouchableOpacity>
        );
      })}
      <View style={styles.centerDot} />
      <View pointerEvents="none" style={[styles.handPivot, { transform: [{ rotate: `${angle}deg` }], width: size, height: size }]}>
        <View pointerEvents="none" style={[styles.hand, { height: size * 0.42, top: (size / 2) - (size * 0.42), left: (size / 2) - 2 }]} />
      </View>
      <View style={styles.digitalBox} pointerEvents="none">
        <Text style={styles.digitalText}>{String(displayHour).padStart(2, '0')}:00</Text>
        <Text style={styles.digitalHint}>IST (UTC+5:30)</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { borderRadius: 9999, backgroundColor: 'rgba(255,255,255,0.03)', alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  tick: { position: 'absolute', borderRadius: 20 },
  tickTouch: { position: 'absolute', width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 28 },
  centerDot: { position: 'absolute', width: 10, height: 10, borderRadius: 6, backgroundColor: tokens.colors.accent },
  handPivot: { position: 'absolute', left: 0, top: 0 },
  hand: { position: 'absolute', width: 4, backgroundColor: tokens.colors.accent, borderRadius: 2, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 3 },
  digitalBox: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  digitalText: { fontSize: 42, fontWeight: '800', color: tokens.colors.accent },
  digitalHint: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.5)', marginTop: -4, letterSpacing: 1 },
});

export default ClockHourPicker;