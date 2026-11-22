import { useCallback, useState } from 'react';
import { Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Pictogram } from '@/components/Pictogram';
import { SosButton } from '@/components/SosButton';
import { TextField } from '@/components/TextField';
import { useSession } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useLiveRide } from '@/hooks/useLiveRide';
import { useMe } from '@/hooks/useMe';
import { useMyRides } from '@/hooks/useMyRides';
import { ApiError } from '@/services/api';
import { fonts, type } from '@/theme/type';

type Contact = { id: string; name: string; phone: string };
type RideBits = { sharingTrip: boolean; booking: { cabNumber: string | null } | null; destination: { name: string } };

const message = (e: unknown) => (e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
const pretty = (phone: string) => phone.replace(/^\+91(\d{5})(\d{5})$/, '+91 $1 $2');

// sends my location while a trip share is on; lives here so it runs while this tab is open
function TripSender({ rideId }: { rideId: string }) {
  useLiveRide(rideId, true);
  return null;
}

function ContactRow({ contact, onRemove }: { contact: Contact; onRemove: () => Promise<void> }) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  return (
    <Animated.View entering={FadeInDown.duration(220)} style={styles.contact}>
      <View style={[styles.initial, { backgroundColor: colors.plate }]}>
        <Text style={[styles.initialText, { color: colors.plateInk }]}>{contact.name.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.flex}>
        <Text style={[type.title, { color: colors.ink }]} numberOfLines={1}>{contact.name}</Text>
        <Text style={[type.bodySmall, type.figure, { color: colors.muted }]}>{pretty(contact.phone)}</Text>
      </View>
      <Pressable
        onPress={async () => {
          setBusy(true);
          await onRemove();
          setBusy(false);
        }}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${contact.name}`}
        hitSlop={8}
        style={({ pressed }) => [styles.remove, pressed && styles.pressed]}
      >
        <Icon name="delete" size={22} color={busy ? colors.line : colors.muted} />
      </Pressable>
    </Animated.View>
  );
}

/** Safety tab: SOS, a live link for family while riding, and the trusted contacts SOS texts. */
export default function Safety() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { request } = useSession();
  const { me } = useMe();
  const { liveRide } = useMyRides();
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [ride, setRide] = useState<RideBits | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sos, setSos] = useState<{ shareUrl: string | null } | null>(null);

  const load = useCallback(async () => {
    try {
      setContacts(await request<Contact[]>('/api/me/contacts'));
    } catch (e) {
      setError(message(e));
    }
  }, [request]);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const rideId = liveRide?.id ?? null;
  // only shown while there's a live ride, so a stale value from an older ride never appears
  const loadRide = useCallback(async () => {
    if (!rideId) return;
    setRide(await request<RideBits>(`/api/rides/${rideId}`).catch(() => null));
  }, [rideId, request]);
  useFocusEffect(
    useCallback(() => {
      loadRide();
    }, [loadRide]),
  );

  const run = async (key: string, action: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(null);
    }
  };

  const shareTrip = () =>
    run('share', async () => {
      const { url } = await request<{ url: string }>(`/api/rides/${rideId}/share`, { method: 'POST' });
      await loadRide();
      await Share.share({ message: `Track my HopShare ride to ${ride?.destination.name ?? 'my destination'} live: ${url}` });
    });

  const stopTrip = () =>
    run('stop', async () => {
      await request(`/api/rides/${rideId}/share`, { method: 'DELETE' });
      await loadRide();
    });

  const raiseSos = () =>
    run('sos', async () => {
      const data = await request<{ shareUrl: string | null }>('/api/me/sos', { method: 'POST', body: { rideId } });
      setSos(data);
      if (rideId) loadRide();
    });

  const textContacts = () => {
    if (!contacts?.length) return;
    const body = [
      `SOS from ${me?.firstName ?? 'me'} on HopShare. I may need help.`,
      sos?.shareUrl ? `My live location: ${sos.shareUrl}` : null,
      ride ? `Riding to ${ride.destination.name}${ride.booking?.cabNumber ? `, cab ${ride.booking.cabNumber}` : ''}.` : null,
    ]
      .filter(Boolean)
      .join(' ');
    Linking.openURL(`sms:${contacts.map((c) => c.phone).join(',')}?body=${encodeURIComponent(body)}`).catch(() =>
      setError('Could not open your SMS app.'),
    );
  };

  const addContact = () =>
    run('add', async () => {
      const added = await request<Contact>('/api/me/contacts', { method: 'POST', body: { name, phone } });
      setContacts((all) => [...(all ?? []), added]);
      setName('');
      setPhone('');
      setAdding(false);
    });

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.body, { paddingTop: insets.top + 16 }]}
      keyboardShouldPersistTaps="handled"
    >
      {rideId && ride?.sharingTrip ? <TripSender rideId={rideId} /> : null}

      <Animated.View entering={FadeInDown.duration(260)} style={styles.gap4}>
        <Text style={[type.headline, { color: colors.ink }]} accessibilityRole="header">Safety</Text>
        <Text style={[type.bodySmall, { color: colors.muted }]}>
          SOS doesn&apos;t alert the rest of your group, only the people you choose.
        </Text>
      </Animated.View>

      {sos ? (
        <Animated.View
          entering={FadeIn.duration(200)}
          accessibilityLiveRegion="assertive"
          style={[styles.card, styles.gap12, { backgroundColor: colors.card, borderColor: colors.danger, borderWidth: 2 }]}
        >
          <Text style={[type.title, { color: colors.danger }]}>SOS raised</Text>
          <Text style={[type.bodySmall, { color: colors.muted }]}>
            {sos.shareUrl
              ? 'Your ride is flagged and a live location link is ready. Call for help or text your contacts.'
              : 'Your SOS is logged. Call for help or text your contacts.'}
          </Text>
          <Button label="Call 112" icon="call" onPress={() => Linking.openURL('tel:112')} />
          <Button
            label={contacts?.length ? `Text ${contacts.length === 1 ? contacts[0].name : `${contacts.length} contacts`}` : 'Add a trusted contact first'}
            variant="ghost"
            icon="sms"
            disabled={!contacts?.length}
            onPress={textContacts}
          />
          <Button label="I'm safe now" variant="text" onPress={() => setSos(null)} />
        </Animated.View>
      ) : (
        <Animated.View entering={FadeInDown.delay(60).duration(280)}>
          <SosButton onTrigger={raiseSos} disabled={busy === 'sos'} />
        </Animated.View>
      )}

      <Animated.View layout={LinearTransition.duration(220)} style={styles.section}>
        <Text style={[type.title, { color: colors.ink }]}>Share your trip</Text>
        {rideId && ride ? (
          <View style={[styles.card, styles.gap12, { backgroundColor: colors.card, borderColor: colors.line }]}>
            <View style={styles.contact}>
              <Pictogram name="share" size={40} tone={ride.sharingTrip ? 'sign' : 'plate'} />
              <View style={styles.flex}>
                <Text style={[type.title, { color: colors.ink }]}>
                  {ride.sharingTrip ? 'Sharing your live trip' : `Ride to ${ride.destination.name}`}
                </Text>
                <Text style={[type.bodySmall, { color: colors.muted }]}>
                  {ride.sharingTrip
                    ? 'Anyone with the link sees where you are until the ride ends. Keep HopShare open.'
                    : 'Send family a link that shows where you are until the ride ends.'}
                </Text>
              </View>
            </View>
            <View style={styles.row}>
              {ride.sharingTrip ? (
                <View style={styles.flex}>
                  <Button label="Stop" variant="ghost" loading={busy === 'stop'} onPress={stopTrip} />
                </View>
              ) : null}
              <View style={styles.flex}>
                <Button
                  label={ride.sharingTrip ? 'Send link' : 'Share live trip'}
                  icon="share"
                  loading={busy === 'share'}
                  onPress={shareTrip}
                />
              </View>
            </View>
          </View>
        ) : (
          <Text style={[type.bodySmall, { color: colors.muted }]}>
            When you&apos;re in a group, you can send family a live link that shows where you are until the ride ends.
          </Text>
        )}
      </Animated.View>

      <Animated.View layout={LinearTransition.duration(220)} style={styles.section}>
        <View style={styles.sectionHead}>
          <Text style={[type.title, { color: colors.ink }]}>Trusted contacts</Text>
          <Text style={[type.body, type.figure, { color: colors.muted }]}>{contacts?.length ?? 0} of 3</Text>
        </View>
        <View style={[styles.card, styles.gap12, { backgroundColor: colors.card, borderColor: colors.line }]}>
          {contacts?.length ? (
            contacts.map((c) => (
              <ContactRow
                key={c.id}
                contact={c}
                onRemove={() =>
                  run(c.id, async () => {
                    await request(`/api/me/contacts/${c.id}`, { method: 'DELETE' });
                    setContacts((all) => all?.filter((x) => x.id !== c.id) ?? null);
                  })
                }
              />
            ))
          ) : contacts ? (
            <Text style={[type.bodySmall, { color: colors.muted }]}>
              Add up to 3 people. SOS opens a text to them with your live location.
            </Text>
          ) : null}

          {adding ? (
            <Animated.View entering={FadeInDown.duration(200)} style={styles.gap12}>
              <TextField label="Name" placeholder="Maa" value={name} onChangeText={setName} autoCapitalize="words" maxLength={40} />
              <TextField
                label="Mobile number"
                placeholder="98765 43210"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoComplete="tel"
                maxLength={16}
              />
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Button label="Cancel" variant="ghost" disabled={busy === 'add'} onPress={() => setAdding(false)} />
                </View>
                <View style={styles.flex}>
                  <Button label="Add" icon="check" loading={busy === 'add'} disabled={!name.trim() || !phone.trim()} onPress={addContact} />
                </View>
              </View>
            </Animated.View>
          ) : (contacts?.length ?? 0) < 3 ? (
            <Button label="Add trusted contact" variant="ghost" icon="person_add" onPress={() => setAdding(true)} />
          ) : null}
        </View>
      </Animated.View>

      {error ? <Text style={[type.body, { color: colors.danger }]}>{error}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { transform: [{ scale: 0.95 }] },
  body: { paddingHorizontal: 20, paddingBottom: 32, gap: 24 },
  gap4: { gap: 4 },
  gap12: { gap: 12 },
  section: { gap: 12 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  card: { borderWidth: 1.5, borderRadius: 12, padding: 16 },
  row: { flexDirection: 'row', gap: 10 },
  contact: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  initial: { width: 40, height: 40, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  initialText: { fontFamily: fonts.extrabold, fontSize: 18, lineHeight: 24 },
  remove: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
