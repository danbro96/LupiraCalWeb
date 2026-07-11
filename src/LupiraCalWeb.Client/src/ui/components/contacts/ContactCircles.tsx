import { Link, useLocation } from 'react-router-dom';
import { useGetContactCircles } from '../../../data/api-contact/lupiraContactApi';
import type { CircleKind } from '../../../data/api-contact/models';

const CIRCLE_LABEL: Record<CircleKind, string> = {
  CloseFamily: 'Close family',
  ExtendedFamily: 'Extended family',
  Friends: 'Friends',
  Colleagues: 'Colleagues',
  Household: 'Household',
};

/** Computed social circles around a contact (close family / extended / friends / colleagues / household). */
export function ContactCircles({ focusId }: { focusId: string }) {
  const location = useLocation();
  const { data, isLoading } = useGetContactCircles({ focusId });
  if (isLoading) return <p className="meta">Loading circles…</p>;

  const circles = (data?.circles ?? []).filter((c) => c.members.length > 0);
  if (circles.length === 0) return <p className="empty">No circles yet — add relations to build them.</p>;

  return (
    <>
      {circles.map((c) => (
        <div key={c.kind}>
          <p className="section-label">{CIRCLE_LABEL[c.kind]}</p>
          {c.members.map((m) => (
            <div key={m.contactId} className="membership-row">
              {m.kind && <span className="badge">{m.kind}</span>}
              <Link className="membership-name" to={{ pathname: `/contacts/${m.contactId}`, search: location.search }}>
                {m.displayName}
              </Link>
            </div>
          ))}
        </div>
      ))}
    </>
  );
}
