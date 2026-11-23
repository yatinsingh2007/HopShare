import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { useMe } from '@/hooks/useMe';
import { ApiError } from '@/services/api';
import { useTheme } from '@/context/ThemeContext';
import { type } from '@/theme/type';

/** One question after sign-up, only for riders we have no name for. */
export default function ProfileSetup() {
  const { colors } = useTheme();
  const { update } = useMe();
  const [firstName, setFirstName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await update({ firstName: firstName.trim() });
      router.replace('/home');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Text style={[type.headline, styles.heading, { color: colors.ink }]}>What should riders call you?</Text>
      <TextField
        label="First name"
        helper="Only your first name is shown to other riders."
        value={firstName}
        onChangeText={setFirstName}
        autoComplete="given-name"
        autoCapitalize="words"
        autoFocus
        returnKeyType="done"
        onSubmitEditing={() => firstName.trim() && !saving && save()}
        error={error}
      />
      <Button label="Continue" onPress={save} loading={saving} disabled={!firstName.trim()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { marginTop: 12 },
});
