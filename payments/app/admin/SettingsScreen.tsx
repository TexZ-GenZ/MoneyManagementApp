import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import ClockHourPicker from '@/src/ui/components/ClockHourPicker';
import Screen from '@/src/ui/components/Screen';
import Card from '@/src/ui/components/Card';
import { tokens } from '@/src/ui/tokens';
import { formatDate } from '@/src/ui/format';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { fetchSettings, updateCreditExtensionDays, updateSettings } from '@/src/store/settingsSlice';

const OPTIONS = [15, 30, 45, 60, 90];

export default function SettingsScreen() {
  const dispatch = useAppDispatch();
  const { creditExtensionDays, notifEveryHours, execWindowStartHour, execWindowEndHour, isLoading, error } = useAppSelector(s => s.settings);
  const userRole = useAppSelector(s => s.auth.user?.role);
  const [selected, setSelected] = useState<number | 'custom' | null>(null);
  const [custom, setCustom] = useState('');
  const [savingCredit, setSavingCredit] = useState(false);
  const [savingNotif, setSavingNotif] = useState(false);
  // Notification settings local state
  const [notifEvery, setNotifEvery] = useState('');
  const [notifEveryMode, setNotifEveryMode] = useState<number | 'custom' | null>(null);
  const [notifEveryCustom, setNotifEveryCustom] = useState('');
  // Daily digest hour removed – using only start/end window.
  // Store IST hours (0-23) to align with backend (which stores IST). Convert only for the dial component (which expects UTC).
  const [startHourIst, setStartHourIst] = useState('');
  const [endHourIst, setEndHourIst] = useState('');
  const [activeTab, setActiveTab] = useState<'start' | 'end'>('start');

  // Initialize notification state when fetched
  const FREQ_OPTS = [1, 2, 3, 4, 6, 8, 12, 24];
  useEffect(() => {
    if (notifEveryHours != null && notifEvery === '') {
      if (FREQ_OPTS.includes(notifEveryHours)) { setNotifEveryMode(notifEveryHours); }
      else { setNotifEveryMode('custom'); setNotifEveryCustom(String(notifEveryHours)); }
      setNotifEvery(String(notifEveryHours));
    }
    if (startHourIst === '') {
      if (execWindowStartHour != null) { setStartHourIst(String(execWindowStartHour)); } else { setStartHourIst('6'); }
    }
    if (endHourIst === '') {
      if (execWindowEndHour != null) { setEndHourIst(String(execWindowEndHour)); } else { setEndHourIst('22'); }
    }
  }, [notifEveryHours, execWindowStartHour, execWindowEndHour]);

  useEffect(() => { dispatch(fetchSettings()); }, [dispatch]);
  useEffect(() => {
    if (creditExtensionDays != null && !selected) {
      if (OPTIONS.includes(creditExtensionDays)) setSelected(creditExtensionDays);
      else { setSelected('custom'); setCustom(String(creditExtensionDays)); }
    }
  }, [creditExtensionDays]);

  const selectedValue: number | null = useMemo(() => {
    if (selected === 'custom') {
      const n = parseInt(custom, 10); return isNaN(n) ? null : n;
    }
    if (typeof selected === 'number') return selected;
    return null;
  }, [selected, custom]);

  const notifEveryNum = (() => {
    if (notifEveryMode === 'custom') {
      const n = parseInt(notifEveryCustom, 10); return isNaN(n) ? null : n;
    }
    if (typeof notifEveryMode === 'number') return notifEveryMode;
    return notifEvery === '' ? null : Number(notifEvery);
  })();

  // Conversion helpers (IST<->UTC) for 5.5h offset
  const istToUtc = (hIst: number): number => {
    const utcFloat = (hIst - 5.5 + 24) % 24; // may be .5
    return Math.floor(utcFloat); // bias earlier
  };
  const utcToIst = (hUtc: number): number => {
    const local = (hUtc + 5.5) % 24; // may be .5
    return Math.round(local) % 24; // bias .5 up
  };

  const handleWindowHourChange = (utcHour: number) => {
    const istHour = utcToIst(utcHour);
    if (activeTab === 'start') setStartHourIst(String(istHour)); else setEndHourIst(String(istHour));
  };

  const computeIstDisplay = (istHourStr: string) => {
    const h = parseInt(istHourStr, 10); if (isNaN(h)) return '--:--';
    return `${String(h).padStart(2, '0')}:00`;
  };

  const dirtyCredit = (selectedValue != null && selectedValue !== creditExtensionDays);
  const dirtyNotif = (
    (notifEveryNum != null && notifEveryNum !== notifEveryHours) ||
    (startHourIst !== '' && Number(startHourIst) !== execWindowStartHour) ||
    (endHourIst !== '' && Number(endHourIst) !== execWindowEndHour)
  );

  const invalidWindow = startHourIst !== '' && endHourIst !== '' && Number(startHourIst) === Number(endHourIst);

  const previewPromiseDate = useMemo(() => {
    if (selectedValue == null) return '—';
    const today = new Date();
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + selectedValue);
  return formatDate(d);
  }, [selectedValue]);

  const applyCredit = async () => {
    if (userRole !== 'admin') { Alert.alert('Forbidden', 'Only admin can change settings'); return; }
    const value = selectedValue;
    if (value == null) { Alert.alert('Select', 'Pick or enter a credit extension value'); return; }
    if (value < 0 || value > 365) { Alert.alert('Invalid', 'Credit extension must be 0-365'); return; }
    try {
      setSavingCredit(true);
      await dispatch(updateCreditExtensionDays(value)).unwrap();
      Alert.alert('Updated', 'Credit extension saved.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed');
    } finally { setSavingCredit(false); }
  };

  const applyNotif = async () => {
    if (userRole !== 'admin') { Alert.alert('Forbidden', 'Only admin can change settings'); return; }
    if (notifEveryNum == null || isNaN(notifEveryNum) || notifEveryNum <= 0 || notifEveryNum > 168) { Alert.alert('Invalid', 'Notification frequency (hours) must be between 1 and 168'); return; }
    if (invalidWindow) { Alert.alert('Invalid', 'Start and End cannot match'); return; }
    try {
      setSavingNotif(true);
      await dispatch(updateSettings({
        notif_every_hours: notifEveryNum,
        exec_window_start_hour: startHourIst === '' ? undefined : Number(startHourIst),
        exec_window_end_hour: endHourIst === '' ? undefined : Number(endHourIst),
      })).unwrap();
      Alert.alert('Updated', 'Notification settings saved.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed');
    } finally { setSavingNotif(false); }
  };

  return (
    <Screen title="Global Settings" subtitle="Promise Date & Notifications" scroll contentStyle={undefined}>
      <View style={styles.spacing} />
      <Card style={styles.heroCard}>
        <Text style={styles.heroLabel}>Current Credit Extension</Text>
        <Text style={styles.heroValue}>{creditExtensionDays ?? '—'}<Text style={styles.heroValueUnit}> days</Text></Text>
        <Text style={styles.heroHint}>Promise Date = Bill Date + Credit Extension Days</Text>
      </Card>
      <View style={styles.sectionGap} />
      <Card style={styles.selectorCard}>
        <Text style={styles.sectionTitle}>Select New Value</Text>
        <View style={styles.optionsRow}>
          {OPTIONS.map(o => (
            <TouchableOpacity key={o} style={[styles.opt, selected === o && styles.optActive]} onPress={() => setSelected(o)} activeOpacity={0.75}>
              <Text style={[styles.optText, selected === o && styles.optTextActive]}>{o}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[styles.opt, selected === 'custom' && styles.optActive]} onPress={() => setSelected('custom')} activeOpacity={0.75}>
            <Text style={[styles.optText, selected === 'custom' && styles.optTextActive]}>Custom</Text>
          </TouchableOpacity>
        </View>
        {selected === 'custom' && (
          <View style={styles.customRow}>
            <TextInput
              style={styles.input}
              value={custom}
              onChangeText={setCustom}
              keyboardType="number-pad"
              placeholder="Days"
              placeholderTextColor={tokens.colors.textFaint}
              maxLength={3}
            />
            <View style={styles.customPreviewBox}>
              <Text style={styles.previewSmall}>Preview Promise for Today</Text>
              <Text style={styles.previewDate}>{previewPromiseDate}</Text>
            </View>
          </View>
        )}
        {selected !== 'custom' && selectedValue != null && (
          <View style={styles.previewInline}>
            <Text style={styles.previewInlineText}>Sample Promise Date (bill today): <Text style={styles.previewInlineValue}>{previewPromiseDate}</Text></Text>
          </View>
        )}
        {error && <Text style={styles.error}>{error}</Text>}
        <TouchableOpacity
          style={[styles.saveBtn, (!dirtyCredit || savingCredit || isLoading) && styles.saveBtnDisabled]}
          onPress={applyCredit}
          disabled={!dirtyCredit || savingCredit || isLoading}
          activeOpacity={0.8}
        >
          {savingCredit || isLoading ? <ActivityIndicator color="#000" /> : <Text style={styles.saveText}>{dirtyCredit ? 'Apply Change' : 'No Changes'}</Text>}
        </TouchableOpacity>
        <Text style={styles.note}>Changing this updates Promise Date calculations for future displays.</Text>
      </Card>
      <View style={styles.sectionGap} />
      <Card style={styles.selectorCard}>
        <Text style={styles.sectionTitle}>Notification Window & Frequency</Text>
        <Text style={styles.smallLabel}>Reminder Frequency (hours)</Text>
        <View style={styles.optionsRow}>
          {FREQ_OPTS.map(h => (
            <TouchableOpacity key={h} style={[styles.opt, notifEveryMode === h && styles.optActive]} onPress={() => { setNotifEveryMode(h); }}>
              <Text style={[styles.optText, notifEveryMode === h && styles.optTextActive]}>{h}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[styles.opt, notifEveryMode === 'custom' && styles.optActive]} onPress={() => { setNotifEveryMode('custom'); }}>
            <Text style={[styles.optText, notifEveryMode === 'custom' && styles.optTextActive]}>Custom</Text>
          </TouchableOpacity>
        </View>
        {notifEveryMode === 'custom' && (
          <TextInput
            style={styles.input}
            value={notifEveryCustom}
            onChangeText={setNotifEveryCustom}
            keyboardType="number-pad"
            placeholder="Hours"
            placeholderTextColor={tokens.colors.textFaint}
            maxLength={3}
          />
        )}
        <View style={{ height: 20 }} />
        <View style={styles.tabRow}>
          <TouchableOpacity style={[styles.tabBtn, activeTab === 'start' && styles.tabBtnActive]} onPress={() => setActiveTab('start')}>
            <Text style={[styles.tabBtnText, activeTab === 'start' && styles.tabBtnTextActive]}>Start</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabBtn, activeTab === 'end' && styles.tabBtnActive]} onPress={() => setActiveTab('end')}>
            <Text style={[styles.tabBtnText, activeTab === 'end' && styles.tabBtnTextActive]}>End</Text>
          </TouchableOpacity>
        </View>
        <ClockHourPicker value={activeTab === 'start' ? (startHourIst === '' ? null : istToUtc(Number(startHourIst))) : (endHourIst === '' ? null : istToUtc(Number(endHourIst)))} onChange={handleWindowHourChange} />
        <View style={{ height: 12 }} />
        <Text style={styles.clockMeta}>Window (IST): {computeIstDisplay(startHourIst || '--')} – {computeIstDisplay(endHourIst || '--')}</Text>
        {invalidWindow && <Text style={styles.error}>Start and End cannot be the same hour.</Text>}
        <TouchableOpacity style={styles.resetBtn} onPress={() => {
          setStartHourIst('6'); setEndHourIst('22');
        }}>
          <Text style={styles.resetBtnText}>Reset Window (06–22 IST)</Text>
        </TouchableOpacity>
        <Text style={styles.note}>Executives (plus admin/accountant) receive repeating pending bills / approvals notifications every chosen frequency only inside this window.</Text>
        <TouchableOpacity
          style={[styles.saveBtn, (!dirtyNotif || savingNotif || isLoading || invalidWindow) && styles.saveBtnDisabled]}
          onPress={applyNotif}
          disabled={!dirtyNotif || savingNotif || isLoading || invalidWindow}
          activeOpacity={0.8}
        >
          {savingNotif || isLoading ? <ActivityIndicator color="#000" /> : <Text style={styles.saveText}>{invalidWindow ? 'Invalid Window' : (dirtyNotif ? 'Apply Change' : 'No Changes')}</Text>}
        </TouchableOpacity>
        <Text style={styles.note}>Apply to persist notification frequency and window.</Text>
      </Card>
      <View style={styles.sectionGap} />
      <Card style={styles.selectorCard}>
        <Text style={styles.sectionTitle}>What These Settings Do</Text>
        <Text style={styles.explainTitle}>Credit Extension (Days)</Text>
        <Text style={styles.explainText}>Adds to each bill's original date to compute the dynamic Promise Date. Changing it retroactively shifts all displayed promise dates.</Text>
        <Text style={styles.explainTitle}>Reminder Frequency</Text>
        <Text style={styles.explainText}>Interval (in hours) that the system re-scans & re-sends pending promise / payment review notifications if they remain unresolved.</Text>
        <Text style={styles.explainTitle}>Exec Notification Window</Text>
        <Text style={styles.explainText}>Start and End (IST) define when the periodic scan will send pending bills & promise/approval reminders. Outside this window, no pushes are sent.</Text>
      </Card>
      <View style={{ height: 60 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  spacing: { height: 4 },
  heroCard: { padding: 20, alignItems: 'center' },
  heroLabel: { fontSize: 13, fontWeight: '600', color: tokens.colors.textDim, letterSpacing: 0.5, marginBottom: 8 },
  heroValue: { fontSize: 48, fontWeight: '800', color: tokens.colors.accent, lineHeight: 56 },
  heroValueUnit: { fontSize: 16, fontWeight: '700', color: tokens.colors.textDim, marginLeft: 4 },
  heroHint: { fontSize: 12, fontWeight: '500', color: tokens.colors.textSubtle, marginTop: 10, textAlign: 'center' },
  sectionGap: { height: 18 },
  selectorCard: { padding: 18 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: tokens.colors.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 },
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  opt: { backgroundColor: 'rgba(255,255,255,0.08)', paddingVertical: 12, paddingHorizontal: 18, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  optActive: { backgroundColor: tokens.colors.accent, borderColor: tokens.colors.accent },
  optText: { color: tokens.colors.textDim, fontSize: 14, fontWeight: '600' },
  optTextActive: { color: '#000' },
  customRow: { flexDirection: 'row', gap: 14, alignItems: 'stretch', marginBottom: 10 },
  input: { flex: 0.55, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, fontSize: 16, color: tokens.colors.text, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  customPreviewBox: { flex: 1, backgroundColor: tokens.colors.cardAlt, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: tokens.colors.border, justifyContent: 'center' },
  previewSmall: { fontSize: 11, color: tokens.colors.textSubtle, fontWeight: '600', marginBottom: 6, letterSpacing: 0.4 },
  previewDate: { fontSize: 18, fontWeight: '700', color: tokens.colors.accent },
  previewInline: { backgroundColor: tokens.colors.cardAlt, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: tokens.colors.border, marginBottom: 10 },
  previewInlineText: { fontSize: 12, color: tokens.colors.textSubtle, fontWeight: '500' },
  previewInlineValue: { color: tokens.colors.accent, fontWeight: '700' },
  saveBtn: { backgroundColor: tokens.colors.accent, paddingVertical: 16, borderRadius: 18, alignItems: 'center', marginTop: 10 },
  saveBtnDisabled: { opacity: 0.5 },
  saveText: { color: '#000', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  error: { color: tokens.colors.danger, fontSize: 12, marginTop: 4 },
  note: { marginTop: 14, fontSize: 11, color: tokens.colors.textFaint, lineHeight: 16 },
  smallLabel: { fontSize: 12, fontWeight: '600', color: tokens.colors.textSubtle, marginBottom: 6, letterSpacing: 0.4 },
  hourGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  hourCell: { width: 46, paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', marginBottom: 6 },
  hourCellActive: { backgroundColor: tokens.colors.accent, borderColor: tokens.colors.accent },
  hourCellText: { color: tokens.colors.textDim, fontSize: 12, fontWeight: '600' },
  hourCellTextActive: { color: '#000' },
  clockModeRow: { flexDirection: 'row', gap: 12, marginTop: 8, marginBottom: 14 },
  // modeToggle styles no longer used after simplifying to 24h clock
  // Replaced button clock with dial component
  // am/pm styles removed
  clockMeta: { fontSize: 11, color: tokens.colors.textSubtle, marginBottom: 4 },
  explainTitle: { marginTop: 12, fontSize: 12, fontWeight: '700', color: tokens.colors.textDim, letterSpacing: 0.5 },
  explainText: { fontSize: 12, color: tokens.colors.textSubtle, lineHeight: 17, marginTop: 4 },
  tabRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.08)', padding: 6, borderRadius: 20, marginBottom: 14, gap: 6 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 14, alignItems: 'center' },
  tabBtnActive: { backgroundColor: tokens.colors.accent },
  tabBtnText: { color: tokens.colors.textSubtle, fontSize: 13, fontWeight: '600' },
  tabBtnTextActive: { color: '#000' },
  resetBtn: { marginTop: 10, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.10)', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  resetBtnText: { color: tokens.colors.textSubtle, fontSize: 12, fontWeight: '600' },
});
