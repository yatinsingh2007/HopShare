import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Pictogram } from '@/components/Pictogram';
import { Bone, SkeletonCard } from '@/components/Skeleton';
import { useTheme } from '@/context/ThemeContext';
import { useMyPayments, type Owe, type Owed } from '@/hooks/useMyPayments';
import { payByUpi, rupees } from '@/services/upi';
import { fonts, type } from '@/theme/type';

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '';

function Total({ label, paise, tone }: { label: string; paise: number; tone: 'owe' | 'owed' }) {
  const { colors } = useTheme();
  const dark = tone === 'owe' && paise > 0;
  return (
    <View
      accessible
      accessibilityLabel={`${label} ${rupees(paise)}`}
      style={[
        styles.total,
        dark ? { backgroundColor: colors.coach } : { backgroundColor: colors.card, borderColor: colors.line, borderWidth: 1.5 },
      ]}
    >
      <Text style={[type.bodySmall, { color: dark ? 'rgba(255,255,255,0.78)' : colors.muted }]}>{label}</Text>
      <Text
        style={[type.display, type.figure, { color: dark ? colors.coachInk : colors.ink }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {rupees(paise)}
      </Text>
    </View>
  );
}

function Who({ name }: { name: string | null }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.initial, { backgroundColor: colors.plate }]}>
      <Text style={[styles.initialText, { color: colors.plateInk }]}>{(name ?? 'R').charAt(0).toUpperCase()}</Text>
    </View>
  );
}

function ToPay({ p, index, onClaim }: { p: Owe; index: number; onClaim: () => Promise<string | null> }) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const name = p.toName ?? 'the booker';

  const pay = async () => {
    if (!p.toUpiId) return;
    const opened = await payByUpi({ upiId: p.toUpiId, name, amountPaise: p.amountPaise, note: 'HopShare ride' });
    if (!opened) setError('No UPI app opened. Copy the UPI ID and pay from your UPI app.');
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 50).duration(240)}
      style={[styles.card, styles.gap12, { backgroundColor: colors.card, borderColor: p.claimedAt ? colors.line : colors.ink }]}
    >
      <View style={styles.row}>
        <Who name={p.toName} />
        <View style={styles.flex}>
          <Text style={[type.title, type.figure, { color: colors.ink }]} numberOfLines={1}>
            {p.claimedAt ? `Waiting for ${name}` : `Pay ${name} ${rupees(p.amountPaise)}`}
          </Text>
          <Text style={[type.bodySmall, { color: colors.muted }]} numberOfLines={1}>
            {p.claimedAt ? `${rupees(p.amountPaise)} · you said paid` : `to ${p.destinationName} · ${when(p.endedAt)}`}
          </Text>
        </View>
        <Pressable
          onPress={() => router.push({ pathname: '/ride/[id]', params: { id: p.rideId } })}
          accessibilityRole="button"
          accessibilityLabel="Open the ride"
          hitSlop={8}
        >
          <Icon name="chevron_right" size={24} color={colors.muted} />
        </Pressable>
      </View>
      {!p.claimedAt ? (
        <>
          {p.toUpiId ? (
            <View style={styles.row}>
              <View style={styles.flex}>
                <Button label="Pay via UPI" icon="currency_rupee" onPress={pay} />
              </View>
              <Pressable
                onPress={async () => {
                  await Clipboard.setStringAsync(p.toUpiId!);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Copy UPI ID ${p.toUpiId}`}
                style={({ pressed }) => [styles.copy, { borderColor: colors.ink }, pressed && styles.pressed]}
              >
                <Icon name={copied ? 'check' : 'content_copy'} size={20} color={colors.ink} />
              </Pressable>
            </View>
          ) : null}
          <Button
            label="I've paid"
            variant="ghost"
            icon="check"
            loading={busy}
            onPress={async () => {
              setBusy(true);
              setError(await onClaim());
              setBusy(false);
            }}
          />
        </>
      ) : null}
      {error ? <Text style={[type.bodySmall, { color: colors.danger }]}>{error}</Text> : null}
    </Animated.View>
  );
}

function ToCollect({ p, index, onConfirm }: { p: Owed; index: number; onConfirm: () => Promise<string | null> }) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(240)} style={styles.gap6}>
      <View style={[styles.row, styles.line]}>
        <Who name={p.fromName} />
        <View style={styles.flex}>
          <Text style={[type.title, type.figure, { color: colors.ink }]} numberOfLines={1}>
            {p.fromName ?? 'Rider'} · {rupees(p.amountPaise)}
          </Text>
          <Text style={[type.bodySmall, { color: p.claimedAt ? colors.accentText : colors.muted }]} numberOfLines={1}>
            {p.claimedAt ? 'Says paid. Check your UPI app' : `Not paid yet · to ${p.destinationName}`}
          </Text>
        </View>
        <View style={styles.confirm}>
          <Button
            label="Got it"
            variant={p.claimedAt ? 'primary' : 'ghost'}
            loading={busy}
            onPress={async () => {
              setBusy(true);
              setError(await onConfirm());
              setBusy(false);
            }}
          />
        </View>
      </View>
      {error ? <Text style={[type.bodySmall, { color: colors.danger }]}>{error}</Text> : null}
    </Animated.View>
  );
}

/** Payments tab: what I owe, what I'm owed, and what's settled. HopShare never holds the money. */
export default function Payments() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { data, error, reload, act } = useMyPayments();
  const [refreshing, setRefreshing] = useState(false);

  const toPay = data?.owe.filter((p) => p.status === 'PENDING') ?? [];
  const toCollect = data?.owed.filter((p) => p.status === 'PENDING') ?? [];
  const settled = [
    ...(data?.owe.filter((p) => p.status === 'PAID').map((p) => ({ ...p, text: `You paid ${p.toName ?? 'the booker'}` })) ?? []),
    ...(data?.owed.filter((p) => p.status === 'PAID').map((p) => ({ ...p, text: `${p.fromName ?? 'A rider'} paid you` })) ?? []),
  ].sort((a, b) => (b.endedAt ?? '').localeCompare(a.endedAt ?? ''));
  const sum = (list: { amountPaise: number }[]) => list.reduce((n, p) => n + p.amountPaise, 0);

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.body, { paddingTop: insets.top + 16 }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await reload();
            setRefreshing(false);
          }}
          tintColor={colors.ink}
          colors={[colors.accentInk]}
          progressBackgroundColor={colors.accent}
        />
      }
    >
      <Animated.View entering={FadeInDown.duration(260)} style={styles.gap4}>
        <Text style={[type.headline, { color: colors.ink }]} accessibilityRole="header">Payments</Text>
        <Text style={[type.bodySmall, { color: colors.muted }]}>
          You pay each other over UPI. HopShare only keeps track.
        </Text>
      </Animated.View>

      {error ? <Text style={[type.bodySmall, { color: colors.danger }]}>{error}</Text> : null}

      {data === null ? (
        <>
          <View style={styles.totals}>
            <View style={styles.flex}><Bone height={92} radius={12} /></View>
            <View style={styles.flex}><Bone height={92} radius={12} /></View>
          </View>
          <SkeletonCard>
            <Bone width="60%" height={18} />
            <Bone height={48} radius={12} />
          </SkeletonCard>
        </>
      ) : (
        <>
          <Animated.View entering={FadeInDown.delay(40).duration(260)} style={styles.totals}>
            <View style={styles.flex}><Total label="You owe" paise={sum(toPay)} tone="owe" /></View>
            <View style={styles.flex}><Total label="Owed to you" paise={sum(toCollect)} tone="owed" /></View>
          </Animated.View>

          {toPay.length ? (
            <Animated.View layout={LinearTransition.duration(220)} style={styles.section}>
              <Text style={[type.title, { color: colors.ink }]}>To pay</Text>
              {toPay.map((p, i) => (
                <ToPay key={p.id} p={p} index={i} onClaim={() => act(p, 'claim')} />
              ))}
            </Animated.View>
          ) : null}

          {toCollect.length ? (
            <Animated.View layout={LinearTransition.duration(220)} style={styles.section}>
              <Text style={[type.title, { color: colors.ink }]}>To collect</Text>
              <View style={[styles.card, styles.gap12, { backgroundColor: colors.card, borderColor: colors.line }]}>
                {toCollect.map((p, i) => (
                  <ToCollect key={p.id} p={p} index={i} onConfirm={() => act(p, 'confirm')} />
                ))}
              </View>
              <Text style={[type.bodySmall, { color: colors.muted }]}>
                Tap Got it once the money is in your account.
              </Text>
            </Animated.View>
          ) : null}

          {!toPay.length && !toCollect.length ? (
            <Animated.View entering={FadeInDown.delay(80).duration(260)} style={[styles.empty, { borderColor: colors.line }]}>
              <Pictogram name="currency_rupee" size={36} />
              <Text style={[type.bodySmall, styles.flex, { color: colors.muted }]}>
                {settled.length
                  ? 'All square. Nothing to pay or collect.'
                  : 'After a shared ride, the fare split shows up here: who pays whom, and who has paid.'}
              </Text>
            </Animated.View>
          ) : null}

          {settled.length ? (
            <Animated.View layout={LinearTransition.duration(220)} style={styles.section}>
              <Text style={[type.title, { color: colors.ink }]}>Settled</Text>
              <View style={[styles.card, styles.gap12, { backgroundColor: colors.card, borderColor: colors.line }]}>
                {settled.slice(0, 20).map((p) => (
                  <View key={p.id} style={styles.row} accessible accessibilityLabel={`${p.text} ${rupees(p.amountPaise)}, ${p.destinationName}`}>
                    <Icon name="check_circle" size={22} color={colors.success} />
                    <View style={styles.flex}>
                      <Text style={[type.body, { color: colors.ink }]} numberOfLines={1}>{p.text}</Text>
                      <Text style={[type.bodySmall, { color: colors.muted }]} numberOfLines={1}>
                        to {p.destinationName} · {when(p.endedAt)}
                      </Text>
                    </View>
                    <Text style={[type.title, type.figure, { color: colors.ink }]}>{rupees(p.amountPaise)}</Text>
                  </View>
                ))}
              </View>
            </Animated.View>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { transform: [{ scale: 0.97 }] },
  body: { paddingHorizontal: 20, paddingBottom: 32, gap: 24 },
  gap4: { gap: 4 },
  gap6: { gap: 6 },
  gap12: { gap: 12 },
  section: { gap: 12 },
  totals: { flexDirection: 'row', gap: 12 },
  total: { borderRadius: 12, padding: 16, gap: 2, minHeight: 92, justifyContent: 'flex-end' },
  card: { borderWidth: 1.5, borderRadius: 12, padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  line: { minHeight: 56 },
  initial: { width: 40, height: 40, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  initialText: { fontFamily: fonts.extrabold, fontSize: 18, lineHeight: 24 },
  copy: { width: 56, height: 56, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  confirm: { minWidth: 104 },
  empty: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 12, padding: 16 },
});
