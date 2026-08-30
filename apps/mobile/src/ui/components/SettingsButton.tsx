import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { IconButton } from 'react-native-paper';
import type { RootStackParamList } from '../navigation/types';
import { ICONS } from '../icons';

/** Settings lives off the tab bar. Calendar and Contacts hide the native header for their own
 *  toolbars, so this goes in those toolbars and in the navigator's headerRight for the rest. */
export function SettingsButton() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return <IconButton icon={ICONS.settings} accessibilityLabel="Settings" onPress={() => navigation.navigate('Settings')} />;
}
