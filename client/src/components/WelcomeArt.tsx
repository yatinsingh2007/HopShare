import { StyleSheet, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/context/ThemeContext';

/** Small figures for the welcome slides. Decorative: the slide text carries the meaning. */

const SIZE = 220;

function Person({ size, filled }: { size: number; filled?: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: filled ? colors.accent : colors.pill,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name="person" size={size * 0.5} color={filled ? colors.accentInk : colors.accentText} />
    </View>
  );
}

/** Cost: one fare, cut into four quarters; yours is lit. */
export function SplitArt() {
  const { colors } = useTheme();
  const r = SIZE / 2;
  const q = (SIZE - 10) / 2;
  const corners = [
    { borderTopLeftRadius: r },
    { borderTopRightRadius: r },
    { borderBottomLeftRadius: r },
    { borderBottomRightRadius: r },
  ];
  return (
    <View style={styles.box}>
      <View style={[styles.quarters, { width: SIZE, height: SIZE }]}>
        {corners.map((c, i) => {
          const you = i === 3;
          return (
            <View
              key={i}
              style={[
                { width: q, height: q, backgroundColor: you ? colors.accent : colors.pill, alignItems: 'center', justifyContent: 'center' },
                c,
              ]}
            >
              <Icon name="person" size={30} color={you ? colors.accentInk : colors.accentText} />
            </View>
          );
        })}
      </View>
      <View style={[styles.coin, { backgroundColor: colors.card, borderColor: colors.line }]}>
        <Icon name="currency_rupee" size={26} color={colors.ink} />
      </View>
    </View>
  );
}

/** Safety: four checked riders around one shared live location. */
export function VerifiedArt() {
  const { colors } = useTheme();
  const spots = [
    { top: 0, left: SIZE / 2 - 30 },
    { top: SIZE / 2 - 30, right: 0 },
    { bottom: 0, left: SIZE / 2 - 30 },
    { top: SIZE / 2 - 30, left: 0 },
  ];
  return (
    <View style={styles.box}>
      <View style={{ width: SIZE, height: SIZE }}>
        <View style={[styles.ring, { width: 150, height: 150, borderRadius: 75, borderColor: colors.line }]} />
        <View style={[styles.ring, { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.pill, borderColor: 'transparent' }]} />
        <View style={[styles.ring, { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent, borderColor: 'transparent' }]}>
          <Icon name="location_on" size={24} color={colors.accentInk} />
        </View>
        {spots.map((s, i) => (
          <View key={i} style={[styles.spot, s]}>
            <View style={[styles.avatarFrame, { backgroundColor: colors.bg }]}>
              <Person size={52} />
            </View>
            <View style={[styles.badge, { backgroundColor: colors.bg }]}>
              <Icon name="verified" size={20} color={colors.accentText} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Effort: three riders send their share to the one who booked. */
export function PaybackArt() {
  const { colors } = useTheme();
  return (
    <View style={styles.box}>
      <View style={styles.payback}>
        <View style={{ gap: 14 }}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.payRow}>
              <Person size={44} />
              <View style={[styles.chip, { backgroundColor: colors.card, borderColor: colors.line }]}>
                <Icon name="currency_rupee" size={14} color={colors.ink} />
                <Icon name="arrow_forward" size={14} color={colors.muted} />
              </View>
            </View>
          ))}
        </View>
        <View style={{ alignItems: 'center', gap: 10 }}>
          <Person size={88} filled />
          <View style={[styles.tag, { backgroundColor: colors.pill }]}>
            <Icon name="directions_car" size={16} color={colors.accentText} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { height: SIZE + 30, alignItems: 'center', justifyContent: 'center' },
  quarters: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  coin: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    alignSelf: 'center',
    top: '50%',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateY: '-50%' }],
  },
  spot: { position: 'absolute', width: 60, height: 60 },
  avatarFrame: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', right: -2, bottom: -2, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  payback: { flexDirection: 'row', alignItems: 'center', gap: 22 },
  payRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 2, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, height: 30 },
  tag: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
});
