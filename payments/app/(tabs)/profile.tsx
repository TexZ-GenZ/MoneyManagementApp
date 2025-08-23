import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, ScrollView } from 'react-native';
import { StorageService } from '@/src/services/storageService';
import { useAppDispatch } from '@/src/store/hooks';
import { logoutUser } from '@/src/store/authSlice';
import { useRouter } from 'expo-router';
import Screen from '@/src/ui/components/Screen';
import Card from '@/src/ui/components/Card';
import { tokens } from '@/src/ui/tokens';
import Constants from 'expo-constants';

type MeResponse = {
  id: string | number;
  username: string;
  role: string; // Admin | Accountant | Executive ...
  area?: string;
  mobile?: string;
};

type DecodedToken = { exp?: number; iat?: number; [k: string]: any };


function decodeJwt(token?: string): DecodedToken | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    // RN may not have atob; attempt Buffer if available
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    let jsonStr = '';
    if (typeof atob === 'function') {
      jsonStr = atob(b64);
    } else if (typeof Buffer !== 'undefined') {
      jsonStr = Buffer.from(b64, 'base64').toString('utf8');
    } else {
      return null;
    }
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

export default function ProfileScreen() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [decoded, setDecoded] = useState<DecodedToken | null>(null);

  const router = useRouter();
  const dispatch = useAppDispatch();

  const baseUrl = process.env.APP_URI || process.env.EXPO_PUBLIC_APP_URI || '-';
  const appVersion = Constants.expoConfig?.version || '1.0.0';

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const token = await StorageService.getToken();
      if (token?.access_token) setDecoded(decodeJwt(token.access_token));
      const res = await fetch(`${baseUrl}/auth/me`, {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token?.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Failed to fetch profile');
      setMe(data as MeResponse);
    } catch (e: any) {
      setError(e?.message || 'Unable to load profile');
    } finally {
      setLoading(false);
    }
  }, [baseUrl]);

  useEffect(() => { load(); }, [load]);

  const handleLogout = () => {
    dispatch(logoutUser());
    router.replace('/login');
  };

  const now = Date.now();
  const expMs = decoded?.exp ? decoded.exp * 1000 : undefined;
  const expiresInMin = expMs ? Math.max(0, Math.round((expMs - now) / 60000)) : undefined;


  return (
  <Screen title="My Profile" subtitle="" contentStyle={undefined}>
      {loading && (
        <View style={styles.center}> 
          <ActivityIndicator color={tokens.colors.accent} />
          <Text style={styles.muted}>Loading profile...</Text>
        </View>
      )}
      {!loading && error && (
        <Card style={{ marginTop: 12 }}>
          <Text style={styles.error}>{error}</Text>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: tokens.colors.accent, marginTop: 14 }]} onPress={load}>
            <Text style={styles.actionBtnText}>Retry</Text>
          </TouchableOpacity>
        </Card>
      )}
      {!loading && me && (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <Card style={styles.cardSection}>
            <View style={styles.headerRow}>
              <Text style={styles.name}>{me.username}</Text>
              <RoleBadge role={me.role} />
            </View>
            <Text style={styles.subMeta}>User ID: {me.id}</Text>
          </Card>
          <Card style={styles.cardSection}>
            <SectionTitle text="Account" />
            <Row label="Role" value={me.role} />
            <Row label="Area" value={me.area || '-'} />
            <Row label="Mobile" value={me.mobile || '-'} last />
          </Card>
          <Card style={styles.cardSection}>
            <SectionTitle text="Session" />
            <Row label="Expires In" value={expiresInMin !== undefined ? `${expiresInMin} min` : '-'} />
            <Row label="Expires At" value={expMs ? new Date(expMs).toLocaleString() : '-'} />
            <Row label="Issued At" value={decoded?.iat ? new Date(decoded.iat * 1000).toLocaleString() : '-'} last />
          </Card>
          <Card style={styles.cardSection}>
            <SectionTitle text="App" />
            <Row label="Version" value={appVersion} last />
          </Card>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: tokens.colors.accent, flex: 1 }]} onPress={load}>
              <Text style={styles.actionBtnText}>Refresh</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: tokens.colors.danger, flex: 1 }]} onPress={handleLogout}>
              <Text style={styles.actionBtnText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}

function Row({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function SectionTitle({ text }: { text: string }) {
  return <Text style={styles.sectionTitle}>{text}</Text>;
}

function RoleBadge({ role }: { role: string }) {
  const colorMap: Record<string, string> = {
    Admin: tokens.colors.accent,
    Accountant: tokens.colors.info,
    Executive: tokens.colors.success,
  };
  const bg = colorMap[role] || tokens.colors.accentAlt;
  return (
    <View style={[styles.roleBadge, { backgroundColor: bg }]}> 
      <Text style={styles.roleBadgeText}>{role}</Text>
    </View>
  );
}

// Helpers for settings editing

const styles = StyleSheet.create({
  center: { marginTop: 30, alignItems: 'center' },
  muted: { marginTop: 10, color: tokens.colors.textDim, fontSize: 13 },
  error: { color: tokens.colors.danger, fontSize: 14 },
  cardSection: { marginTop: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { fontSize: 20, fontWeight: '700', color: tokens.colors.text, flex: 1, paddingRight: 10 },
  subMeta: { marginTop: 6, fontSize: 12, color: tokens.colors.textDim },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: tokens.colors.textSubtle, marginBottom: 4, letterSpacing: 0.5 },
  row: { paddingVertical: 10, flexDirection: 'row', alignItems: 'flex-start' },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: tokens.colors.divider },
  rowLabel: { width: 110, color: tokens.colors.textDim, fontSize: 13, paddingRight: 8 },
  rowValue: { flex: 1, color: tokens.colors.text, fontSize: 14, fontWeight: '600', textAlign: 'right', flexWrap: 'wrap' },
  roleBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, alignSelf: 'flex-start' },
  roleBadgeText: { color: '#000', fontWeight: '700', fontSize: 12 },
  actionBtn: { paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  actionBtnText: { color: '#000', fontWeight: '700', fontSize: 14 },
});
