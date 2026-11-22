import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Button } from '@/components/Button';
import { bookOnOla, bookOnUber, openRapido, type Place } from '@/services/cabApps';

/**
 * One tap opens Uber or Ola with the group's pickup and destination already filled in.
 * Rapido can't be pre-filled, so it gets an open button and a copy of the drop address to paste.
 */
export function BookCabButtons({ pickup, drop }: { pickup: Place; drop: Place }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const copyDrop = async () => {
    await Clipboard.setStringAsync(drop.name);
    setCopied(true);
  };

  return (
    <View style={styles.grid}>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Button label="Book on Uber" variant="ghost" icon="directions_car" onPress={() => bookOnUber(pickup, drop)} />
        </View>
        <View style={styles.flex}>
          <Button label="Book on Ola" variant="ghost" icon="directions_car" onPress={() => bookOnOla(pickup, drop)} />
        </View>
      </View>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Button label="Open Rapido" variant="ghost" icon="two_wheeler" onPress={openRapido} />
        </View>
        <View style={styles.flex}>
          <Button
            label={copied ? 'Drop copied' : 'Copy drop'}
            variant="ghost"
            icon={copied ? 'check' : 'content_copy'}
            onPress={copyDrop}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: 12 },
  row: { flexDirection: 'row', gap: 12 },
  flex: { flex: 1 },
});
