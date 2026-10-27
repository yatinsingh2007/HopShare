import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSignIn, useSignUp, useSSO } from '@clerk/expo';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { useTheme } from '@/theme/ThemeProvider';

type ClerkResultError = { code?: string; errors?: { code?: string }[] } | null;

const hasCode = (error: ClerkResultError, code: string) =>
  !!error && (error.code === code || !!error.errors?.some((e) => e.code === code));

const GENERIC_ERROR = 'Something went wrong. Please try again.';

export default function SignIn() {
  const { colors } = useTheme();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const { startSSOFlow } = useSSO();

  const [digits, setDigits] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [flow, setFlow] = useState<'signIn' | 'signUp'>('signIn');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const phoneNumber = `+91${digits}`;

  const sendCode = async () => {
    setBusy(true);
    setError(null);
    try {
      const { error: signInError } = await signIn.phoneCode.sendCode({ phoneNumber });
      if (!signInError) {
        setFlow('signIn');
        setStep('code');
        return;
      }
      if (!hasCode(signInError, 'form_identifier_not_found')) {
        setError(GENERIC_ERROR);
        return;
      }
      const created = await signUp.create({ phoneNumber });
      const sent = created.error ? created : await signUp.verifications.sendPhoneCode();
      if (sent.error) {
        setError(GENERIC_ERROR);
        return;
      }
      setFlow('signUp');
      setStep('code');
    } catch {
      setError(GENERIC_ERROR);
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    setError(null);
    try {
      const resource = flow === 'signIn' ? signIn : signUp;
      const { error: verifyError } =
        flow === 'signIn'
          ? await signIn.phoneCode.verifyCode({ code })
          : await signUp.verifications.verifyPhoneCode({ code });
      if (verifyError) {
        setError(
          hasCode(verifyError, 'form_code_incorrect') ? "That code didn't match. Try again." : GENERIC_ERROR,
        );
        return;
      }
      const { error: finalizeError } = await resource.finalize();
      if (finalizeError) setError(GENERIC_ERROR);
    } catch {
      setError(GENERIC_ERROR);
    } finally {
      setBusy(false);
    }
  };

  const continueWithGoogle = async () => {
    setError(null);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({ strategy: 'oauth_google' });
      if (createdSessionId && setActive) await setActive({ session: createdSessionId });
    } catch {
      setError(GENERIC_ERROR);
    }
  };

  if (step === 'code') {
    return (
      <Screen>
        <Text style={[styles.heading, { color: colors.ink }]}>Enter the 6-digit code</Text>
        <Text style={[styles.helper, { color: colors.muted }]}>Sent to {phoneNumber}</Text>
        <TextField
          label="6-digit code"
          value={code}
          onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          autoComplete="sms-otp"
          textContentType="oneTimeCode"
          error={error}
        />
        <Button label="Verify" onPress={verify} loading={busy} disabled={code.length !== 6} />
        <Button label="Use a different number" variant="ghost" onPress={() => setStep('phone')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={[styles.heading, { color: colors.ink }]}>{"What's your number?"}</Text>
      <Text style={[styles.helper, { color: colors.muted }]}>
        {"We'll text a 6-digit code. Your number is never shown to other riders."}
      </Text>
      <TextField
        label="Phone number"
        prefix="+91"
        value={digits}
        onChangeText={(t) => setDigits(t.replace(/\D/g, '').slice(0, 10))}
        keyboardType="phone-pad"
        autoComplete="tel"
        placeholder="98765 43210"
        error={error}
      />
      <Button label="Send code" onPress={sendCode} loading={busy} disabled={digits.length !== 10} />
      <View style={styles.divider}>
        <Text style={[styles.helper, { color: colors.muted }]}>or</Text>
      </View>
      <Button label="Continue with Google" variant="ghost" onPress={continueWithGoogle} />
      <View style={{ flex: 1 }} />
      <Button label="Back" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginTop: 12 },
  helper: { fontSize: 15, lineHeight: 21 },
  divider: { alignItems: 'center' },
});
