import { Link, useSearchParams } from 'react-router-dom';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import type { CalendarItemDto } from '../../../data/api/models';
import { useSearchContacts } from '../../../data/api-contact/lupiraContactApi';
import { formatCoords, osmUrl } from '@lupira/cal-domain/places';
import { fmtDate, fmtDateTime, parseYmd } from '@lupira/cal-domain/time';
import { useGeoPlace, usePlaceItems } from '../../../state/usePlaces';
import { ITEM_CATEGORY_ICONS } from '../../theme/kinds';
import { DrawerSection } from '../DrawerSection';
import IconButton from '@mui/material/IconButton';
import Box from '@mui/material/Box';
import CloseIcon from '@mui/icons-material/Close';
import { Row, RowName } from '../rows';

/** The ?place= detail pane (extracted from the former LocationsScreen): containment, items, contacts. */
export function PlaceDetailPanel({ placeId, onClose }: { placeId: string; onClose: () => void }) {
  const { data: place, isLoading } = useGeoPlace(placeId);

  return (
    <Paper
      component="aside"
      elevation={4}
      sx={{
        position: 'absolute',
        zIndex: 6,
        top: { xs: 'auto', sm: 1.5 },
        right: 1.5,
        left: { xs: 1.5, sm: 'auto' },
        bottom: { xs: 'calc(64px + 12px)', sm: 1.5 },
        maxHeight: { xs: '45vh', sm: 'none' },
        width: { xs: 'auto', sm: 'min(360px, calc(100vw - 24px))' },
        overflowY: 'auto',
        borderRadius: '12px',
        p: 1.5,
      }}
    >
      <IconButton onClick={onClose} aria-label="Close" sx={{ position: 'absolute', top: 4, right: 4 }}>
        <CloseIcon fontSize="small" />
      </IconButton>
      {isLoading && <Typography variant="caption" sx={{ color: 'text.secondary' }} component="p">Loading…</Typography>}
      {!isLoading && !place && <Typography component="p" sx={{ textAlign: 'center', color: 'text.subtle', mt: 6 }}>Place not found.</Typography>}
      {place && (
        <>
          <Paper variant="outlined" component="section" sx={{ p: '12px 16px', my: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <h3 style={{ margin: 0, flex: 1 }}>{place.name}</h3>
              <Chip variant="outlined" label={place.category} />
            </Box>
            {(place.containment ?? []).length > 0 && (
              <div className="loc-breadcrumb">
                {(place.containment ?? []).map((a, i) => (
                  <span key={a.id}>
                    {i > 0 && <span className="sep"> › </span>}
                    {a.name}
                  </span>
                ))}
              </div>
            )}
            {place.formattedAddress && <Typography component="p" sx={{ mb: 1, color: 'text.secondary' }}>{place.formattedAddress}</Typography>}
            {formatCoords(place.latitude, place.longitude) && (
              <Typography component="p" sx={{ mb: 1, color: 'text.secondary' }}>
                📍 {formatCoords(place.latitude, place.longitude)}
                {osmUrl(place.latitude, place.longitude) && (
                  <>
                    {' '}
                    <Button
                      variant="text"
                      href={osmUrl(place.latitude, place.longitude)!}
                      target="_blank"
                      rel="noreferrer"
                    >
                      OSM ↗
                    </Button>
                  </>
                )}
              </Typography>
            )}
          </Paper>
          <ItemsPanel placeId={placeId} />
          <ContactsPanel placeId={placeId} />
        </>
      )}
    </Paper>
  );
}

function ItemsPanel({ placeId }: { placeId: string }) {
  const [params] = useSearchParams();
  const { data: items, isLoading } = usePlaceItems(placeId);

  const itemHref = (id: string) => {
    const next = new URLSearchParams(params);
    next.set('item', id);
    return `?${next.toString()}`;
  };

  return (
    <DrawerSection title="Items here">
      {isLoading && <Typography variant="caption" sx={{ color: 'text.secondary' }} component="p">Loading…</Typography>}
      {!isLoading && (items ?? []).length === 0 && <Typography component="p" sx={{ textAlign: 'center', color: 'text.subtle', mt: 6 }}>No items reference this place.</Typography>}
      {(items ?? []).map((item) => (
        <Row component={Link} key={item.id} to={itemHref(item.id)}>
          {item.category && ITEM_CATEGORY_ICONS[item.category] && (
            <Box component="span" sx={{ fontSize: 22 }}>{ITEM_CATEGORY_ICONS[item.category]}</Box>
          )}
          <RowName>{item.title || '(untitled)'}</RowName>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>{whenOf(item)}</Typography>
          {roleOf(item, placeId) && <span className="loc-role">{roleOf(item, placeId)}</span>}
        </Row>
      ))}
    </DrawerSection>
  );
}

function ContactsPanel({ placeId }: { placeId: string }) {
  const { data: contacts } = useSearchContacts({});
  const here = (contacts ?? []).filter((c) => (c.addresses ?? []).some((a) => a.placeId === placeId));
  if (here.length === 0) return null;
  return (
    <DrawerSection title="Contacts here">
      {here.map((c) => (
        <Row component={Link} key={c.id} to={`/contacts/${c.id}`}>
          <RowName>{c.displayName}</RowName>
        </Row>
      ))}
    </DrawerSection>
  );
}

/** Which role the place plays for an item: its location, or a travel endpoint. */
function roleOf(item: CalendarItemDto, placeId: string): string {
  if (item.placeId === placeId) return 'At';
  const t = item.details?.travel;
  if (t?.toPlaceId === placeId) return 'To';
  if (t?.fromPlaceId === placeId) return 'From';
  return '';
}

function whenOf(item: CalendarItemDto): string {
  if (item.isAllDay) return item.startDate ? fmtDate(parseYmd(item.startDate)) : '';
  return item.startsAt ? fmtDateTime(new Date(item.startsAt)) : '';
}
