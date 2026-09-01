import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Chip, Text } from 'react-native-paper';
import { createItemRelation } from '@lupira/cal-api/fetch/cal';
import { toast, toastError } from '../../feedback/toast';
import { useLinkCandidates, useLinkedEvents, usePhotoEventLinks } from '../../state/photo-queries';
import { invalidatePhotos } from '../../sync/reactivity';
import { useColors } from '../theme';
import type { RootStackParamList } from '../navigation/types';
import { ICONS } from '../icons';

/** The events a photo belongs to. The edge lives in cal-api as a generic Relation
 *  (`toKind: 'photo'`), the same one tasks and engagements already use. */
export function PhotoEventLinks({ photoId, takenAt }: { photoId: string; takenAt: string }) {
  const c = useColors();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const links = usePhotoEventLinks();
  const linked = useLinkedEvents(links.get(photoId) ?? []);
  const [picking, setPicking] = useState(false);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const { data: candidates, isLoading } = useLinkCandidates(takenAt, picking);

  const onLink = async (itemId: string) => {
    setLinkingId(itemId);
    const r = await createItemRelation(itemId, { toKind: 'photo', toRef: photoId, relationType: 'depicts' })
      .catch(() => null);
    setLinkingId(null);
    if (r?.status === 200) {
      toast('Linked to the event');
      setPicking(false);
      invalidatePhotos();
    } else {
      toastError('Could not link the photo.');
    }
  };

  const unlinked = (candidates ?? []).filter((i) => !linked.some((l) => l.id === i.id));

  return (
    <View style={styles.root}>
      {linked.length === 0 && (
        <Text style={[styles.muted, { color: c.textMuted }]}>Not linked to an event.</Text>
      )}
      <View style={styles.chips}>
        {linked.map((event) => (
          <Chip key={event.id} compact icon={ICONS.calendar}
            onPress={() => navigation.navigate('ItemDetail', { itemId: event.id })}>
            {event.title}
          </Chip>
        ))}
      </View>

      {picking ? (
        <View style={styles.chips}>
          {isLoading && <Text style={[styles.muted, { color: c.textMuted }]}>Looking…</Text>}
          {!isLoading && unlinked.length === 0 && (
            <Text style={[styles.muted, { color: c.textMuted }]}>No events around this time.</Text>
          )}
          {unlinked.map((item) => (
            <Chip key={item.id} compact disabled={linkingId !== null} onPress={() => void onLink(item.id)}>
              {item.title ?? 'Untitled event'}
            </Chip>
          ))}
          <Button mode="text" compact onPress={() => setPicking(false)}>Cancel</Button>
        </View>
      ) : (
        <Button mode="text" compact onPress={() => setPicking(true)}>Link to event…</Button>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  muted: { fontSize: 13 },
});
