// Hermes ships no global `crypto`; uuid v7 throws on first mint without getRandomValues. expo-crypto is
// already a native dep, so installing its implementations costs nothing. Defensive per-method fill in case a
// future Hermes provides a partial crypto object.
import * as ExpoCrypto from 'expo-crypto';

type MutableCrypto = { getRandomValues?: unknown; randomUUID?: unknown };

const holder = globalThis as { crypto?: MutableCrypto };
holder.crypto ??= {};
holder.crypto.getRandomValues ??= ExpoCrypto.getRandomValues.bind(ExpoCrypto);
holder.crypto.randomUUID ??= ExpoCrypto.randomUUID.bind(ExpoCrypto);
