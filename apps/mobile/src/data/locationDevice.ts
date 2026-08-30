import * as SecureStore from 'expo-secure-store';
import { registerDevice, retireDevice } from './api/generated/location/devices/devices';

/** This phone's identity to LupiraLocationApi. The ingest key is a bearer-equivalent secret shown
 *  exactly once at registration, so it lives in SecureStore — never in SQLite, never in mirror_meta. */

const KEYS = {
  deviceId: 'lupira.calendar.location.deviceId',
  apiKey: 'lupira.calendar.location.apiKey',
} as const;

export type LocationDevice = { deviceId: string; apiKey: string };

export async function loadDevice(): Promise<LocationDevice | null> {
  const [deviceId, apiKey] = await Promise.all([
    SecureStore.getItemAsync(KEYS.deviceId),
    SecureStore.getItemAsync(KEYS.apiKey),
  ]);
  return deviceId && apiKey ? { deviceId, apiKey } : null;
}

/** Idempotent: an already-registered phone keeps its credentials. Re-registering would mint a second
 *  device and orphan the first — there is no key-rotation endpoint, so the stored key is the identity. */
export async function ensureDevice(label: string): Promise<LocationDevice> {
  const existing = await loadDevice();
  if (existing) return existing;

  const response = await registerDevice({ kind: 'Phone', label });
  if (response.status !== 200) throw new Error(`device registration failed (${response.status})`);

  const device: LocationDevice = { deviceId: response.data.device.id, apiKey: response.data.apiKey };
  await Promise.all([
    SecureStore.setItemAsync(KEYS.deviceId, device.deviceId),
    SecureStore.setItemAsync(KEYS.apiKey, device.apiKey),
  ]);
  return device;
}

/** Retires the device server-side (revoking its keys) and forgets it locally. One-way: re-enabling
 *  tracking afterwards registers a NEW device id. */
export async function forgetDevice(): Promise<void> {
  const existing = await loadDevice();
  if (existing) await retireDevice(existing.deviceId).catch(() => undefined);
  await Promise.all([
    SecureStore.deleteItemAsync(KEYS.deviceId),
    SecureStore.deleteItemAsync(KEYS.apiKey),
  ]);
}

/** Drops only the local copy — used when the server says the device is gone (401 on ingest), where
 *  calling retire again would just 404. */
export async function clearDeviceCredentials(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(KEYS.deviceId),
    SecureStore.deleteItemAsync(KEYS.apiKey),
  ]);
}
