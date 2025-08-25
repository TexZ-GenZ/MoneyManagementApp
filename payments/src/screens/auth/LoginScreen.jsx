import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { loginUser } from '../../store/authSlice';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { COLORS } from '../../utils/constants';
import { getApiUrl } from '../../utils/config';
import { getErrorMessage } from '../../utils/helpers';
import { validateForm, VALIDATION_RULES } from '../../utils/validation';
//import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { StorageService } from '@/src/services/storageService';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Register for push notifications and return the Expo push token (do NOT send to backend here)
export async function registerForPushNotifications() {
  try {
    // Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Permission not granted for push notifications');
      return null;
    }

    // Try to get the Expo push token. For some Android setups (dev clients / standalone builds)
    // Firebase may not be initialized which throws a helpful error. We try with the projectId
    // if available and fall back to a call without it. If it still fails, surface a user-friendly
    // alert linking to Expo's FCM setup guide.
    const projectId = process.env.EXPO_PUBLIC_PROJECT_ID || undefined;

    try {
      const token = projectId
        ? await Notifications.getExpoPushTokenAsync({ projectId })
        : await Notifications.getExpoPushTokenAsync();
      console.log('Expo push token:', token?.data);
      return token?.data ?? null;
    } catch (innerErr) {
      // If Firebase isn't initialized on Android, try again without projectId (some setups work that way)
      const msg = String(innerErr?.message || innerErr);
      console.warn('First attempt to get Expo push token failed:', msg);
      if (projectId) {
        try {
          const token2 = await Notifications.getExpoPushTokenAsync();
          console.log('Expo push token (retry without projectId):', token2?.data);
          return token2?.data ?? null;
        } catch (retryErr) {
          console.error('Retry to get push token failed:', retryErr);
          // Specific guidance for Android/Firebase misconfiguration
          if (msg.includes('Default FirebaseApp is not initialized') || msg.includes('complete the guide')) {
            if (Platform.OS === 'android') {
              Alert.alert(
                'Push Notifications Not Configured',
                'Android push notifications require configuring Firebase/FCM for your app.\n\nPlease follow: https://docs.expo.dev/push-notifications/fcm-credentials/'
              );
            }
          }
          return null;
        }
      }
      // No projectId and already failed
      console.error('Unable to obtain Expo push token:', innerErr);
      return null;
    }
  } catch (error) {
    console.error('Error getting push token:', error);
    return null;
  }
}

// Send push token to backend (using auth token)
async function sendPushTokenToBackend(token) {
  try {
    const { access_token } = await StorageService.getToken();
    console.log("acess", access_token)

    if (!access_token) {
      console.error('No access token available');
      return;
    }

    // Use centralized API URL builder so deployment base URL is respected everywhere
    const response = await fetch(getApiUrl('/auth/push-token'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${access_token}`
      },
      body: JSON.stringify({
        token,
        platform: Platform.OS
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Failed to send push token:', error);
      return;
    }

    const result = await response.json();
    console.log('Push token sent successfully:', result);
  } catch (error) {
    console.error('Error sending push token:', error);
  }
}

const LoginScreen = () => {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { isLoading, error } = useAppSelector((state) => state.auth);

  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [accepted, setAccepted] = useState(true);

  // Animated decorative background circles (gentle float + scale)
  const p1 = useSharedValue(0);
  const p2 = useSharedValue(0);
  const p3 = useSharedValue(0);

  useEffect(() => {
    p1.value = withRepeat(withTiming(1, { duration: 9000, easing: Easing.inOut(Easing.quad) }), -1, true);
    // small start delays for variety
    const t2 = setTimeout(() => {
      p2.value = withRepeat(withTiming(1, { duration: 11000, easing: Easing.inOut(Easing.quad) }), -1, true);
    }, 600);
    const t3 = setTimeout(() => {
      p3.value = withRepeat(withTiming(1, { duration: 10000, easing: Easing.inOut(Easing.quad) }), -1, true);
    }, 1200);
    return () => { clearTimeout(t2); clearTimeout(t3); };
  }, []);

  const animLargeStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(p1.value, [0, 1], [0, -28]) },
      { translateX: interpolate(p1.value, [0, 1], [0, 16]) },
      { scale: interpolate(p1.value, [0, 1], [1, 1.06]) },
    ],
    opacity: interpolate(p1.value, [0, 1], [0.55, 0.48]),
  }));
  const animSmallStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(p2.value, [0, 1], [0, -22]) },
      { translateX: interpolate(p2.value, [0, 1], [0, -14]) },
      { scale: interpolate(p2.value, [0, 1], [1, 1.08]) },
    ],
    opacity: interpolate(p2.value, [0, 1], [0.5, 0.44]),
  }));
  const animMediumStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(p3.value, [0, 1], [0, 26]) },
      { translateX: interpolate(p3.value, [0, 1], [0, 18]) },
      { scale: interpolate(p3.value, [0, 1], [1, 1.05]) },
    ],
    opacity: interpolate(p3.value, [0, 1], [0.45, 0.40]),
  }));

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: [] }));
    }
  };

  const handleLogin = async () => {
    if (!accepted) {
      Alert.alert('Terms Required', 'You must accept the Terms and Privacy Policy.');
      return;
    }

    const validationResults = validateForm(formData, {
      username: VALIDATION_RULES.username,
      password: VALIDATION_RULES.password,
    });

    const formErrors = {};
    Object.entries(validationResults).forEach(([field, result]) => {
      if (!result.isValid) {
        formErrors[field] = result.errors;
      }
    });

    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      return;
    }

    try {
      const result = await dispatch(loginUser({
        username: formData.username,
        password: formData.password,
      }));

      if (loginUser.fulfilled.match(result)) {

        // Now the user is authenticated. Register for push notifications and send token once.
        const expoPushToken = await registerForPushNotifications();
        if (expoPushToken) {
          await sendPushTokenToBackend(expoPushToken);
        }

        router.replace('/(tabs)');

      } else {
        Alert.alert('Login Failed', getErrorMessage(result.payload) || 'Please check your credentials and try again.');
      }
    } catch (error) {
      Alert.alert('Login Failed', getErrorMessage(error) || 'Please check your credentials and try again.');
    }
  };

  if (isLoading) {
    return <LoadingSpinner message="Signing in..." />;
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={-90}
    >
      {/* Simple light blue gradient filling whole screen */}
      <LinearGradient colors={['#ffffff', '#e8f9ff', '#d0f3ff', '#a9e7ff', '#8fdfff']} locations={[0, 0.3, 0.55, 0.8, 1]} style={StyleSheet.absoluteFill} />
      {/* Decorative soft circles */}
      <Animated.View style={[styles.decorCircleLarge, animLargeStyle]} pointerEvents="none" />
      <Animated.View style={[styles.decorCircleSmall, animSmallStyle]} pointerEvents="none" />
      <Animated.View style={[styles.decorCircleMedium, animMediumStyle]} pointerEvents="none" />
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">

        {/* Logo */}
        <View style={styles.topRow}>
          <Image source={require('../../../assets/images/paytm_logo.png')} style={styles.logo} resizeMode="contain" />
        </View>

        {/* Auth Card */}
        <View style={styles.card}>
          {/* Tabs */}
          <View style={styles.tabRow}>
            <View style={styles.tabActiveWrap}>
              <Text style={styles.tabActive}>LOGIN</Text>
              <View style={styles.tabUnderline} />
            </View>
            <View style={styles.tabDivider} />
            <Text style={styles.tabDisabled}>SIGN UP</Text>
          </View>

          {/* Inputs */}
          <View style={styles.form}>
            <Input
              label="Email or Mobile"
              value={formData.username}
              onChangeText={(value) => handleInputChange('username', value)}
              error={errors.username?.[0]}
              placeholder="Enter your email or mobile"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />

            <View style={styles.form}>
              <Input
                label="Password"
                value={formData.password}
                onChangeText={(value) => handleInputChange('password', value)}
                error={errors.password?.[0]}
                placeholder="Enter your password"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                <Ionicons name={showPassword ? "eye-outline" : "eye-off-outline"} size={22} color="#999" />
              </TouchableOpacity>
            </View>

            {/* Terms (kept for compliance) */}
            <View style={styles.checkboxRow}>
              <TouchableOpacity onPress={() => setAccepted(!accepted)} style={styles.checkbox}>
                {accepted && <Ionicons name="checkmark" size={16} color="#00BFFF" />}
              </TouchableOpacity>
              <Text style={styles.termsText}>
                I accept the <Text style={styles.link}>Terms & Conditions</Text> and <Text style={styles.link}>Privacy Policy</Text>
              </Text>
            </View>

            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Button title="Login" onPress={handleLogin} loading={isLoading} style={styles.loginButton} />
          </View>{/* end form */}
        </View>{/* end card */}

        {/* Footer */}
      </ScrollView>
      <View style={styles.footerFixed}>
        <Text style={styles.footerText}>Build v1.0-2.0.2102</Text>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  // Single container definition (previous duplicate overwrote the first) with fallback blue
  container: { flex: 1, backgroundColor: '#8fdfff' },
  scrollContainer: { flexGrow: 1, padding: 24, paddingBottom: 120, justifyContent: 'center' },
  topRow: { alignItems: 'center', justifyContent: 'center', marginBottom: 28, paddingTop: 24 },
  logo: { width: 160, height: 70 },
  glow: { display: 'none' },
  card: { backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 26, padding: 26, borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)', marginBottom: 32 },
  decorCircleLarge: { position: 'absolute', top: -80, left: -70, width: 300, height: 300, borderRadius: 150, backgroundColor: '#d9f6ff', opacity: 0.55 },
  decorCircleSmall: { position: 'absolute', top: 120, right: -60, width: 180, height: 180, borderRadius: 90, backgroundColor: '#b3ecff', opacity: 0.50 },
  decorCircleMedium: { position: 'absolute', bottom: 140, left: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: '#c2f1ff', opacity: 0.45 },
  tabRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 28 },
  tabActiveWrap: { alignItems: 'center' },
  tabActive: { fontSize: 16, fontWeight: '700', color: '#0099cc', letterSpacing: 0.5 },
  tabUnderline: { height: 3, backgroundColor: '#0099cc', alignSelf: 'stretch', width: 68, marginTop: 6, borderRadius: 2 },
  tabDivider: { width: 1, backgroundColor: 'rgba(0,0,0,0.3)', height: 24, marginHorizontal: 24 },
  tabDisabled: { fontSize: 16, fontWeight: '600', color: '#999', letterSpacing: 0.5 },
  form: { marginTop: 12 },
  passwordContainer: { position: 'relative', justifyContent: 'center' },
  eyeIcon: { position: 'absolute', right: 12, bottom: 25 },
  forgotLink: { alignSelf: 'flex-end', marginTop: 8 },
  forgotText: { color: '#00BFFF', fontSize: 14 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
  checkbox: {
    width: 20, height: 20, borderRadius: 4,
    borderWidth: 1, borderColor: '#00BFFF',
    justifyContent: 'center', alignItems: 'center',
    marginRight: 8
  },
  termsText: { fontSize: 13, color: '#444', flex: 1, flexWrap: 'wrap' },
  link: { color: '#00BFFF' },
  loginButton: { marginTop: 20 },
  signupRow: { display: 'none' },
  signupText: { display: 'none' },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#f44336',
  },
  errorText: { color: '#f44336', fontSize: 14, textAlign: 'center' },
  footerFixed: { position: 'absolute', bottom: 32, left: 0, right: 0, alignItems: 'center', zIndex: 20 },
  footerText: { fontSize: 12, color: '#fff', fontWeight: '600', letterSpacing: 0.7, opacity: 0.95 },
  bottomAccent: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 260, backgroundColor: '#00aee6', borderTopLeftRadius: 140, borderTopRightRadius: 0, transform: [{ skewY: '-2deg' }], },
});

export default LoginScreen;
