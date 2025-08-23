import React, { useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { loginUser } from '../../store/authSlice';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { COLORS } from '../../utils/constants';
import { validateForm, VALIDATION_RULES } from '../../utils/validation';

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
        router.replace('/(tabs)');
      } else {
        Alert.alert('Login Failed', result.payload || 'Please check your credentials and try again.');
      }
    } catch (error) {
      Alert.alert('Login Failed', error.message || 'Please check your credentials and try again.');
    }
  };

  if (isLoading) {
    return <LoadingSpinner message="Signing in..." />;
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">

        {/* Top logo row */}
        <View style={styles.topRow}>
          <Image source={require('../../../assets/images/paytm_logo.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.brandText}>Money</Text>
        </View>
        <View style={styles.divider} />

        {/* Page title */}
        <View style={styles.pageTitleRow}>
          <Text style={styles.pageTitle}>Login</Text>
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


          {/* Terms Checkbox */}
          <View style={styles.checkboxRow}>
            <TouchableOpacity onPress={() => setAccepted(!accepted)} style={styles.checkbox}>
              {accepted && <Ionicons name="checkmark" size={16} color="#00BFFF" />}
            </TouchableOpacity>
            <Text style={styles.termsText}>
              I accept the <Text style={styles.link}>Terms and Conditions</Text> and <Text style={styles.link}>Privacy Policy</Text>
            </Text>
          </View>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Sign In */}
          <Button title="SIGN IN" onPress={handleLogin} loading={isLoading} style={styles.loginButton} />

          {/* Sign Up */}
          <View style={styles.signupRow}>
            <Text style={styles.signupText}>Don’t have account? </Text>
            <TouchableOpacity>
              <Text style={styles.link}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Build v1.0-2.0.2102</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', marginTop:8 },
  scrollContainer: { flexGrow: 1, justifyContent: 'flex-start', padding: 20,
    
   },
  topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, justifyContent:"flex-start", paddingTop:10 },
  logo: { width: 120, height: 40, marginRight: -30 },
  brandText: { fontSize: 18, fontWeight: '700', color: '#333' },
  divider: { height: 1, backgroundColor: 'rgba(0,0,0,0.08)', marginTop: 1, marginBottom:18 },
  pageTitleRow: { alignItems: 'flex-start', marginBottom: 45 },
  pageTitle: { fontSize: 20, fontWeight: '700', color: '#333' },
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
  signupRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 16 },
  signupText: { fontSize: 14, color: '#666' },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#f44336',
  },
  errorText: { color: '#f44336', fontSize: 14, textAlign: 'center' },
  footer: { alignItems: 'center', marginTop: 32 },
  footerText: { fontSize: 12, color: '#999' },
});

export default LoginScreen;
