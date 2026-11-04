import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/Button';
import { bookOnOla, bookOnUber, type Place } from '@/services/cabApps';

/** One tap opens Uber or Ola with the group's pickup and destination already filled in. */
export function BookCabButtons({ pickup, drop }: { pickup: Place; drop: Place }) {
  return (
    <View style={styles.row}>
      <View style={styles.flex}>
        <Button label="Book on Uber" variant="ghost" icon="directions_car" onPress={() => bookOnUber(pickup, drop)} />
      </View>
      <View style={styles.flex}>
        <Button label="Book on Ola" variant="ghost" icon="directions_car" onPress={() => bookOnOla(pickup, drop)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  flex: { flex: 1 },
});
