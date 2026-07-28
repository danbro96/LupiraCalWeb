export type RootStackParamList = {
  Login: undefined;
  Tabs: undefined;
  /// Reachable from Login too — switching to the LAN preset must not require signing in first.
  BackendSettings: undefined;
  SyncIssues: undefined;
  DebugLog: undefined;
};

export type TabParamList = {
  Calendar: undefined;
  Contacts: undefined;
  Settings: undefined;
};
