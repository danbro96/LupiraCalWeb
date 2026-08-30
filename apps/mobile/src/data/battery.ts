import * as Battery from 'expo-battery';

/** Battery level as a whole percent, for stamping onto recorded GPS fixes — the server surfaces it on
 *  `/location/current` so a stale dot can be read as "phone died" rather than "tracking broke".
 *  Never throws: a missing reading must not cost us the fix it was decorating. */
export async function batteryPct(): Promise<number | null> {
  try {
    const level = await Battery.getBatteryLevelAsync();
    // -1 is the documented "unknown" sentinel.
    return level < 0 ? null : Math.round(level * 100);
  } catch {
    return null;
  }
}
