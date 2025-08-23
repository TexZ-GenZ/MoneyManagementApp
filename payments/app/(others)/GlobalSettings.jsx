import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, TextInput, Alert } from 'react-native';
import Screen from '../../src/ui/components/Screen';
import Card from '../../src/ui/components/Card';
import { tokens } from '../../src/ui/tokens';
import { StorageService } from '../../src/services/storageService';

export default function GlobalSettings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [creditExt, setCreditExt] = useState('');
  const [notifEvery, setNotifEvery] = useState('');
  const [dailyHour, setDailyHour] = useState('');
  const [saving, setSaving] = useState(false);

  const baseUrl = process.env.APP_URI || process.env.EXPO_PUBLIC_APP_URI;

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const token = await StorageService.getToken();
      const resp = await fetch(`${baseUrl}/settings`, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token?.access_token}` } });
      const js = await resp.json();
      if (!resp.ok) throw new Error(js?.detail || 'Failed');
      setSettings(js);
      setCreditExt(String(js.credit_extension_days));
      setNotifEvery(String(js.notif_every_hours));
      setDailyHour(String(js.payment_notif_daily_hour));
    } catch (e) {
      setError(e?.message || 'Failed');
    } finally { setLoading(false); }
  }, [baseUrl]);

  useEffect(() => { load(); }, [load]);

  const dirty = () => settings && (
    creditExt !== String(settings.credit_extension_days) ||
    notifEvery !== String(settings.notif_every_hours) ||
    dailyHour !== String(settings.payment_notif_daily_hour)
  );

  const save = async () => {
    if (!settings || !dirty()) { setEditing(false); return; }
    setSaving(true);
    try {
      const body = {};
      if (creditExt !== String(settings.credit_extension_days)) body.credit_extension_days = Number(creditExt) || 0;
      if (notifEvery !== String(settings.notif_every_hours)) body.notif_every_hours = Number(notifEvery) || 1;
      if (dailyHour !== String(settings.payment_notif_daily_hour)) body.payment_notif_daily_hour = Number(dailyHour) || 0;
      const token = await StorageService.getToken();
      const resp = await fetch(`${baseUrl}/settings`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token?.access_token}` }, body: JSON.stringify(body) });
      const js = await resp.json();
      if (!resp.ok) throw new Error(js?.detail || 'Save failed');
      setSettings(js);
      setEditing(false);
    } catch (e) {
      Alert.alert('Save Failed', e?.message || 'Unable to save');
    } finally { setSaving(false); }
  };

  return (
    <Screen title="Global Settings" subtitle="System-wide configuration" scroll>
      {loading && (
        <Card><View style={styles.center}><ActivityIndicator color={tokens.colors.accent} /><Text style={styles.muted}>Loading...</Text></View></Card>
      )}
      {!loading && error && (
        <Card><Text style={styles.error}>{error}</Text><TouchableOpacity style={[styles.actionBtn, { backgroundColor: tokens.colors.accent, marginTop: 14 }]} onPress={load}><Text style={styles.actionBtnText}>Retry</Text></TouchableOpacity></Card>
      )}
      {!loading && !error && settings && (
        <Card>
          {!editing && (
            <View>
              <SettingRow label="Credit Extension (days)" value={settings.credit_extension_days} />
              <SettingRow label="Notif Every (hours)" value={settings.notif_every_hours} />
              <SettingRow label="Daily Notif Hour" value={settings.payment_notif_daily_hour} last />
              <View style={styles.buttonsRow}>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: tokens.colors.accent }]} onPress={() => setEditing(true)}>
                  <Text style={styles.actionBtnText}>Edit</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          {editing && (
            <View>
              <EditRow label="Credit Extension (days)"><Field value={creditExt} onChangeText={setCreditExt} placeholder="0" /></EditRow>
              <EditRow label="Notif Every (hours)"><Field value={notifEvery} onChangeText={setNotifEvery} placeholder="1" /></EditRow>
              <EditRow label="Daily Notif Hour"><Field value={dailyHour} onChangeText={setDailyHour} placeholder="0-23" /></EditRow>
              <View style={styles.editBtnRow}>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: tokens.colors.danger, flex: 1 }]} disabled={saving} onPress={() => { setEditing(false); setCreditExt(String(settings.credit_extension_days)); setNotifEvery(String(settings.notif_every_hours)); setDailyHour(String(settings.payment_notif_daily_hour)); }}>
                  <Text style={styles.actionBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: tokens.colors.success, flex: 1 }]} disabled={saving || !dirty()} onPress={save}>
                  <Text style={styles.actionBtnText}>{saving ? 'Saving...' : 'Save'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </Card>
      )}
    </Screen>
  );
}

function SettingRow({ label, value, last }) {
  return (
    <View style={[styles.settingRow, !last && styles.settingRowBorder]}>
      <Text style={styles.settingLabel}>{label}</Text>
      <Text style={styles.settingValue}>{value}</Text>
    </View>
  );
}

function EditRow({ label, children }) {
  return (
    <View style={[styles.settingRow, styles.settingRowBorder]}>
      <Text style={styles.settingLabel}>{label}</Text>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>{children}</View>
    </View>
  );
}

function Field(props) {
  return <TextInput {...props} keyboardType="numeric" placeholderTextColor={tokens.colors.textSubtle} style={styles.field} />;
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', paddingVertical: 20 },
  muted: { color: tokens.colors.textDim, fontSize: 13, marginTop: 8 },
  error: { color: tokens.colors.danger, fontSize: 14 },
  actionBtn: { paddingVertical: 14, borderRadius: 14, alignItems: 'center', paddingHorizontal: 22 },
  actionBtnText: { color: '#000', fontWeight: '700', fontSize: 14 },
  buttonsRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 },
  editBtnRow: { flexDirection: 'row', gap: 14, marginTop: 18 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12 },
  settingRowBorder: { borderBottomWidth: 1, borderBottomColor: tokens.colors.border },
  settingLabel: { color: tokens.colors.textDim, fontSize: 12, paddingRight: 10, flex: 1 },
  settingValue: { color: tokens.colors.text, fontWeight: '600', fontSize: 13 },
  field: { backgroundColor: tokens.colors.cardAlt, borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: tokens.colors.text, fontSize: 14, minWidth: 120, textAlign: 'right' },
});
