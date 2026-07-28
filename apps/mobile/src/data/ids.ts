import * as ExpoCrypto from 'expo-crypto';
import { guidFromMd5Hex } from '../domain/ids';

/// MD5 comes from the platform: expo-crypto on the device, node:crypto in the vitest harness (injected).
let md5Hex: (value: string) => Promise<string> = async (value) =>
  ExpoCrypto.digestStringAsync(ExpoCrypto.CryptoDigestAlgorithm.MD5, value, {
    encoding: ExpoCrypto.CryptoEncoding.HEX,
  });

export function setMd5Provider(fn: (value: string) => Promise<string>): void {
  md5Hex = fn;
}

/// The id the server will assign for this sourceKey (DeterministicGuid.From) — computable offline, so the
/// mirror row and follow-up ops reference the aggregate before the create is acked.
export async function deterministicIdFor(sourceKey: string): Promise<string> {
  return guidFromMd5Hex(await md5Hex(sourceKey));
}
