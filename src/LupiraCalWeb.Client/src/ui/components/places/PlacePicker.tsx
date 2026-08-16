import { useEffect, useState } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import { useResolvePlace, useSuggestPlaces } from '../../../data/api-geo/lupiraGeoApi';
import { SuggestionType, type PlaceSuggestionDto } from '../../../data/api-geo/models';
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

  const { data: suggestions, isLoading } = useSuggestPlaces({ q, limit: 8 }, { query: { enabled: q.length >= 2 } });
  // Locality suggestions are admin areas, not places — their ids aren't valid placeIds.
  const places = q.length >= 2 ? (suggestions ?? []).filter((s) => s.type === SuggestionType.Place) : [];

  const pick = (id: string) => {
    onChange(id);
    setText('');
    setError(null);
  };

  async function commit(raw: string) {
    const t = raw.trim();
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
        <Tooltip title="Clear place">
          <IconButton size="small" onClick={() => onChange(null)}>
            ×
          </IconButton>
        </Tooltip>
      </span>
    );
  }

  return (
    <span className="place-picker">
      <Autocomplete<PlaceSuggestionDto, false, false, true>
        freeSolo
        options={places}
        filterOptions={(x) => x}
        loading={q.length >= 2 && isLoading}
        value={null}
        inputValue={text}
        onInputChange={(_, v) => {
          setText(v);
          setError(null);
        }}
        onChange={(_, value) => {
          if (typeof value === 'string') void commit(value);
          else if (value) pick(value.id);
        }}
        getOptionLabel={(o) => (typeof o === 'string' ? o : o.name)}
        renderOption={({ key, ...props }, o) => (
          <li key={key} {...props}>
            {o.name}
            {o.context && <span className="meta"> {o.context}</span>}
          </li>
        )}
        renderInput={(params) => (
          <TextField {...params} size="small" placeholder={placeholder ?? 'Search or type an address…'} />
        )}
        sx={{ flex: 1 }}
      />
      <Button variant="outlined" size="small" type="button" onClick={() => void commit(text)} disabled={!text.trim() || resolve.isPending}>
        {resolve.isPending ? 'Resolving…' : 'Resolve'}
      </Button>
      {error && <span className="error-text">{error}</span>}
    </span>
  );
}
