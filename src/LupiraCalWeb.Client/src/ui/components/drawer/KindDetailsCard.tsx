import type { ItemKindDetails } from '../../../data/api/models';
import { fmtDateTime } from '../../../domain/time';
import { usePlaces } from '../../../state/usePlaces';

/** Read-only card for the typed kind detail (Flight gate/seat, Lodging check-in, Bill amount, …).
 *  Kind details are authored elsewhere (agent/DAV) — REST only writes Availability. */
export function KindDetailsCard({ details }: { details?: ItemKindDetails | null }) {
  const placeIds = [
    details?.travel?.toPlaceId,
    details?.travel?.fromPlaceId,
    details?.car?.pickupPlaceId,
    details?.car?.dropoffPlaceId,
  ];
  const places = usePlaces(placeIds);
  if (!details) return null;

  const place = (id?: string | null) => (id ? (places.get(id)?.name ?? '…') : null);
  const when = (iso?: string | null) => (iso ? fmtDateTime(new Date(iso)) : null);
  const rows: Array<[string, string | null | undefined]> = [];

  if (details.travel) {
    const t = details.travel;
    rows.push(['To', place(t.toPlaceId)], ['From', place(t.fromPlaceId)], ['Departs', when(t.departAt)], ['Arrives', when(t.arriveAt)], ['Carrier', t.carrier], ['Booking ref', t.bookingReference]);
  }
  if (details.flight) {
    const f = details.flight;
    rows.push(['Flight', f.flightNumber], ['Terminal', f.terminal], ['Gate', f.gate], ['Gate closes', when(f.gateClosesAt)], ['Seat', f.seatAssignment], ['Baggage', f.baggageAllowance]);
  }
  if (details.train) {
    const t = details.train;
    rows.push(['Train', t.trainNumber], ['Coach', t.coach], ['Seat', t.seat], ['Platform (dep)', t.departurePlatform], ['Platform (arr)', t.arrivalPlatform]);
  }
  if (details.bus) {
    const b = details.bus;
    rows.push(['Operator', b.operator], ['Service', b.serviceNumber], ['From stop', b.departureStop], ['To stop', b.arrivalStop], ['Seat', b.seatReservation]);
  }
  if (details.car) {
    const c = details.car;
    rows.push(['Vehicle', c.vehicle], ['Plate', c.licensePlate], ['Pickup', place(c.pickupPlaceId)], ['Dropoff', place(c.dropoffPlaceId)]);
  }
  if (details.lodging) {
    const l = details.lodging;
    rows.push(['Confirmation', l.confirmationNumber], ['Check-in', when(l.checkInAt)], ['Check-out', when(l.checkOutAt)], ['Room', l.roomType], ['Provider', l.provider]);
  }
  if (details.appointment) {
    const a = details.appointment;
    rows.push(['Type', a.appointmentType], ['Reference', a.referenceNumber], ['Preparation', a.preparationNotes]);
  }
  if (details.ticketed) {
    const t = details.ticketed;
    rows.push(['Performer', t.performer], ['Seat', t.seat], ['Ticket ref', t.ticketReference], ['Doors open', when(t.doorsOpenAt)], ['Provider', t.provider]);
  }
  if (details.delivery) {
    const d = details.delivery;
    rows.push(['Carrier', d.carrier], ['Tracking', d.trackingNumber], ['Order ref', d.orderReference]);
  }
  if (details.bill) {
    const b = details.bill;
    rows.push(['Amount', b.amount != null ? `${b.amount} ${b.currency ?? ''}`.trim() : null], ['Payee', b.payee], ['Invoice', b.invoiceNumber], ['Paid', b.paidAt ? when(b.paidAt) : 'unpaid']);
  }

  const visible = rows.filter(([, v]) => v);
  if (visible.length === 0 && !details.delivery?.trackingUrl) return null;

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
      {details.delivery?.trackingUrl && (
        <a className="linklike" href={details.delivery.trackingUrl} target="_blank" rel="noreferrer">
          Track package ↗
        </a>
      )}
    </section>
  );
}
