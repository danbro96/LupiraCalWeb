import { useNavigation } from '@react-navigation/native';
import { useEffect } from 'react';
import { Alert } from 'react-native';

/// Intercepts every way out of a form — header arrow, hardware/gesture back — while there are unsaved
/// edits. `beforeRemove` is the one hook that covers all of them; saving sets `dirty` false (or the
/// screen navigates programmatically after the guard is disarmed).
export function useUnsavedGuard(dirty: boolean, message = 'Discard your changes?'): void {
  const navigation = useNavigation();

  useEffect(() => {
    if (!dirty) return;
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      e.preventDefault();
      Alert.alert('Unsaved changes', message, [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
      ]);
    });
    return unsubscribe;
  }, [navigation, dirty, message]);
}
