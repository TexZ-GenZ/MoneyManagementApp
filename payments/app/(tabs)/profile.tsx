import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import GridBackground from '../(others)/GridBGComponent';
import { StorageService } from '@/src/services/storageService';
import { useRouter } from 'expo-router';

type MeResponse = {
  id: string | number;
  username: string;
  role: string;
  area?: string;
  mobile?: string;
};

let mock : MeResponse={
  id:1,
  username:"emma",
  role:"Admin",
  area:"",
  mobile:"9876543210"
}

export default function ProfileScreen() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter()

  useEffect(() => {
    (async () => {
      try {
        // const token = await StorageService.getToken();
        // const BASE = process.env.APP_URI || process.env.EXPO_PUBLIC_APP_URI;
        // const res = await fetch(`${BASE}/auth/me`, {
        //   method: 'GET',
        //   headers: {
        //     'Content-Type': 'application/json',
        //     'Authorization': `Bearer ${token?.access_token}`,
        //   },
        // });
        // const data = await res.json();
        // if (!res.ok) throw new Error(data?.message || 'Failed to fetch profile');
        // setMe(data as MeResponse);

        setMe(mock)
      } catch (e: any) {
        setError(e?.message || 'Something went wrong');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

    const handleLogout = async () => {
    await StorageService.deleteToken();
    router.replace('/'); // redirect to login/root
  };

  return (
    <LinearGradient colors={['#000', '#000']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ flex: 1 }}>
      <GridBackground />
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>My Profile</Text>

        {loading && (
          <View style={styles.center}>
            <ActivityIndicator />
            <Text style={styles.muted}>Loading...</Text>
          </View>
        )}

        {error && (
          <View style={styles.center}>
            <Text style={styles.error}>{error}</Text>
          </View>
        )}

        {me && (
          <View style={styles.card}>
            <Row label="ID" value={String(me.id)} />
            <Row label="Username" value={me.username} />
            <Row label="Role" value={me.role} />
            <Row label="Area" value={me.area || '-'} />
            <Row label="Mobile" value={me.mobile || '-'} last />
          </View>
        )}

        
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </LinearGradient>
  );
}

function Row({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 30,
    marginTop:30
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f9f9f9',
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#0a0a0a',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(200, 241, 76, 0.3)',
  },
  row: {
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.2)',
  },
  label: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
  },
  value: {
    color: '#c8f14c', // neon accent
    fontSize: 14,
    fontWeight: '600',
  },
  center: {
    marginTop: 20,
    alignItems: 'center',
  },
  muted: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.6)',
  },
  error: {
    color: '#ff6b6b',
  },
  logoutBtn: {
    marginTop: 24,
    backgroundColor: '#ff3b3b',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#ff3b3b',
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 6,
  },
  logoutText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
