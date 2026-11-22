import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Button } from '@/components/Button';
import { Pictogram } from '@/components/Pictogram';
import { clock, groupCode } from '@/components/RideCard';
import { useTheme } from '@/context/ThemeContext';
import type { MyRequest } from '@/hooks/useMyRequests';
import { type } from '@/theme/type';

/** One of my asks to join that's still waiting, with Withdraw. */
export function RequestRow({ req, onWithdraw }: { req: MyRequest; onWithdraw: () => void | Promise<void> }) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  return (
    <Animated.View
      entering={FadeInDown.duration(240)}
      style={[styles.request, { backgroundColor: colors.card, borderColor: colors.line }]}
    >
      <Pictogram name="hourglass_top" size={40} tone="sign" />
      <View style={styles.flex}>
        <Text style={[type.title, type.figure, { color: colors.ink }]} numberOfLines={1}>
          {groupCode(req.rideId)} · leaves {clock(req.leaveAt)}
        </Text>
        <Text style={[type.bodySmall, { color: colors.muted }]} numberOfLines={2}>
          to {req.destinationName} · waiting for {req.creatorName ?? 'the group'} to accept
        </Text>
      </View>
      <Button
        label="Withdraw"
        variant="text"
        loading={busy}
        onPress={() => {
          setBusy(true);
          Promise.resolve(onWithdraw()).finally(() => setBusy(false));
        }}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  request: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderRadius: 12, paddingLeft: 12, paddingVertical: 10 },
});
