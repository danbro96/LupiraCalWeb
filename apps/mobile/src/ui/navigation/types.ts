export type RootStackParamList = {
  Login: undefined;
  Tabs: undefined;
  /// Reachable from Login too — switching to the LAN preset must not require signing in first.
  BackendSettings: undefined;
  SyncIssues: undefined;
  DebugLog: undefined;
  ItemDetail: { itemId: string };
  /// No itemId = create; `day` pre-fills the start date from the grid selection.
  ItemEdit: { itemId?: string; day?: string } | undefined;
  ContactDetail: { contactId: string };
  ContactEdit: { contactId?: string } | undefined;
  /// M6 spike surface — removed when the real bridges land (M7).
  BridgeSpike: undefined;
};

export type TabParamList = {
  Calendar: undefined;
  Contacts: undefined;
  Settings: undefined;
};
