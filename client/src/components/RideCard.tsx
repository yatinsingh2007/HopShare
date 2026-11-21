import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { router } from 'expo-router';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/context/ThemeContext';
import type { MyRide } from '@/hooks/useMyRides';
import { type } from '@/theme/type';

const SEATS = 4;

/** A short, stable code for a group (like a coach number), so riders can say "I'm in G4". */
export const groupCode = (id: string) => `G${(parseInt(id.replace(/-/g, '').slice(0, 6), 16) % 89) + 10}`;

export const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

const dayLabel = (iso: string) => {
  const d = new Date(iso);
  return new Date().toDateString() === d.toDateString()
    ? 'Today'
    : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

/** Four seats: taken ones filled, open ones dashed. Used on every group surface. */
export function SeatStrip({ members, onDark }: { members: number; onDark?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={styles.seats} importantForAccessibility="no-hide-descendants">
      {Array.from({ length: SEATS }, (_, i) => {
        const taken = i < members;
        return (
          <View
            key={i}
            style={[
              styles.seat,
              taken
                ? { backgroundColor: onDark ? colors.accent : colors.ink }
                : { borderWidth: 1.5, borderStyle: 'dashed', borderColor: onDark ? 'rgba(255,255,255,0.6)' : colors.muted },
            ]}
          />
        );
      })}
    </View>
  );
}

export function RideCard({ ride, index = 0 }: { ride: MyRide; index?: number }) {
  const { colors } = useTheme();
  const live = ride.live;
  const fg = live ? colors.coachInk : colors.ink;
  const soft = live ? 'rgba(255,255,255,0.78)' : colors.muted;
  const code = groupCode(ride.id);

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(260)}>
      <Pressable
        onPress={() => router.push({ pathname: '/ride/[id]', params: { id: ride.id } })}
        accessibilityRole="button"
        accessibilityLabel={`${live ? 'Live' : 'Past'} ride ${code}, ${ride.isCreator ? 'you started it' : 'you joined'}. ${ride.pickupName} to ${ride.destinationName}, ${dayLabel(ride.leaveAt)} ${clock(ride.leaveAt)}. ${ride.members} of ${SEATS} riders. Open`}
        android_ripple={{ color: live ? 'rgba(255,255,255,0.12)' : colors.line }}
        style={({ pressed }) => [
          styles.card,
          live
            ? { backgroundColor: colors.coach }
            : { backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.line },
          pressed && styles.pressed,
        ]}
      >
        <View style={[styles.code, { backgroundColor: live ? 'rgba(0,0,0,0.22)' : colors.bg }]}>
          <Text style={[styles.codeText, { color: live ? colors.accent : colors.ink }]}>{code}</Text>
          <Text style={[type.meta, { color: soft }]}>{live ? 'LIVE' : 'PAST'}</Text>
        </View>

        <View style={styles.flex}>
          <View style={styles.timeRow}>
            <Text style={[type.headline, type.figure, { color: fg }]}>{clock(ride.leaveAt)}</Text>
            <Text style={[type.bodySmall, { color: soft }]}>{dayLabel(ride.leaveAt)}</Text>
          </View>
          <Text style={[type.title, { color: fg }]} numberOfLines={1}>
            to {ride.destinationName}
          </Text>
          <Text style={[type.bodySmall, { color: soft }]} numberOfLines={1}>
            from {ride.pickupName}
          </Text>
          <View style={styles.foot}>
            <SeatStrip members={ride.members} onDark={live} />
            <Text style={[type.bodySmall, type.figure, { color: soft }]}>
              {ride.members} of {SEATS}
              {live && ride.seatsLeft > 0 ? ` · waiting for ${ride.seatsLeft}` : ''}
            </Text>
          </View>
        </View>

        <Icon name="chevron_right" size={24} color={soft} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 12, padding: 14, overflow: 'hidden' },
  pressed: { transform: [{ scale: 0.985 }] },
  code: { width: 64, alignSelf: 'stretch', borderRadius: 6, alignItems: 'center', justifyContent: 'center', gap: 2 },
  codeText: { ...type.display, fontSize: 26, lineHeight: 30, letterSpacing: -0.5 },
  timeRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  seats: { flexDirection: 'row', gap: 4 },
  seat: { width: 16, height: 10, borderRadius: 2 },
});
