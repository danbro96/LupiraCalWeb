import * as SecureStore from 'expo-secure-store';
import { API_URL_STORAGE_KEY, DEFAULT_API_URL } from '../../config';

/**
 * The BFF origin, read straight from the persisted setting rather than through the AuthPort. The
 * location uploader runs headless, where only the crypto polyfill, the transport and the recorder
 * are imported — the auth store never loads, so `authPort()` would throw and drop the batch.
 */
export async function resolveApiUrl(): Promise<string> {
  try {
    return (await SecureStore.getItemAsync(API_URL_STORAGE_KEY)) || DEFAULT_API_URL;
  } catch {
    return DEFAULT_API_URL;
  }
}
