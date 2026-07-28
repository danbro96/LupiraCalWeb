import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useAuth } from './src/state/auth-store';
import { RootNav } from './src/ui/navigation/RootNav';

export default function App() {
  const loaded = useAuth((s) => s.loaded);
  useEffect(() => {
    void useAuth.getState().load();
  }, []);
  if (!loaded) return null;   // hydration gate — avoids a login flash over a persisted session
  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <RootNav />
    </NavigationContainer>
  );
}
