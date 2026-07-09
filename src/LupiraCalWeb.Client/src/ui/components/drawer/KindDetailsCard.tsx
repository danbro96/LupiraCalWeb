import type { ItemDetails } from '../../../data/api/models';
import { fmtDateTime } from '../../../domain/time';

/** Read-only card for the composable item detail: a booking, a travel leg, and/or a presence segment.
 *  Details are authored elsewhere (agent/DAV); REST only writes the presence status. */
export function KindDetailsCard({ details }: { details?: ItemDetails | null }) {
  if (!details) return null;

  const when = (iso?: string | null) => (iso ? fmtDateTime(new Date(iso)) : null);
  const rows: Array<[string, string | null | undefined]> = [];

  if (details.travel) {
    const t = details.travel;
    rows.push(
      ['To', t.toLabel], ['From', t.fromLabel],
      ['Departs', when(t.departAt)], ['Arrives', when(t.arriveAt)],
      ['Carrier', t.carrier], ['Service', t.serviceNumber],
      ['Departure point', t.departurePoint], ['Arrival point', t.arrivalPoint], ['Seat', t.seat],
    );
  }
  if (details.booking) {
    const b = details.booking;
    rows.push(
      ['Confirmation', b.confirmationNumber], ['Reference', b.reference],
      ['Amount', b.amount != null ? `${b.amount} ${b.currency ?? ''}`.trim() : null],
      ['Party size', b.partySize != null ? String(b.partySize) : null],
    );
  }
  if (details.presence) rows.push(['Availability', details.presence.status]);

  const visible = rows.filter(([, v]) => v);
  if (visible.length === 0 && !details.booking?.url) return null;

  return (
    <section className="drawer-section">
      <h3>Details</h3>
      <dl className="detail-grid">
        {visible.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {details.booking?.url && (
        <a className="linklike" href={details.booking.url} target="_blank" rel="noreferrer">
          Booking ↗
        </a>
      )}
    </section>
  );
}
