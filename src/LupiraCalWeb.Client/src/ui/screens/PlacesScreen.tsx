import { lazy, Suspense, useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Drawer from '@mui/material/Drawer';
import MenuItem from '@mui/material/MenuItem';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import { classifyOrphan, defaultPruneSelection, type OrphanClass } from '@lupira/cal-domain/placeCuration';
import { useUpdatePlace } from '../../data/api-geo/lupiraGeoApi';
import { PlaceSource, type OrphanCandidateDto, type PlaceDto } from '../../data/api-geo/models';
import { useInvalidatePlaces } from '../../state/useInvalidate';
import {
  isLanOnly404,
  useOrphanPlaces,
  usePlaceHistory,
  usePrune,
  useRegeocode,
  useUnlocatedPlaces,
} from '../../state/usePlaceCuration';
import { errText } from '../components/errText';
import { useSnackbar } from '../components/SnackbarHost';

const MapPinDialog = lazy(() => import('../components/map/MapPinDialog'));

const LAN_ONLY_MSG = 'Geo curation is only reachable on the home network.';

export default function PlacesScreen() {
  const [historyFor, setHistoryFor] = useState<{ id: string; name: string } | null>(null);

  return (
    <div className="page">
      <div className="page-head">
        <h2>Places</h2>
      </div>
      <UnlocatedSection onHistory={setHistoryFor} />
      <OrphansSection onHistory={setHistoryFor} />
      {historyFor && <HistoryDrawer placeId={historyFor.id} name={historyFor.name} onClose={() => setHistoryFor(null)} />}
    </div>
  );
}

type VerifiedFilter = '' | 'true' | 'false';

function UnlocatedSection({ onHistory }: { onHistory: (p: { id: string; name: string }) => void }) {
  const [source, setSource] = useState<'' | PlaceSource>('');
  const [verified, setVerified] = useState<VerifiedFilter>('');
  const { data: places, isLoading, error } = useUnlocatedPlaces({
    source: source || undefined,
    verified: verified ? verified === 'true' : undefined,
  });
  const [pinFor, setPinFor] = useState<PlaceDto | null>(null);
  const [coordsFor, setCoordsFor] = useState<PlaceDto | null>(null);
  const invalidate = useInvalidatePlaces();
  const showSnack = useSnackbar();
  const update = useUpdatePlace({
    mutation: {
      onSuccess: () => invalidate(),
      onError: (e) => showSnack(errText(e) ?? 'Request failed.'),
    },
  });

  return (
    <section className="drawer-section">
      <h3>Unlocated</h3>
      <div className="form-row">
        <TextField
          select
          label="Source"
          value={source}
          onChange={(e) => setSource(e.target.value as '' | PlaceSource)}
          slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
        >
          <MenuItem value="">(any)</MenuItem>
          {Object.values(PlaceSource).map((s) => (
            <MenuItem key={s} value={s}>
              {s}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Verified"
          value={verified}
          onChange={(e) => setVerified(e.target.value as VerifiedFilter)}
          slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
        >
          <MenuItem value="">(any)</MenuItem>
          <MenuItem value="true">Verified</MenuItem>
          <MenuItem value="false">Unverified</MenuItem>
        </TextField>
      </div>
      {isLoading && <p className="meta">Loading…</p>}
      {error != null && <Alert severity="error">{errText(error) ?? 'Failed to load places.'}</Alert>}
      {places && places.length === 0 && <p className="meta">Every place has coordinates.</p>}
      {places && places.length > 0 && (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Kind</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Source</TableCell>
              <TableCell>Verified</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {places.map((p) => (
              <UnlocatedRow
                key={p.id}
                place={p}
                onFixOnMap={() => setPinFor(p)}
                onManualCoords={() => setCoordsFor(p)}
                onVerify={() => update.mutate({ id: p.id, data: { verified: true } })}
                onHistory={() => onHistory({ id: p.id, name: p.name })}
              />
            ))}
          </TableBody>
        </Table>
      )}
      {pinFor && (
        <Suspense fallback={null}>
          <MapPinDialog
            title={`Locate “${pinFor.name}”`}
            onConfirm={(lat, lon) => {
              update.mutate({ id: pinFor.id, data: { latitude: lat, longitude: lon } });
              setPinFor(null);
            }}
            onCancel={() => setPinFor(null)}
          />
        </Suspense>
      )}
      {coordsFor && (
        <ManualCoordsDialog
          place={coordsFor}
          pending={update.isPending}
          onSave={(lat, lon) => {
            update.mutate(
              { id: coordsFor.id, data: { latitude: lat, longitude: lon } },
              { onSuccess: () => setCoordsFor(null) },
            );
          }}
          onCancel={() => setCoordsFor(null)}
        />
      )}
    </section>
  );
}

function UnlocatedRow({ place, onFixOnMap, onManualCoords, onVerify, onHistory }: {
  place: PlaceDto;
  onFixOnMap: () => void;
  onManualCoords: () => void;
  onVerify: () => void;
  onHistory: () => void;
}) {
  const regeocode = useRegeocode();

  return (
    <TableRow>
      <TableCell>
        {place.name}
        {regeocode.data && regeocode.data.latitude != null && (
          <Chip color="success" sx={{ ml: 1 }} label={`${regeocode.data.latitude.toFixed(5)}, ${regeocode.data.longitude?.toFixed(5)}`} />
        )}
        {regeocode.error != null && <span className="error-text"> {errText(regeocode.error) ?? 'Regeocode failed.'}</span>}
      </TableCell>
      <TableCell className="meta">{place.kind}</TableCell>
      <TableCell className="meta">{place.category}</TableCell>
      <TableCell className="meta">{place.source}</TableCell>
      <TableCell>{place.verified ? <Chip label="Verified" /> : <span className="meta">—</span>}</TableCell>
      <TableCell>
        <Button disabled={regeocode.isPending || !!regeocode.data} onClick={() => regeocode.mutate({ id: place.id })}>
          {regeocode.isPending ? 'Regeocoding…' : 'Regeocode'}
        </Button>
        <Button onClick={onFixOnMap}>
          Fix on map
        </Button>
        <Button onClick={onManualCoords}>
          Manual coords
        </Button>
        {!place.verified && (
          <Button onClick={onVerify}>
            Verify
          </Button>
        )}
        <Button onClick={onHistory}>
          History
        </Button>
      </TableCell>
    </TableRow>
  );
}

function ManualCoordsDialog({ place, pending, onSave, onCancel }: {
  place: PlaceDto;
  pending: boolean;
  onSave: (lat: number, lon: number) => void;
  onCancel: () => void;
}) {
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const parsed = { lat: Number(lat), lon: Number(lon) };
  const valid =
    lat.trim() !== '' && lon.trim() !== '' &&
    Number.isFinite(parsed.lat) && Number.isFinite(parsed.lon) &&
    Math.abs(parsed.lat) <= 90 && Math.abs(parsed.lon) <= 180;

  return (
    <Dialog open onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>Coordinates for “{place.name}”</DialogTitle>
      <DialogContent>
        <div className="form-row">
          <TextField label="Latitude" value={lat} onChange={(e) => setLat(e.target.value)} autoFocus />
          <TextField label="Longitude" value={lon} onChange={(e) => setLon(e.target.value)} />
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="contained" disabled={!valid || pending} onClick={() => onSave(parsed.lat, parsed.lon)}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

const ORPHAN_CHIP: Record<OrphanClass, { label: string; color: 'success' | 'warning' | 'default' }> = {
  prunable: { label: 'prunable', color: 'success' },
  referencedByDeletedOnly: { label: 'deleted refs only', color: 'warning' },
  referenced: { label: 'referenced', color: 'default' },
};

function OrphansSection({ onHistory }: { onHistory: (p: { id: string; name: string }) => void }) {
  const { data: orphans, isLoading, error } = useOrphanPlaces();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const prune = usePrune();
  const showSnack = useSnackbar();

  useEffect(() => {
    setSelected(new Set(defaultPruneSelection(orphans ?? [])));
  }, [orphans]);

  const toggle = (placeId: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(placeId)) next.delete(placeId);
      else next.add(placeId);
      return next;
    });

  const doPrune = () => {
    setConfirming(false);
    prune.mutate([...selected], {
      onSuccess: (results) => {
        const pruned = results.filter((r) => r.status === 'Pruned').length;
        const skipped = results.length - pruned;
        showSnack(`Pruned ${pruned} place${pruned === 1 ? '' : 's'}${skipped ? `, ${skipped} skipped` : ''}.`);
      },
      onError: (e) => showSnack(isLanOnly404(e) ? LAN_ONLY_MSG : (errText(e) ?? 'Prune failed.')),
    });
  };

  return (
    <section className="drawer-section">
      <h3>Orphans</h3>
      {isLoading && <p className="meta">Loading…</p>}
      {error != null &&
        (isLanOnly404(error) ? (
          <Alert severity="info">{LAN_ONLY_MSG}</Alert>
        ) : (
          <Alert severity="error">{errText(error) ?? 'Failed to load orphans.'}</Alert>
        ))}
      {orphans && orphans.length === 0 && <p className="meta">No orphaned places.</p>}
      {orphans && orphans.length > 0 && (
        <>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" />
                <TableCell>Name</TableCell>
                <TableCell>Kind</TableCell>
                <TableCell>Source</TableCell>
                <TableCell align="right">Contacts</TableCell>
                <TableCell align="right">Cal live</TableCell>
                <TableCell align="right">Cal deleted</TableCell>
                <TableCell align="right">Saved</TableCell>
                <TableCell>Status</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {orphans.map((o) => (
                <OrphanRow
                  key={o.placeId}
                  orphan={o}
                  checked={selected.has(o.placeId)}
                  onToggle={() => toggle(o.placeId)}
                  onHistory={() => onHistory({ id: o.placeId, name: o.name })}
                />
              ))}
            </TableBody>
          </Table>
          <div className="chip-row">
            <Button
              variant="contained"
              color="error"
              disabled={selected.size === 0 || prune.isPending}
              onClick={() => setConfirming(true)}
            >
              {prune.isPending ? 'Pruning…' : `Prune ${selected.size} selected`}
            </Button>
          </div>
        </>
      )}
      <Dialog open={confirming} onClose={() => setConfirming(false)}>
        <DialogTitle>Soft delete {selected.size} place{selected.size === 1 ? '' : 's'}?</DialogTitle>
        <DialogContent>
          <p className="meta">References are re-checked at prune time; anything referenced since is left alone.</p>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirming(false)}>
            Cancel
          </Button>
          <Button variant="contained" color="error" onClick={doPrune}>
            Prune
          </Button>
        </DialogActions>
      </Dialog>
    </section>
  );
}

function OrphanRow({ orphan, checked, onToggle, onHistory }: {
  orphan: OrphanCandidateDto;
  checked: boolean;
  onToggle: () => void;
  onHistory: () => void;
}) {
  const cls = classifyOrphan(orphan);
  const chip = ORPHAN_CHIP[cls];

  return (
    <TableRow>
      <TableCell padding="checkbox">
        <Checkbox size="small" checked={checked} disabled={cls === 'referenced'} onChange={onToggle} />
      </TableCell>
      <TableCell>{orphan.name}</TableCell>
      <TableCell className="meta">
        {orphan.kind}
        {orphan.category !== 'Unknown' ? ` · ${orphan.category}` : ''}
      </TableCell>
      <TableCell className="meta">{orphan.source}</TableCell>
      <TableCell align="right">{orphan.contactRefs}</TableCell>
      <TableCell align="right">{orphan.calendarLiveRefs}</TableCell>
      <TableCell align="right">{orphan.calendarDeletedRefs}</TableCell>
      <TableCell align="right">{orphan.savedPlaceRefs}</TableCell>
      <TableCell>
        <Chip color={chip.color} label={chip.label} />
      </TableCell>
      <TableCell>
        <Button onClick={onHistory}>
          History
        </Button>
      </TableCell>
    </TableRow>
  );
}

function HistoryDrawer({ placeId, name, onClose }: { placeId: string; name: string; onClose: () => void }) {
  const { data: events, isLoading, error } = usePlaceHistory(placeId);

  return (
    <Drawer anchor="right" open onClose={onClose}>
      <div className="drawer-pad" style={{ width: 360, maxWidth: '90vw' }}>
        <h3>History — {name}</h3>
        {isLoading && <p className="meta">Loading…</p>}
        {error != null &&
          (isLanOnly404(error) ? (
            <Alert severity="info">{LAN_ONLY_MSG}</Alert>
          ) : (
            <Alert severity="error">{errText(error) ?? 'Failed to load history.'}</Alert>
          ))}
        {events && events.length === 0 && <p className="meta">No curation events.</p>}
        {events?.map((e) => (
          <div key={e.seq} className="drawer-section">
            <p className="field-value">
              #{e.seq} {e.action}
              <span className="meta"> · {new Date(e.at).toLocaleString()}</span>
            </p>
            {e.detail && <p className="meta">{e.detail}</p>}
            {e.relatedPlaceId && <p className="meta">related: {e.relatedPlaceId}</p>}
            {e.actorPrincipalId && <p className="meta">by {e.actorPrincipalId}</p>}
          </div>
        ))}
      </div>
    </Drawer>
  );
}
