import { NavigationContainer } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useAuth } from './src/state/auth-store';
import { registerBackgroundSync } from './src/sync/backgroundTask';
import { queryClient } from './src/sync/reactivity';
import { startSync } from './src/sync/sync';
import { RootNav } from './src/ui/navigation/RootNav';

export default function App() {
  const loaded = useAuth((s) => s.loaded);
  const authed = useAuth((s) => s.authMode === 'none' || s.token !== null);

  useEffect(() => {
    void useAuth.getState().load();
  }, []);

  useEffect(() => {
    if (!loaded || !authed) return;
    void registerBackgroundSync();
    return startSync();
  }, [loaded, authed]);

  if (!loaded) return null;   // hydration gate — avoids a login flash over a persisted session
  return (
    <QueryClientProvider client={queryClient}>
      <NavigationContainer>
        <StatusBar style="auto" />
        <RootNav />
      </NavigationContainer>
    </QueryClientProvider>
  );
}
