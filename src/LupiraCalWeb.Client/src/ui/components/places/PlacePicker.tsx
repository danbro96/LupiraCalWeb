import { useEffect, useState } from 'react';
import { useResolvePlace, useSuggestPlaces } from '../../../data/api-geo/lupiraGeoApi';
import { SuggestionType } from '../../../data/api-geo/models';
import { errText } from '../errText';
import { PlaceLabel } from './PlaceLabel';

/** Turn user input into a LupiraGeoApi placeId: typeahead over existing places; committing unmatched
 *  free text falls back to POST /places/resolve, which matches or geocodes-and-persists a place. */
export function PlacePicker({ placeId, onChange, placeholder }: {
  placeId: string | null;
  onChange: (placeId: string | null) => void;
  placeholder?: string;
}) {
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const resolve = useResolvePlace();

  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 250);
    return () => clearTimeout(t);
  }, [text]);

  const { data: suggestions } = useSuggestPlaces({ q, limit: 8 }, { query: { enabled: q.length >= 2 } });
  // Locality suggestions are admin areas, not places — their ids aren't valid placeIds.
  const places = q.length >= 2 ? (suggestions ?? []).filter((s) => s.type === SuggestionType.Place) : [];

  const pick = (id: string) => {
    onChange(id);
    setText('');
    setError(null);
  };

  async function commit() {
    const t = text.trim();
    if (!t) return;
    setError(null);
    try {
      const res = await resolve.mutateAsync({ data: { text: t } });
      if (res.placeId) pick(res.placeId);
      else setError('Couldn’t resolve — geocoder unavailable.');
    } catch (e) {
      setError(errText(e) ?? 'Resolve failed.');
    }
  }

  if (placeId) {
    return (
      <span className="place-picker resolved">
        📍 <PlaceLabel placeId={placeId} />
        <button type="button" className="icon-btn" title="Clear place" onClick={() => onChange(null)}>
          ×
        </button>
      </span>
    );
  }

  return (
    <span className="place-picker">
      <input
        className="text-input"
        value={text}
        placeholder={placeholder ?? 'Search or type an address…'}
        onChange={(e) => {
          setText(e.target.value);
          setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            void commit();
          }
        }}
      />
      <button type="button" className="btn" onClick={() => void commit()} disabled={!text.trim() || resolve.isPending}>
        {resolve.isPending ? 'Resolving…' : 'Resolve'}
      </button>
      {places.length > 0 && (
        <ul className="place-suggestions">
          {places.map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => pick(s.id)}>
                {s.name}
                {s.context && <span className="meta"> {s.context}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <span className="error-text">{error}</span>}
    </span>
  );
}
