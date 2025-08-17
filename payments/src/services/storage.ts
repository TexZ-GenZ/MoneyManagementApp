import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../utils/constants';
import { safeJsonParse, safeJsonStringify } from '../utils/helpers';

class StorageService {
  async setItem<T>(key: string, value: T): Promise<void> {
    try {
      const stringValue = safeJsonStringify(value);
      await AsyncStorage.setItem(key, stringValue);
    } catch (error) {
      console.error('Error storing data:', error);
      throw error;
    }
  }

  async getItem<T>(key: string, fallback: T): Promise<T> {
    try {
      const value = await AsyncStorage.getItem(key);
      return safeJsonParse(value, fallback);
    } catch (error) {
      console.error('Error retrieving data:', error);
      return fallback;
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('Error removing data:', error);
      throw error;
    }
  }

  async clear(): Promise<void> {
    try {
      await AsyncStorage.clear();
    } catch (error) {
      console.error('Error clearing storage:', error);
      throw error;
    }
  }

  // Auth specific methods
  async storeAuthToken(token: string): Promise<void> {
    await this.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
  }

  async getAuthToken(): Promise<string | null> {
    return await this.getItem(STORAGE_KEYS.AUTH_TOKEN, null);
  }

  async removeAuthToken(): Promise<void> {
    await this.removeItem(STORAGE_KEYS.AUTH_TOKEN);
  }

  // User data methods
  async storeUserData(userData: any): Promise<void> {
    await this.setItem(STORAGE_KEYS.USER_DATA, userData);
  }

  async getUserData(): Promise<any> {
    return await this.getItem(STORAGE_KEYS.USER_DATA, null);
  }

  async removeUserData(): Promise<void> {
    await this.removeItem(STORAGE_KEYS.USER_DATA);
  }

  // Settings methods
  async storeSettings(settings: any): Promise<void> {
    await this.setItem(STORAGE_KEYS.SETTINGS, settings);
  }

  async getSettings(): Promise<any> {
    return await this.getItem(STORAGE_KEYS.SETTINGS, {});
  }
}

export default new StorageService();
