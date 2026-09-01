import { NavLink } from 'react-router-dom';
import { useGeoPlace } from '../../../state/usePlaces';

/** Name of a LupiraGeoApi place for a stored placeId; `link` deep-links to the Locations screen. */
export function PlaceLabel({ placeId, link = false }: { placeId?: string | null; link?: boolean }) {
  const { data: place } = useGeoPlace(placeId ?? undefined);
  const title = place?.formattedAddress ?? undefined;
  if (link && placeId) {
    return (
      <NavLink to={{ pathname: '/locations', search: `?place=${placeId}` }} title={title}>
        {place?.name ?? '…'}
      </NavLink>
    );
  }
  return <span title={title}>{place?.name ?? '…'}</span>;
}
