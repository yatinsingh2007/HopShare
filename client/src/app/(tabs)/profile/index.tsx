import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AndroidSymbol } from 'expo-symbols';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Pictogram } from '@/components/Pictogram';
import NotificationWrapper from '@/components/Notification';
import { Bone, SkeletonCard } from '@/components/Skeleton';
import { TextField } from '@/components/TextField';
import { useSession } from '@/context/AuthContext';
import { useTheme, type ThemePreference } from '@/context/ThemeContext';
import { useMe, type ProfilePatch } from '@/hooks/useMe';
import { ApiError } from '@/services/api';
import { fonts, type } from '@/theme/type';

type Field = 'firstName' | 'upiId';

const THEMES: { value: ThemePreference; label: string; icon: AndroidSymbol }[] = [
  { value: 'system', label: 'System', icon: 'contrast' },
  { value: 'light', label: 'Light', icon: 'light_mode' },
  { value: 'dark', label: 'Dark', icon: 'dark_mode' },
];

const UPI_ID = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9]{2,64}$/;

// A row that shows a value and turns into a text field in place when tapped.
function EditableRow({
  icon,
  label,
  value,
  empty,
  helper,
  editing,
  onEdit,
  onCancel,
  onSave,
  validate,
  inputProps,
  last,
}: {
  icon: AndroidSymbol;
  label: string;
  value: string | null;
  empty: string;
  helper: string;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (next: string) => Promise<void>;
  validate: (next: string) => string | null;
  inputProps: Partial<React.ComponentProps<typeof TextField>>;
  last?: boolean;
}) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState(value ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const next = draft.trim();
    const problem = validate(next);
    if (problem) return setError(problem);
    setSaving(true);
    setError(null);
    try {
      await onSave(next);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const border = last ? null : { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line };

  if (editing) {
    return (
      <Animated.View entering={FadeIn.duration(180)} style={[styles.editing, border]}>
        <TextField
          label={label}
          helper={helper}
          error={error}
          value={draft}
          onChangeText={(t) => {
            setDraft(t);
            setError(null);
          }}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={save}
          {...inputProps}
        />
        <View style={styles.editActions}>
          <View style={styles.flex}>
            <Button label="Cancel" variant="ghost" onPress={onCancel} disabled={saving} />
          </View>
          <View style={styles.flex}>
            <Button label="Save" onPress={save} loading={saving} />
          </View>
        </View>
      </Animated.View>
    );
  }

  return (
    <Pressable
      onPress={() => {
        setDraft(value ?? '');
        setError(null);
        onEdit();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value || empty}. Edit`}
      android_ripple={{ color: colors.line }}
      style={[styles.row, border]}
    >
      <Pictogram name={icon} size={36} />
      <View style={styles.flex}>
        <Text style={[type.meta, { color: colors.muted }]}>{label}</Text>
        <Text style={[type.title, { color: colors.ink }, !value && styles.underline]} numberOfLines={1}>
          {value || empty}
        </Text>
      </View>
      <Icon name={value ? 'edit' : 'add'} size={22} color={colors.ink} />
    </Pressable>
  );
}

function ThemePicker() {
  const { colors, preference, setPreference } = useTheme();
  return (
    <View style={[styles.segments, { backgroundColor: colors.field, borderColor: colors.line }]} accessibilityRole="radiogroup">
      {THEMES.map(({ value, label, icon }) => {
        const selected = preference === value;
        return (
          <Pressable
            key={value}
            onPress={() => setPreference(value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`${label} theme`}
            style={({ pressed }) => [
              styles.segment,
              selected && { backgroundColor: colors.accent },
              pressed && !selected && { backgroundColor: colors.line },
            ]}
          >
            <Icon name={icon} size={18} color={selected ? colors.accentInk : colors.muted} />
            <Text style={[type.label, { color: selected ? colors.accentInk : colors.ink }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function Profile() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { me, loading, error, update } = useMe();
  const { signOut } = useSession();
  const [editing, setEditing] = useState<Field | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const save = (patch: ProfilePatch) => update(patch).then(() => setEditing(null));

  const confirmSignOut = () =>
    Alert.alert('Sign out?', 'You can sign back in any time with your email and password.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          await signOut().finally(() => setSigningOut(false));
        },
      },
    ]);

  if (loading && !me) {
    return (
      <View style={[styles.flex, styles.body, { backgroundColor: colors.bg, paddingTop: insets.top + 16 }]}>
        <View style={styles.hero} accessible accessibilityLabel="Loading your profile">
          <Bone width={68} height={68} radius={12} />
          <View style={[styles.flex, styles.skeletonLines]}>
            <Bone width="55%" height={28} />
            <Bone width="70%" height={14} />
          </View>
        </View>
        <SkeletonCard style={styles.skeletonCard}>
          <Bone width="40%" height={14} />
          <Bone width="80%" height={18} />
          <Bone width="40%" height={14} />
          <Bone width="65%" height={18} />
        </SkeletonCard>
      </View>
    );
  }

  const initial = (me?.firstName ?? me?.email ?? '?').trim().charAt(0).toUpperCase();

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.body, { paddingTop: insets.top + 16 }]}
      keyboardShouldPersistTaps="handled"
    >
      <Animated.View entering={FadeInDown.duration(280)} style={styles.hero}>
        <View style={[styles.avatar, { backgroundColor: colors.accent }]} importantForAccessibility="no-hide-descendants">
          <Text style={[styles.avatarText, { color: colors.accentInk }]}>{initial}</Text>
        </View>
        <View style={styles.flex}>
          <Text style={[type.headline, { color: colors.ink }]} numberOfLines={1} accessibilityRole="header">
            {me?.firstName ?? 'Your profile'}
          </Text>
          {me?.email ? (
            <Text style={[type.bodySmall, { color: colors.muted }]} numberOfLines={1}>{me.email}</Text>
          ) : null}
        </View>
      </Animated.View>

      {error ? <Text style={[type.bodySmall, { color: colors.danger }]}>{error}</Text> : null}

      {me ? (
        <Animated.View entering={FadeInDown.delay(60).duration(280)} layout={LinearTransition.duration(220)} style={styles.section}>
          <Text style={[type.title, { color: colors.ink }]}>Your details</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.line }]}>
            <EditableRow
              icon="person"
              label="First name"
              value={me.firstName}
              empty="Add your first name"
              helper="Only your first name is shown to other riders."
              editing={editing === 'firstName'}
              onEdit={() => setEditing('firstName')}
              onCancel={() => setEditing(null)}
              onSave={(firstName) => save({ firstName })}
              validate={(v) => (!v ? 'Please enter a first name.' : v.length > 50 ? 'Keep it under 50 characters.' : null)}
              inputProps={{ autoCapitalize: 'words', autoComplete: 'given-name', maxLength: 50 }}
            />
            <EditableRow
              icon="currency_rupee"
              label="UPI ID"
              value={me.upiId}
              empty="Add UPI ID"
              helper="When you book the cab, riders pay you back here. Leave it empty to remove it."
              editing={editing === 'upiId'}
              onEdit={() => setEditing('upiId')}
              onCancel={() => setEditing(null)}
              onSave={(upiId) => save({ upiId })}
              validate={(v) => (v && !UPI_ID.test(v) ? "That doesn't look like a UPI ID. It looks like name@bank." : null)}
              inputProps={{ autoCapitalize: 'none', autoCorrect: false, keyboardType: 'email-address', placeholder: 'name@okhdfc' }}
              last
            />
          </View>
        </Animated.View>
      ) : null}

      <Animated.View entering={FadeInDown.delay(120).duration(280)} layout={LinearTransition.duration(220)} style={styles.section}>
        <Text style={[type.title, { color: colors.ink }]}>Appearance</Text>
        <ThemePicker />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(180).duration(280)} layout={LinearTransition.duration(220)} style={styles.section}>
        <Text style={[type.title, { color: colors.ink }]}>Notifications</Text>
        <NotificationWrapper />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(240).duration(280)} layout={LinearTransition.duration(220)} style={styles.section}>
        <Button label="Sign out" icon="logout" variant="ghost" onPress={confirmSignOut} loading={signingOut} />
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 20, paddingBottom: 32, gap: 28 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: { width: 68, height: 68, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.extrabold, fontSize: 28 },
  section: { gap: 12 },
  card: { borderWidth: 1.5, borderRadius: 12, overflow: 'hidden' },
  underline: { textDecorationLine: 'underline' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 68, paddingHorizontal: 16 },
  editing: { padding: 16, gap: 14 },
  editActions: { flexDirection: 'row', gap: 10 },
  skeletonLines: { gap: 8 },
  skeletonCard: { gap: 10, padding: 16 },
  segments: { flexDirection: 'row', borderWidth: 1.5, borderRadius: 12, padding: 4, gap: 4 },
  segment: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 48, borderRadius: 8 },
});
