// Human-readable summary of a payload's PromptFire timing (kind + primitives; domain stays
// independent of the generated API models).

export function describeFire(kind: string, offsetMinutes?: number | string | null, allDayAt?: string | null): string {
  switch (kind) {
    case 'OnStart':
      return 'at start';
    case 'OnEnd':
      return 'at end';
    case 'Offset': {
      const m = offsetMinutes == null ? 0 : Number(offsetMinutes);
      if (m === 0) return 'at start';
      const abs = Math.abs(m);
      const span = abs % 60 === 0 ? `${abs / 60} h` : `${abs} min`;
      return m < 0 ? `${span} before start` : `${span} after start`;
    }
    case 'AllDayAt':
      return allDayAt ? `at ${allDayAt.slice(0, 5)} on the day` : 'on the day';
    default:
      return kind;
  }
}
