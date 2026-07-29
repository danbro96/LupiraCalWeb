export type RootStackParamList = {
  Login: undefined;
  Tabs: undefined;
  /// Reachable from Login too — switching to the LAN preset must not require signing in first.
  Developer: undefined;
  SyncIssues: undefined;
  DebugLog: undefined;
  ItemDetail: { itemId: string };
  /// No itemId = create; `day`/`time` pre-fill the start from the grid selection (slot taps send both).
  ItemEdit: { itemId?: string; day?: string; time?: string } | undefined;
  ContactDetail: { contactId: string };
  ContactEdit: { contactId?: string } | undefined;
  BridgeDiagnostics: undefined;
};

export type TabParamList = {
  Calendar: undefined;
  Contacts: undefined;
  Settings: undefined;
};
