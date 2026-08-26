import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import { exchangeAuthCode } from '../../data/auth/oidc';
import { OIDC_CLIENT_ID, OIDC_ISSUER, OIDC_REDIRECT_PATH, OIDC_SCHEME, OIDC_SCOPES } from '../../data/auth/oidcConfig';
import { logDebug } from '../../debug/log';
import { useAuth } from '../../state/auth-store';
import type { RootStackParamList } from '../navigation/types';

WebBrowser.maybeCompleteAuthSession();

const redirectUri = AuthSession.makeRedirectUri({ scheme: OIDC_SCHEME, path: OIDC_REDIRECT_PATH });

export function LoginScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Login'>) {
  const theme = useTheme();
  const discovery = AuthSession.useAutoDiscovery(OIDC_ISSUER);
  const [request, , promptAsync] = AuthSession.useAuthRequest(
    { clientId: OIDC_CLIENT_ID, scopes: OIDC_SCOPES, redirectUri, usePKCE: true },
    discovery,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async () => {
    setBusy(true);
    setError(null);
    try {
      // createTask:false keeps the browser in our Android task — otherwise the redirect lands in a
      // separate task and the prompt resolves 'dismiss' (expo/expo#23781).
      const result = await promptAsync({ createTask: false });
      if (result.type !== 'success') {
        logDebug('auth', `sign-in ${result.type}`);
        if (result.type === 'error') setError(result.error?.message ?? 'Sign-in failed.');
        return;
      }
      const tokens = await exchangeAuthCode(result.params.code, redirectUri, request!.codeVerifier!);
      await useAuth.getState().setSession(tokens);
      logDebug('auth', 'signed in');
    } catch (e) {
      logDebug('auth', `sign-in failed: ${String(e)}`);
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Lupira Calendar</Text>
      {busy || !request ? (
        <ActivityIndicator />
      ) : (
        <Button mode="contained" onPress={() => void signIn()}>
          Sign in with Lupira
        </Button>
      )}
      {error ? <Text style={[styles.error, { color: theme.colors.error }]}>{error}</Text> : null}
      <Pressable onPress={() => navigation.navigate('Developer')}>
        <Text style={[styles.link, { color: theme.colors.primary }]}>Backend settings</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  title: { fontSize: 24, fontWeight: '600' },
  error: { textAlign: 'center' },
  link: { marginTop: 24 },
});
