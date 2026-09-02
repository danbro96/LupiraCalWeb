import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { List } from 'react-native-paper';
import { useEventPhotos } from '../../state/usePhotoEventLinks';
import { useColors } from '../theme';
import type { RootStackParamList } from '../navigation/types';

const THUMB = 88;

/** Photos linked to this event. Renders nothing when there are none — an empty strip on every event
 *  would be noise. */
export function EventPhotosRow({ itemId }: { itemId: string }) {
  const c = useColors();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const photos = useEventPhotos(itemId);
  if (photos.length === 0) return null;

  return (
    <View>
      <List.Subheader>Photos</List.Subheader>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        {photos.map((photo) => (
          <Pressable key={photo.id} onPress={() => navigation.navigate('PhotoViewer', { photoId: photo.id })}>
            {photo.thumbUrl ? (
              <Image source={{ uri: photo.thumbUrl }} style={styles.thumb} contentFit="cover" recyclingKey={photo.id} />
            ) : (
              <View style={[styles.thumb, { backgroundColor: c.surface }]} />
            )}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { gap: 6, paddingHorizontal: 16 },
  thumb: { width: THUMB, height: THUMB, borderRadius: 4 },
});
