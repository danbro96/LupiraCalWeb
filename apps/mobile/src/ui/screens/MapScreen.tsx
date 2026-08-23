import {
  Camera,
  GeoJSONSource,
  Layer,
  Map as MapView,
  TransformRequestManager,
  type CameraRef,
  type GeoJSONSourceRef,
  type PressEventWithFeatures,
  type StyleSpecification,
} from '@maplibre/maplibre-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { NativeSyntheticEvent } from 'react-native';
import { StyleSheet, useColorScheme, View } from 'react-native';
import { ActivityIndicator, Banner, Chip, useTheme } from 'react-native-paper';
import type { MapTheme } from '../../data/mapStyle';
import { fallbackStyle } from '../../data/mapStyle';
import { useAuth } from '../../state/auth-store';
import { useEventFeatures, useMapStyle, useSavedPlaceFeatures } from '../../state/map-queries';
import { MAP_COLORS } from '../map/mapTokens';
import type { RootStackParamList } from '../navigation/types';

// Matches the web MapScreen default (Nordics, the basemap extract's home).
const DEFAULT_CENTER: [number, number] = [18.07, 59.33];
const DEFAULT_ZOOM = 9;
const PAST_DAYS = 90;
const FUTURE_DAYS = 180;

const AUTH_HEADER_ID = 'lupira-auth';

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/// The native map fetches style assets (tiles/glyphs/sprite) itself, outside the mutator — the bearer
/// rides a TransformRequestManager header scoped to the BFF origin. Scoping matters: presigned or
/// third-party URLs must never receive an Authorization header. Re-adding the same id updates in place,
/// which is what makes token rotation safe mid-session.
function useMapAuthHeader() {
  const token = useAuth((s) => s.token);
  const apiUrl = useAuth((s) => s.apiUrl);
  useEffect(() => {
    if (!token) {
      TransformRequestManager.removeHeader(AUTH_HEADER_ID);
      return;
    }
    TransformRequestManager.addHeader({
      id: AUTH_HEADER_ID,
      name: 'Authorization',
      value: `Bearer ${token}`,
      match: `^${escapeRegex(apiUrl.replace(/\/$/, ''))}/`,
    });
  }, [token, apiUrl]);
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

type LayerKey = 'events' | 'saved';

export function MapScreen() {
  const paper = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const scheme = useColorScheme();
  const theme: MapTheme = scheme === 'dark' ? 'dark' : 'light';
  const colors = MAP_COLORS[theme];

  useMapAuthHeader();

  const { style, degraded } = useMapStyle(theme);
  const [enabled, setEnabled] = useState<Record<LayerKey, boolean>>({ events: true, saved: true });

  const { fromDay, toDay } = useMemo(() => {
    const now = Date.now();
    return {
      fromDay: dayKey(new Date(now - PAST_DAYS * 86_400_000)),
      toDay: dayKey(new Date(now + FUTURE_DAYS * 86_400_000)),
    };
  }, []);

  const events = useEventFeatures(fromDay, toDay, enabled.events);
  const saved = useSavedPlaceFeatures(enabled.saved);

  const cameraRef = useRef<CameraRef>(null);
  const eventSourceRef = useRef<GeoJSONSourceRef>(null);

  const onEventPress = async (e: NativeSyntheticEvent<PressEventWithFeatures>) => {
    const feature = e.nativeEvent.features[0];
    if (!feature) return;
    const props = feature.properties ?? {};
    const [lng, lat] = (feature.geometry as GeoJSON.Point).coordinates;
    if (props.cluster) {
      const zoom = await eventSourceRef.current?.getClusterExpansionZoom(props.cluster_id as number);
      if (zoom != null) cameraRef.current?.easeTo({ center: [lng, lat], zoom: zoom + 0.5, duration: 400 });
      return;
    }
    if (typeof props.itemId === 'string') navigation.navigate('ItemDetail', { itemId: props.itemId });
  };

  const toggle = (key: LayerKey) => setEnabled((s) => ({ ...s, [key]: !s[key] }));

  const mapStyle = style ?? (degraded ? fallbackStyle(theme) : undefined);

  return (
    <View style={[styles.root, { backgroundColor: paper.colors.background }]}>
      {degraded && <Banner visible icon="map-marker-off">Basemap unavailable — showing pins on a plain background.</Banner>}
      <View style={styles.chips}>
        <Chip compact selected={enabled.events} onPress={() => toggle('events')} showSelectedCheck>Events</Chip>
        <Chip compact selected={enabled.saved} onPress={() => toggle('saved')} showSelectedCheck>Saved</Chip>
      </View>
      {mapStyle ? (
        <MapView style={styles.map} mapStyle={mapStyle as unknown as StyleSpecification}>
          <Camera ref={cameraRef} initialViewState={{ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM }} />
          {enabled.saved && (
            <GeoJSONSource id="saved-places" data={saved}>
              <Layer
                id="saved-circles"
                type="circle"
                paint={{
                  'circle-color': colors.saved,
                  'circle-radius': 6,
                  'circle-stroke-color': colors.ring,
                  'circle-stroke-width': 2,
                }}
              />
              <Layer
                id="saved-labels"
                type="symbol"
                layout={{
                  'text-field': ['get', 'label'],
                  'text-size': 11,
                  'text-offset': [0, 1.2],
                  'text-anchor': 'top',
                  'text-optional': true,
                }}
                paint={{ 'text-color': colors.ink, 'text-halo-color': colors.ring, 'text-halo-width': 1 }}
              />
            </GeoJSONSource>
          )}
          {enabled.events && (
            <GeoJSONSource
              ref={eventSourceRef}
              id="events"
              data={events}
              cluster
              clusterRadius={48}
              clusterMaxZoom={14}
              onPress={onEventPress}
            >
              <Layer
                id="event-clusters"
                type="circle"
                filter={['has', 'point_count']}
                paint={{
                  'circle-color': colors.eventFallback,
                  'circle-radius': ['step', ['get', 'point_count'], 14, 10, 18, 50, 24],
                  'circle-stroke-color': colors.ring,
                  'circle-stroke-width': 2,
                }}
              />
              <Layer
                id="event-cluster-counts"
                type="symbol"
                filter={['has', 'point_count']}
                layout={{ 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 12, 'text-allow-overlap': true }}
                paint={{ 'text-color': colors.ring }}
              />
              <Layer
                id="event-pins"
                type="circle"
                filter={['!', ['has', 'point_count']]}
                paint={{
                  'circle-color': ['coalesce', ['get', 'color'], colors.eventFallback],
                  'circle-radius': 7,
                  'circle-stroke-color': colors.ring,
                  'circle-stroke-width': 2,
                }}
              />
            </GeoJSONSource>
          )}
        </MapView>
      ) : (
        <View style={styles.loading}>
          <ActivityIndicator />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  chips: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  map: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
