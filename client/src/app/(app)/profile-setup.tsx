import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { useMeContext } from '@/context/MeContext';
import { ApiError } from '@/services/api';
import { useTheme } from '@/theme/ThemeProvider';

export default function ProfileSetup() {
  const { colors } = useTheme();
  const { me, update } = useMeContext();
  const [firstName, setFirstName] = useState(me?.firstName ?? '');
  const [upiId, setUpiId] = useState(me?.upiId ?? '');
  const [upiError, setUpiError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    setUpiError(null);
    setFormError(null);
    try {
      await update({ firstName, upiId });
      router.replace('/');
    } catch (e) {
      const message = e instanceof ApiError ? e.message : 'Something went wrong. Please try again.';
      if (message.includes('UPI')) setUpiError(message);
      else setFormError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Text style={[styles.heading, { color: colors.ink }]}>What should riders call you?</Text>
      <TextField
        label="First name"
        helper="Only your first name is shown to other riders."
        value={firstName}
        onChangeText={setFirstName}
        autoComplete="given-name"
        autoCapitalize="words"
      />
      <TextField
        label="Your UPI ID"
        helper="So riders can pay you back when you book the cab."
        placeholder="name@bank"
        value={upiId}
        onChangeText={setUpiId}
        autoCapitalize="none"
        autoCorrect={false}
        error={upiError}
      />
      <Button label="Continue" onPress={save} loading={saving} disabled={!firstName.trim() || !upiId.trim()} />
      {formError ? <Text style={[styles.error, { color: colors.danger }]}>{formError}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginTop: 12 },
  error: { fontSize: 14 },
});
