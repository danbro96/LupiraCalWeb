/// The one place reach kinds are defined: which are channels (API ReachMedium: Email|Phone) vs social
/// profiles (open-string service — Telegram et al. live here by design), plus display icons. Once a row
/// exists its kind is fixed: changing Telegram→Signal in place would silently rewrite what the value means.

export type ReachKind = { key: string; icon: string; channelMedium?: 'Email' | 'Phone' };

export const REACH_KINDS: ReachKind[] = [
  { key: 'Email', icon: '✉️', channelMedium: 'Email' },
  { key: 'Phone', icon: '📞', channelMedium: 'Phone' },
  { key: 'Telegram', icon: '✈️' },
  { key: 'Signal', icon: '🔒' },
  { key: 'WhatsApp', icon: '💬' },
  { key: 'Web', icon: '🌐' },
  { key: 'Other', icon: '🔗' },
];

export function reachIcon(key: string | null | undefined): string {
  if (!key) return '🔗';
  const exact = REACH_KINDS.find((k) => k.key.toLowerCase() === key.toLowerCase());
  return exact?.icon ?? '🔗';
}

/// Deep link for a reach entry, or null when the value isn't actionable.
export function reachLink(kind: string, value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  switch (kind.toLowerCase()) {
    case 'email': return `mailto:${v}`;
    case 'phone': return `tel:${v}`;
    case 'telegram': return `https://t.me/${v.replace(/^@/, '')}`;
    case 'signal': return `https://signal.me/#p/${v}`;
    case 'whatsapp': return `https://wa.me/${v.replace(/[^0-9]/g, '')}`;
    case 'web': return /^https?:\/\//i.test(v) ? v : `https://${v}`;
    default: return /^https?:\/\//i.test(v) ? v : null;
  }
}
