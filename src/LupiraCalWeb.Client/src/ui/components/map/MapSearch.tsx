import { useEffect, useState } from 'react';
import { useForwardGeocode, useSuggestPlaces } from '../../../data/api-geo/lupiraGeoApi';
import { SuggestionType } from '../../../data/api-geo/models';

export interface SearchTarget {
  lat: number;
  lon: number;
  /** Set only for gazetteer places — opens the detail panel too. */
  placeId?: string;
}

/** Gazetteer typeahead (places + localities) with a nominatim forward-geocode fallback. */
export function MapSearch({ onPick }: { onPick: (target: SearchTarget) => void }) {
  const [q, setQ] = useState('');
  const [geocodeQ, setGeocodeQ] = useState<string>();

  const suggestQ = useSuggestPlaces({ q }, { query: { enabled: q.trim().length >= 2 } });
  const suggestions = q.trim().length >= 2 ? (suggestQ.data ?? []) : [];

  const geocode = useForwardGeocode(
    { q: geocodeQ ?? '', limit: 1 },
    { query: { enabled: !!geocodeQ, staleTime: Infinity } },
  );
  const geocodeData = geocodeQ ? geocode.data : undefined;
  useEffect(() => {
    if (geocodeData === undefined) return;
    setGeocodeQ(undefined);
    const hit = geocodeData[0];
    if (hit?.latitude != null && hit.longitude != null) {
      setQ('');
      onPick({ lat: hit.latitude, lon: hit.longitude });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires once per geocode result
  }, [geocodeData]);

  const pick = (id: string, type: SuggestionType, lat?: number | null, lon?: number | null) => {
    setQ('');
    if (lat == null || lon == null) return;
    onPick({ lat, lon, placeId: type === SuggestionType.Place ? id : undefined });
  };

  return (
    <div className="map-search">
      <input
        className="text-input"
        placeholder="Search places…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && suggestions.length === 0 && q.trim().length >= 2) setGeocodeQ(q.trim());
          if (e.key === 'Escape') setQ('');
        }}
      />
      {(suggestions.length > 0 || (q.trim().length >= 2 && !suggestQ.isLoading)) && (
        <div className="place-suggestions map-search-results">
          {suggestions.map((s) => (
            <button key={`${s.type}:${s.id}`} className="place-suggestion" onClick={() => pick(s.id, s.type, s.latitude, s.longitude)}>
              <span className="location-name">{s.name}</span>
              {s.context && <span className="meta"> {s.context}</span>}
              <span className="badge">{s.type === SuggestionType.Place ? s.category ?? 'Place' : 'Area'}</span>
            </button>
          ))}
          {suggestions.length === 0 && (
            <button className="place-suggestion" onClick={() => setGeocodeQ(q.trim())} disabled={geocode.isLoading}>
              {geocode.isLoading ? 'Searching…' : `Search address "${q.trim()}"`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
