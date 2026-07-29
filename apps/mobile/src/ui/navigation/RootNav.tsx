import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';
import { useAuth } from '../../state/auth-store';
import { AvailabilityEditScreen } from '../screens/AvailabilityEditScreen';
import { BridgeDiagnosticsScreen } from '../screens/BridgeDiagnosticsScreen';
import { CalendarScreen } from '../screens/CalendarScreen';
import { ContactDetailScreen } from '../screens/ContactDetailScreen';
import { ContactEditScreen } from '../screens/ContactEditScreen';
import { ContactsScreen } from '../screens/ContactsScreen';
import { DebugLogScreen } from '../screens/DebugLogScreen';
import { DeveloperScreen } from '../screens/DeveloperScreen';
import { ItemDetailScreen } from '../screens/ItemDetailScreen';
import { ItemEditScreen } from '../screens/ItemEditScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { SyncIssuesScreen } from '../screens/SyncIssuesScreen';
import type { RootStackParamList, TabParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const tabIcon = (glyph: string) =>
  function TabIcon({ color }: { color: string }) {
    return <Text style={{ color, fontSize: 18 }}>{glyph}</Text>;
  };

function Tabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: true }}>
      {/* Calendar + Contacts carry their own toolbars — the native header would just double them. */}
      <Tab.Screen name="Calendar" component={CalendarScreen} options={{ tabBarIcon: tabIcon('📅'), headerShown: false }} />
      <Tab.Screen name="Contacts" component={ContactsScreen} options={{ tabBarIcon: tabIcon('👥'), headerShown: false }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarIcon: tabIcon('⚙️') }} />
    </Tab.Navigator>
  );
}

export function RootNav() {
  const authed = useAuth((s) => s.authMode === 'none' || s.token !== null);
  return (
    <Stack.Navigator>
      {authed ? (
        <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      )}
      <Stack.Screen name="SyncIssues" component={SyncIssuesScreen} options={{ title: 'Sync issues' }} />
      <Stack.Screen name="DebugLog" component={DebugLogScreen} options={{ title: 'Debug log' }} />
      <Stack.Screen name="ItemDetail" component={ItemDetailScreen} options={{ title: 'Event' }} />
      <Stack.Screen name="ItemEdit" component={ItemEditScreen} options={{ title: 'Edit event' }} />
      <Stack.Screen name="ContactDetail" component={ContactDetailScreen} options={{ title: 'Contact' }} />
      <Stack.Screen name="ContactEdit" component={ContactEditScreen} options={{ title: 'Edit contact' }} />
      <Stack.Screen name="Developer" component={DeveloperScreen} options={{ title: 'Developer' }} />
      <Stack.Screen name="BridgeDiagnostics" component={BridgeDiagnosticsScreen} options={{ title: 'Bridge diagnostics' }} />
      <Stack.Screen name="AvailabilityEdit" component={AvailabilityEditScreen} options={{ title: 'Set availability' }} />
    </Stack.Navigator>
  );
}
