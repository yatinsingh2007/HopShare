import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { TextField } from '@/components/TextField';
import { useTheme } from '@/context/ThemeContext';
import { useMe } from '@/hooks/useMe';
import { payByUpi, rupees } from '@/services/upi';
import { fonts, type } from '@/theme/type';

export type Stage = 'open' | 'booked' | 'picked_up' | 'ended' | 'cancelled' | 'past';
export type FarePayment = {
  id: string;
  userId: string;
  firstName: string;
  amountPaise: number;
  status: 'PENDING' | 'PAID';
  claimedAt: string | null;
  isMe: boolean;
};
export type Fare = {
  farePaise: number;
  riders: number;
  sharePaise: number;
  bookerUpiId: string | null;
  settled: boolean;
  payments: FarePayment[];
};
type Rider = { id: string; firstName: string | null };
/** Returns an error message, or null when it worked. */
type Action = () => Promise<string | null>;

function useAction() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = async (key: string, action: Action) => {
    setBusy(key);
    setError(null);
    const failed = await action();
    setBusy(null);
    setError(failed);
    return !failed;
  };
  return { busy, error, run };
}

function RiderCheck({ rider, checked, onToggle }: { rider: Rider; checked: boolean; onToggle: () => void }) {
  const { colors } = useTheme();
  const name = rider.firstName ?? 'Rider';
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={`${name} rode with you`}
      style={({ pressed }) => [styles.check, pressed && styles.pressed]}
    >
      <View
        style={[
          styles.box,
          { borderColor: checked ? colors.ink : colors.muted, backgroundColor: checked ? colors.accent : 'transparent' },
        ]}
      >
        {checked ? <Icon name="check" size={18} color={colors.accentInk} /> : null}
      </View>
      <Text style={[type.body, styles.flex, { color: checked ? colors.ink : colors.muted }]}>{name}</Text>
      {!checked ? <Text style={[type.bodySmall, { color: colors.muted }]}>Didn&apos;t ride</Text> : null}
    </Pressable>
  );
}

function FareForm({ others, onSave, onCancel }: {
  others: Rider[];
  onSave: (fare: number, riderIds: string[]) => Promise<string | null>;
  onCancel: () => void;
}) {
  const { colors } = useTheme();
  const { me } = useMe();
  const [fare, setFare] = useState('');
  const [rode, setRode] = useState<Set<string>>(() => new Set(others.map((o) => o.id)));
  const { busy, error, run } = useAction();

  const amount = Number(fare.replace(/,/g, ''));
  const valid = Number.isFinite(amount) && amount > 0 && amount <= 20_000;
  const people = rode.size + 1;
  const sharePaise = valid ? Math.floor(Math.round(amount * 100) / people) : 0;
  const noUpi = me !== null && !me.upiId;

  const toggle = (id: string) =>
    setRode((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Animated.View
      entering={FadeInDown.duration(240)}
      style={[styles.card, styles.gap16, { backgroundColor: colors.card, borderColor: colors.ink }]}
    >
      <View style={styles.gap6}>
        <Text style={[type.title, { color: colors.ink }]}>We&apos;ve arrived</Text>
        <Text style={[type.bodySmall, { color: colors.muted }]}>
          Enter what you paid. It&apos;s split evenly between everyone who rode, and they pay you back over UPI.
        </Text>
      </View>

      <TextField
        label="Fare you paid (₹)"
        placeholder="248"
        value={fare}
        onChangeText={setFare}
        keyboardType="decimal-pad"
        maxLength={8}
      />

      {others.length ? (
        <View style={styles.gap6}>
          <Text style={[type.label, { color: colors.ink }]}>Who rode with you?</Text>
          {others.map((o) => (
            <RiderCheck key={o.id} rider={o} checked={rode.has(o.id)} onToggle={() => toggle(o.id)} />
          ))}
        </View>
      ) : null}

      {valid ? (
        <Animated.Text
          entering={FadeIn.duration(160)}
          style={[type.title, type.figure, { color: colors.ink }]}
          accessibilityLiveRegion="polite"
        >
          {rode.size ? `${rupees(sharePaise)} each · ${people} people` : 'Just you, nothing to split'}
        </Animated.Text>
      ) : null}

      {noUpi ? (
        <View style={[styles.notice, { backgroundColor: colors.pill }]}>
          <Text style={[type.bodySmall, styles.flex, { color: colors.ink }]}>
            Add your UPI ID first, so the others can pay you back.
          </Text>
          <Button label="Add UPI ID" variant="text" icon="currency_rupee" onPress={() => router.push('/profile')} />
        </View>
      ) : null}

      {error ? <Text style={[type.body, { color: colors.danger }]}>{error}</Text> : null}

      <View style={styles.row}>
        <View style={styles.flex}>
          <Button label="Cancel" variant="ghost" disabled={!!busy} onPress={onCancel} />
        </View>
        <View style={styles.flex}>
          <Button
            label="Split the fare"
            icon="check"
            loading={!!busy}
            disabled={!valid || noUpi}
            onPress={() => run('save', () => onSave(amount, [...rode]))}
          />
        </View>
      </View>
    </Animated.View>
  );
}

/** The booker's trip buttons: Picked up (ends live location), then We've arrived with the fare. */
export function TripControls({ stage, others, onPickedUp, onFare }: {
  stage: Stage;
  others: Rider[];
  onPickedUp: Action;
  onFare: (fare: number, riderIds: string[]) => Promise<string | null>;
}) {
  const { colors } = useTheme();
  const [arriving, setArriving] = useState(false);
  const { busy, error, run } = useAction();

  if (stage !== 'booked' && stage !== 'picked_up') return null;
  return (
    <Animated.View layout={LinearTransition.duration(200)} style={styles.gap12}>
      <Text style={[type.title, { color: colors.ink }]}>The trip</Text>
      {arriving ? (
        <FareForm others={others} onSave={onFare} onCancel={() => setArriving(false)} />
      ) : (
        <>
          <Text style={[type.body, { color: colors.muted }]}>
            {stage === 'booked'
              ? 'Tap Picked up once everyone is in the cab. Live location stops then.'
              : 'At the drop, enter the fare and HopShare works out everyone’s share.'}
          </Text>
          {error ? <Text style={[type.body, { color: colors.danger }]}>{error}</Text> : null}
          <View style={styles.row}>
            {stage === 'booked' ? (
              <View style={styles.flex}>
                <Button
                  label="Picked up"
                  variant="ghost"
                  icon="how_to_reg"
                  loading={busy === 'pickup'}
                  onPress={() => run('pickup', onPickedUp)}
                />
              </View>
            ) : null}
            <View style={styles.flex}>
              <Button label="We've arrived" icon="location_on" onPress={() => setArriving(true)} />
            </View>
          </View>
        </>
      )}
    </Animated.View>
  );
}

function PaymentRow({ payment, isBooker, busy, onConfirm, index }: {
  payment: FarePayment;
  isBooker: boolean;
  busy: boolean;
  onConfirm: () => void;
  index: number;
}) {
  const { colors } = useTheme();
  const paid = payment.status === 'PAID';
  const label = paid ? 'Paid' : payment.claimedAt ? 'Says paid' : 'Not paid yet';
  return (
    <Animated.View
      entering={FadeInDown.delay(80 + index * 50).duration(240)}
      accessible={!isBooker || paid}
      accessibilityLabel={`${payment.isMe ? 'You' : payment.firstName}, ${rupees(payment.amountPaise)}, ${label}`}
      style={styles.payment}
    >
      <View style={[styles.initial, { backgroundColor: colors.plate }]}>
        <Text style={[styles.initialText, { color: colors.plateInk }]}>{payment.firstName.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.flex}>
        <Text style={[type.title, { color: colors.ink }]} numberOfLines={1}>
          {payment.isMe ? 'You' : payment.firstName}
        </Text>
        <Text style={[type.bodySmall, type.figure, { color: paid ? colors.success : colors.muted }]}>
          {rupees(payment.amountPaise)} · {label}
        </Text>
      </View>
      {paid ? (
        <Icon name="check_circle" size={24} color={colors.success} />
      ) : isBooker ? (
        <View style={styles.confirm}>
          <Button label="Got it" variant={payment.claimedAt ? 'primary' : 'ghost'} loading={busy} onPress={onConfirm} />
        </View>
      ) : null}
    </Animated.View>
  );
}

/** After the ride: the split, each rider's payment, and Pay via UPI for the rider who owes. */
export function FareSummary({ fare, bookerName, isBooker, onClaim, onConfirm }: {
  fare: Fare;
  bookerName: string;
  isBooker: boolean;
  onClaim: (paymentId: string) => Promise<string | null>;
  onConfirm: (paymentId: string) => Promise<string | null>;
}) {
  const { colors } = useTheme();
  const { busy, error, run } = useAction();
  const [copied, setCopied] = useState(false);
  const [noUpiApp, setNoUpiApp] = useState(false);
  const mine = fare.payments.find((p) => p.isMe);
  const paidCount = useMemo(() => fare.payments.filter((p) => p.status === 'PAID').length, [fare.payments]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const pay = async () => {
    if (!mine || !fare.bookerUpiId) return;
    const opened = await payByUpi({
      upiId: fare.bookerUpiId,
      name: bookerName,
      amountPaise: mine.amountPaise,
      note: 'HopShare ride',
    });
    setNoUpiApp(!opened);
  };

  return (
    <Animated.View layout={LinearTransition.duration(200)} style={styles.gap12}>
      <View style={styles.sectionHead}>
        <Text style={[type.title, { color: colors.ink }]}>Fare split</Text>
        {fare.payments.length ? (
          <Text style={[type.body, type.figure, { color: fare.settled ? colors.success : colors.muted }]}>
            {fare.settled ? 'Settled' : `${paidCount} of ${fare.payments.length} paid`}
          </Text>
        ) : null}
      </View>

      <Animated.View
        entering={FadeInDown.duration(260)}
        accessible
        accessibilityLabel={`Fare ${rupees(fare.farePaise)}, ${rupees(fare.sharePaise)} each for ${fare.riders} ${fare.riders === 1 ? 'person' : 'people'}`}
        style={[styles.card, styles.total, { backgroundColor: colors.coach }]}
      >
        <View style={styles.flex}>
          <Text style={[type.bodySmall, { color: 'rgba(255,255,255,0.78)' }]}>
            {fare.riders === 1 ? 'Fare' : `Each of ${fare.riders} pays`}
          </Text>
          <Text style={[type.monument, type.figure, { color: colors.coachInk }]} numberOfLines={1} adjustsFontSizeToFit>
            {rupees(fare.sharePaise)}
          </Text>
        </View>
        <Text style={[type.bodySmall, type.figure, { color: 'rgba(255,255,255,0.78)' }]}>of {rupees(fare.farePaise)}</Text>
      </Animated.View>

      {mine && mine.status === 'PENDING' ? (
        <Animated.View
          entering={FadeInDown.delay(60).duration(260)}
          style={[styles.card, styles.gap12, { backgroundColor: colors.card, borderColor: colors.ink }]}
        >
          <Text style={[type.title, { color: colors.ink }]}>
            {mine.claimedAt ? `Waiting for ${bookerName} to confirm` : `Pay ${bookerName} ${rupees(mine.amountPaise)}`}
          </Text>
          {fare.bookerUpiId ? (
            <>
              {!mine.claimedAt ? <Button label="Pay via UPI" icon="currency_rupee" onPress={pay} /> : null}
              <Pressable
                onPress={async () => {
                  await Clipboard.setStringAsync(fare.bookerUpiId!);
                  setCopied(true);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Copy UPI ID ${fare.bookerUpiId}`}
                style={({ pressed }) => [styles.upi, { borderColor: colors.line }, pressed && styles.pressed]}
              >
                <Text style={[type.body, styles.flex, { color: colors.ink }]} numberOfLines={1}>{fare.bookerUpiId}</Text>
                <Icon name={copied ? 'check' : 'content_copy'} size={20} color={colors.muted} />
              </Pressable>
              {noUpiApp ? (
                <Text style={[type.bodySmall, { color: colors.danger }]}>
                  No UPI app opened. Copy the UPI ID and pay from your UPI app.
                </Text>
              ) : null}
            </>
          ) : null}
          {!mine.claimedAt ? (
            <Button
              label="I've paid"
              variant="ghost"
              icon="check"
              loading={busy === 'claim'}
              onPress={() => run('claim', () => onClaim(mine.id))}
            />
          ) : null}
        </Animated.View>
      ) : null}

      {error ? <Text style={[type.body, { color: colors.danger }]}>{error}</Text> : null}

      {fare.payments.length ? (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.line }]}>
          {fare.payments.map((p, i) => (
            <PaymentRow
              key={p.id}
              payment={p}
              index={i}
              isBooker={isBooker}
              busy={busy === p.id}
              onConfirm={() => run(p.id, () => onConfirm(p.id))}
            />
          ))}
        </View>
      ) : null}

      {isBooker && !fare.settled && fare.payments.length ? (
        <Text style={[type.bodySmall, { color: colors.muted }]}>
          Tap Got it once the money is in your account. A rider&apos;s &quot;I&apos;ve paid&quot; is only a heads-up.
        </Text>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { transform: [{ scale: 0.97 }] },
  card: { borderWidth: 1.5, borderRadius: 12, padding: 16 },
  gap6: { gap: 6 },
  gap12: { gap: 12 },
  gap16: { gap: 16 },
  row: { flexDirection: 'row', gap: 10 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  check: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  box: { width: 26, height: 26, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingLeft: 14, paddingRight: 4, paddingVertical: 4 },
  total: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, borderWidth: 0 },
  upi: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, minHeight: 48 },
  payment: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
  initial: { width: 40, height: 40, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  initialText: { fontFamily: fonts.extrabold, fontSize: 18, lineHeight: 24 },
  confirm: { minWidth: 104 },
});
