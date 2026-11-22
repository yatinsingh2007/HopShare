import { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';
import { BookCabButtons } from '@/components/BookCabButtons';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { TextField } from '@/components/TextField';
import { useTheme } from '@/context/ThemeContext';
import type { Place } from '@/services/cabApps';
import { fonts, type } from '@/theme/type';

export type Booking = { bookedAt: string; cabNumber: string | null; tripLink: string | null };
export type BookingInput = { cabNumber: string; tripLink: string };

function BookedForm({ initial, saving, error, onSave, onCancel }: {
  initial: Booking | null;
  saving: boolean;
  error: string | null;
  onSave: (input: BookingInput) => void;
  onCancel: () => void;
}) {
  const { colors } = useTheme();
  const [cabNumber, setCabNumber] = useState(initial?.cabNumber ?? '');
  const [tripLink, setTripLink] = useState(initial?.tripLink ?? '');
  const linkError = tripLink.trim() && !/^https:\/\/\S+$/i.test(tripLink.trim()) ? 'Paste the https:// link from the cab app.' : null;

  return (
    <Animated.View
      entering={FadeInDown.duration(240)}
      style={[styles.card, styles.form, { backgroundColor: colors.card, borderColor: colors.ink }]}
    >
      <View style={styles.gap6}>
        <Text style={[type.title, { color: colors.ink }]}>{initial ? 'Cab details' : 'Cab booked'}</Text>
        <Text style={[type.bodySmall, { color: colors.muted }]}>
          Both optional. The others see these so they can spot and track the cab, and new riders can&apos;t join once it&apos;s booked.
        </Text>
      </View>

      <TextField
        label="Cab number"
        placeholder="HR 26 AB 1234"
        value={cabNumber}
        onChangeText={setCabNumber}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={15}
      />
      <TextField
        label="Trip-share link"
        placeholder="https://"
        helper="In the cab app, tap Share trip and paste the link here so everyone can track the cab."
        error={linkError}
        value={tripLink}
        onChangeText={setTripLink}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        maxLength={500}
      />

      {error ? <Text style={[type.body, { color: colors.danger }]}>{error}</Text> : null}

      <View style={styles.row}>
        <View style={styles.flex}>
          <Button label="Cancel" variant="ghost" disabled={saving} onPress={onCancel} />
        </View>
        <View style={styles.flex}>
          <Button
            label={initial ? 'Save' : 'Cab booked'}
            icon="check"
            loading={saving}
            disabled={!!linkError}
            onPress={() => onSave({ cabNumber, tripLink })}
          />
        </View>
      </View>
    </Animated.View>
  );
}

function BookedCard({ booking, bookerName, isBooker, onEdit }: {
  booking: Booking;
  bookerName: string;
  isBooker: boolean;
  onEdit: () => void;
}) {
  const { colors } = useTheme();
  const heading = `${isBooker ? 'You' : bookerName} booked the cab`;

  return (
    <Animated.View
      entering={FadeIn.duration(240)}
      style={[styles.card, styles.form, { backgroundColor: colors.card, borderColor: colors.line }]}
    >
      <View
        style={styles.bookedHead}
        accessible
        accessibilityLabel={[heading, booking.cabNumber && `Cab number ${booking.cabNumber}`].filter(Boolean).join('. ')}
      >
        <View style={[styles.tile, { backgroundColor: colors.plate }]}>
          <Icon name="local_taxi" size={24} color={colors.plateInk} />
        </View>
        <View style={styles.flex}>
          <Text style={[type.title, { color: colors.ink }]}>{heading}</Text>
        </View>
      </View>

      {booking.cabNumber ? (
        // styled like an Indian number plate: what you look for at the kerb
        <View style={styles.numberPlate} importantForAccessibility="no-hide-descendants">
          <Text style={styles.numberText} numberOfLines={1} adjustsFontSizeToFit>
            {booking.cabNumber}
          </Text>
        </View>
      ) : null}

      {booking.tripLink ? (
        <Button label="Track the cab" icon="open_in_new" onPress={() => Linking.openURL(booking.tripLink!)} />
      ) : !isBooker ? (
        <Text style={[type.bodySmall, { color: colors.muted }]}>
          No trip-share link yet. {bookerName} can add one from the cab app.
        </Text>
      ) : null}

      {isBooker ? (
        <Button
          label={booking.cabNumber || booking.tripLink ? 'Edit cab details' : 'Add cab number or trip link'}
          variant="ghost"
          icon="edit"
          onPress={onEdit}
        />
      ) : null}
    </Animated.View>
  );
}

/**
 * The ride screen's booking section. The person who started the group opens a cab app,
 * comes back and taps Cab booked; after that everyone sees the cab's details.
 */
export function CabBooking({ pickup, drop, booking, isBooker, bookerName, onSave }: {
  pickup: Place;
  drop: Place;
  booking: Booking | null;
  isBooker: boolean;
  bookerName: string;
  onSave: (input: BookingInput) => Promise<string | null>;
}) {
  const { colors } = useTheme();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (input: BookingInput) => {
    setSaving(true);
    setError(null);
    const failed = await onSave(input);
    setSaving(false);
    if (failed) setError(failed);
    else setEditing(false);
  };

  const form = (
    <BookedForm
      initial={booking}
      saving={saving}
      error={error}
      onSave={save}
      onCancel={() => {
        setEditing(false);
        setError(null);
      }}
    />
  );

  return (
    <Animated.View layout={LinearTransition.duration(200)} style={styles.section}>
      <Text style={[type.title, { color: colors.ink }]}>{booking ? 'Your cab' : 'Booking the cab'}</Text>

      {booking ? (
        editing ? form : (
          <BookedCard booking={booking} bookerName={bookerName} isBooker={isBooker} onEdit={() => setEditing(true)} />
        )
      ) : isBooker ? (
        <>
          <Text style={[type.body, { color: colors.muted }]}>
            You started this group, so you book the cab once everyone&apos;s in. Uber or Ola opens with the pickup and
            drop filled in, and the others pay you back their share.
          </Text>
          <BookCabButtons pickup={pickup} drop={drop} />
          {editing ? form : (
            <Button label="I've booked the cab" icon="check" onPress={() => setEditing(true)} />
          )}
        </>
      ) : (
        <Text style={[type.body, { color: colors.muted }]}>
          {bookerName} books the cab. You pay them back your share after the ride.
        </Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { gap: 12 },
  card: { borderWidth: 1.5, borderRadius: 12, padding: 16 },
  form: { gap: 16 },
  gap6: { gap: 6 },
  row: { flexDirection: 'row', gap: 10 },
  bookedHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tile: { width: 44, height: 44, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  numberPlate: {
    alignSelf: 'flex-start',
    borderWidth: 2,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    // a real plate is white with black type in both themes
    backgroundColor: '#FFFFFF',
    borderColor: '#111111',
  },
  numberText: { fontFamily: fonts.extrabold, fontSize: 24, lineHeight: 30, letterSpacing: 1.5, color: '#111111' },
});
