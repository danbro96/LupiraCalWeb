import type { LinkingOptions } from '@react-navigation/native';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { useAuth } from './src/state/auth-store';
import { ConfirmDialogHost } from './src/ui/components/ConfirmDialog';
import { navDark, navLight, paperDark, paperLight } from './src/ui/theme/paperTheme';
import { useBridge } from './src/state/bridge-store';
import { usePhotoBackup } from './src/state/photo-backup-store';
import { usePrefs } from './src/state/prefs-store';
import { registerBackgroundSync } from './src/sync/backgroundTask';
import { queryClient } from './src/sync/reactivity';
import { startSync } from './src/sync/sync';
import { RootNav } from './src/ui/navigation/RootNav';
import type { RootStackParamList } from './src/ui/navigation/types';

export default function App() {
  const scheme = useColorScheme();
  const loaded = useAuth((s) => s.loaded);
  const authed = useAuth((s) => s.authMode === 'none' || s.token !== null);

  useEffect(() => {
    void useAuth.getState().load();
  }, []);

  useEffect(() => {
    if (!loaded || !authed) return;
    void registerBackgroundSync();
    void useBridge.getState().init();   // hydrate the integration flag + self-repair account/permissions
    void usePrefs.getState().init();
    void usePhotoBackup.getState().init();
    return startSync();
  }, [loaded, authed]);

  if (!loaded) return null;   // hydration gate — avoids a login flash over a persisted session
  return (
    <QueryClientProvider client={queryClient}>
      <PaperProvider theme={scheme === 'dark' ? paperDark : paperLight}>
        <ConfirmDialogHost>
          <NavigationContainer linking={linking} theme={scheme === 'dark' ? navDark : navLight}>
            <StatusBar style="auto" />
            <RootNav />
          </NavigationContainer>
        </ConfirmDialogHost>
      </PaperProvider>
    </QueryClientProvider>
  );
}

/// Deep links from the OS bridges ("Open in Lupira" contact rows, later calendar rows). The OIDC
/// redirect (lupiracalendar://oauthredirect) matches nothing here and is ignored by navigation.
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['lupiracalendar://'],
  config: {
    screens: {
      ContactDetail: 'contact/:contactId',
      ItemDetail: 'item/:itemId',
    },
  },
};
