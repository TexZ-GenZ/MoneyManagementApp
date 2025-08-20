import * as SecureStore from "expo-secure-store";

const tokenKey = "AUTH_TOKEN";

export interface AuthToken {
  access_token: string;
  token_type: string;
}

export class StorageService {
  // token saver
  static async saveToken(token: AuthToken): Promise<void> {
    await SecureStore.setItemAsync(tokenKey, JSON.stringify(token));
  }

  // token getter
  static async getToken(): Promise<AuthToken | null> {
    const tokenStr = await SecureStore.getItemAsync(tokenKey);
    return tokenStr ? JSON.parse(tokenStr) : null;
  }

  // clear token fn
  static async deleteToken(): Promise<void> {
    await SecureStore.deleteItemAsync(tokenKey);
  }

  // direct abstraction to get the auth header
  static async getAuthHeader(): Promise<{ Authorization: string } | {}> {
    const tok = await this.getToken();
    if (tok) {
      return { Authorization: `${tok.token_type} ${tok.access_token}` };
    }
    return {};
  }
}
