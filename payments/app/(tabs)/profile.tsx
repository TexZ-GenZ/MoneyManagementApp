import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, ScrollView } from 'react-native';
import { StorageService } from '@/src/services/storageService';
import { useAppDispatch } from '@/src/store/hooks';
import { logoutUser } from '@/src/store/authSlice';
import { useRouter } from 'expo-router';
import Screen from '@/src/ui/components/Screen';
import Card from '@/src/ui/components/Card';
import Button from '@/src/components/common/Button';
import { formatDateTime } from '@/src/ui/format';
import { tokens } from '@/src/ui/tokens';
import Constants from 'expo-constants';
import { API_BASE_URL } from '@/src/utils/constants';
import { Ionicons } from '@expo/vector-icons';

// Avoid double-applying IST on this screen: formatDateTime already adds +05:30.
const IST_OFFSET_MS = 330 * 60 * 1000;

type MeResponse = {
  id: string | number;
  username: string;
  role: string; // Admin | Accountant | Executive ...
  area?: string;
  mobile?: string;
};

type DecodedToken = { exp?: number; iat?: number;[k: string]: any };

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

  const baseUrl = API_BASE_URL || '-';
  const appVersion = Constants.expoConfig?.version || '1.0.0';
  const canEditCompanyPromise = (me?.role || '').toLowerCase() === 'executive'
    || (me?.role || '').toLowerCase() === 'accountant';

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

  // No refresh button; session does not renew here.

  const now = Date.now();
  const expMs = decoded?.exp ? decoded.exp * 1000 : undefined;
  const expiresInMin = expMs ? Math.max(0, Math.round((expMs - now) / 60000)) : undefined;
  // formatDateTime already converts to IST. Our exp appears already IST-relative here,
  // so adjust to UTC before formatting to avoid double addition on this screen only.
  const displayExpMs = expMs ? expMs - IST_OFFSET_MS : undefined;

  const initials = (name?: string) => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  const maskMobile = (m?: string) => {
    if (!m) return '-';
    const digits = m.replace(/\D/g, '');
    if (digits.length < 5) return '••••';
    return `••••••${digits.slice(-4)}`;
  };


  return (
    <Screen title="My Profile" subtitle="" contentStyle={undefined} hideBackButton>
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
        <ScrollView contentContainerStyle={{ paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
          <Card style={styles.cardSection}>
            <View style={styles.headerRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials(me.username)}</Text>
              </View>
              <View style={{ flex: 1, paddingLeft: 12 }}>
                <Text style={styles.name}>{me.username}</Text>
                <View style={styles.tagRow}>
                  <RoleBadge role={me.role} />
                </View>
              </View>
            </View>
          </Card>
          <Card style={styles.cardSection}>
            <SectionTitle text="Account" />
            <IconRow icon="id-card-outline" label="Role" value={me.role} />
            <IconRow icon="call-outline" label="Mobile" value={maskMobile(me.mobile)} last />
          </Card>
          <Card style={styles.cardSection}>
            <SectionTitle text="Session" />
            <IconRow icon="timer-outline" label="Expires In" value={expiresInMin !== undefined ? `${expiresInMin} min` : '-'} />
            <IconRow icon="calendar-outline" label="Expires At" value={displayExpMs ? formatDateTime(displayExpMs) : '-'} last />
          </Card>
          {canEditCompanyPromise && (
            <Card style={styles.cardSection}>
              <SectionTitle text="Company" />
              <Text style={styles.helperText}>
                Update a company-level promise date for pending or partial bills.
              </Text>
              <Button
                title="Change Company Promise Date"
                onPress={() => router.push('/company-promise')}
                variant="outline"
              />
            </Card>
          )}
          {/* Removed session, app version, and advanced details for a cleaner view */}
          <View style={{ marginTop: 16 }}>
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.logoutText}>Logout</Text>
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

function IconRow({ icon, label, value, last = false }: { icon: any; label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <View style={styles.rowLeft}>
        <Ionicons name={icon} size={16} color={tokens.colors.textSubtle} style={{ marginRight: 8 }} />
        <Text style={styles.rowLabel} allowFontScaling={false}>{label}</Text>
      </View>
      <Text style={styles.rowValue} numberOfLines={1} ellipsizeMode="tail">{value}</Text>
    </View>
  );
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
  name: { fontSize: 20, fontWeight: '800', color: tokens.colors.text, flex: 1, paddingRight: 10 },
  subMeta: { marginTop: 6, fontSize: 12, color: tokens.colors.textDim },
  avatar: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: tokens.colors.cardAlt,
    borderWidth: 1, borderColor: tokens.colors.border,
    alignItems: 'center', justifyContent: 'center'
  },
  avatarText: { color: tokens.colors.text, fontWeight: '800', fontSize: 20 },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: tokens.colors.textSubtle, marginBottom: 4, letterSpacing: 0.5 },
  row: { paddingVertical: 12, flexDirection: 'row', alignItems: 'center' },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: tokens.colors.divider },
  rowLeft: { flexDirection: 'row', alignItems: 'center', width: 100 },
  rowLabel: { color: tokens.colors.textDim, fontSize: 13, flex: 1 },
  rowValue: { color: tokens.colors.text, fontSize: 14, fontWeight: '700', flex: 1, textAlign: 'right', paddingLeft: 16 },
  roleBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, alignSelf: 'flex-start' },
  roleBadgeText: { color: '#000', fontWeight: '700', fontSize: 12 },
  helperText: { color: tokens.colors.textDim, fontSize: 12, marginBottom: 12 },
  actionBtn: { paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  actionBtnText: { color: '#000', fontWeight: '700', fontSize: 14 },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.danger,
    paddingVertical: 14,
    borderRadius: 14,
  },
  logoutText: { color: '#fff', fontWeight: '800', fontSize: 15 },

});
