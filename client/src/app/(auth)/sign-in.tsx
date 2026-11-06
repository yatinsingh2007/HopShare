import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSignIn, useSignUp, useSSO } from '@clerk/expo';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { CodeField } from '@/components/CodeField';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/context/ThemeContext';
import { type } from '@/theme/type';

type ClerkResultError = { code?: string; errors?: { code?: string }[] } | null;

const hasCode = (error: ClerkResultError, code: string) =>
  !!error && (error.code === code || !!error.errors?.some((e) => e.code === code));

const GENERIC_ERROR = 'Something went wrong. Please try again.';
const RESEND_SECONDS = 30;

const COPY = {
  signup: {
    title: 'Start with your email',
    body: "We'll email you a 6-digit code. No password to remember.",
    switchPrompt: 'Already have an account?',
    switchLabel: 'Log in',
    switchTo: 'login',
  },
  login: {
    title: 'Welcome back',
    body: "Enter the email you signed up with and we'll send you a code.",
    switchPrompt: 'New to HopShare?',
    switchLabel: 'Create an account',
    switchTo: 'signup',
  },
} as const;

const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);

function BackButton({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Back"
      android_ripple={{ color: colors.line, borderless: true, radius: 24 }}
      style={styles.back}
    >
      <Icon name="arrow_back" size={24} color={colors.ink} />
    </Pressable>
  );
}

export default function SignIn() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ mode?: string }>();
  const mode = params.mode === 'login' ? 'login' : 'signup';
  const copy = COPY[mode];

  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const { startSSOFlow } = useSSO();

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [flow, setFlow] = useState<'signIn' | 'signUp'>('signIn');
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  const emailAddress = email.trim().toLowerCase();

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  // Clerk tells us whether the email already has an account, so either mode works for either user.
  const sendCode = async () => {
    setBusy(true);
    setError(null);
    try {
      const { error: signInError } = await signIn.emailCode.sendCode({ emailAddress });
      if (!signInError) {
        setFlow('signIn');
      } else if (!hasCode(signInError, 'form_identifier_not_found')) {
        setError(GENERIC_ERROR);
        return;
      } else {
        const created = await signUp.create({ emailAddress });
        const sent = created.error ? created : await signUp.verifications.sendEmailCode();
        if (sent.error) {
          setError(GENERIC_ERROR);
          return;
        }
        setFlow('signUp');
      }
      setCode('');
      setStep('code');
      setResendIn(RESEND_SECONDS);
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
          ? await signIn.emailCode.verifyCode({ code })
          : await signUp.verifications.verifyEmailCode({ code });
      if (verifyError) {
        setError(
          hasCode(verifyError, 'form_code_incorrect') ? "That code didn't match. Check your email and try again." : GENERIC_ERROR,
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
    setGoogleBusy(true);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({ strategy: 'oauth_google' });
      if (createdSessionId && setActive) await setActive({ session: createdSessionId });
    } catch {
      setError(GENERIC_ERROR);
    } finally {
      setGoogleBusy(false);
    }
  };

  const changeEmail = () => {
    setError(null);
    setCode('');
    setStep('email');
  };

  if (step === 'code') {
    return (
      <Screen>
        <BackButton onPress={changeEmail} />
        <KeyboardAvoidingView behavior="height" style={styles.flex}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.intro}>
              <Text style={[type.headline, { color: colors.ink }]} accessibilityRole="header">
                Enter the code
              </Text>
              <Text style={[type.body, { color: colors.muted }]}>
                Sent to <Text style={{ color: colors.ink }}>{emailAddress}</Text>{'. Check spam if it isn’t there in a minute.'}
              </Text>
            </View>
            <CodeField value={code} onChange={setCode} error={error} />
            <Button label="Verify" onPress={verify} loading={busy} disabled={code.length !== 6} />
            <View style={styles.links}>
              {resendIn > 0 ? (
                <Text style={[type.bodySmall, type.figure, { color: colors.muted }]}>
                  Resend code in 0:{String(resendIn).padStart(2, '0')}
                </Text>
              ) : (
                <Button label="Resend code" variant="text" onPress={sendCode} disabled={busy} />
              )}
              <Button label="Change email" variant="text" onPress={changeEmail} />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Screen>
    );
  }

  return (
    <Screen>
      <BackButton onPress={() => (router.canGoBack() ? router.back() : router.replace('/welcome'))} />
      <KeyboardAvoidingView behavior="height" style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.intro}>
            <Text style={[type.headline, { color: colors.ink }]} accessibilityRole="header">
              {copy.title}
            </Text>
            <Text style={[type.body, { color: colors.muted }]}>{copy.body}</Text>
          </View>

          <View style={styles.group}>
            <TextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="send"
              onSubmitEditing={() => isEmail(emailAddress) && !busy && sendCode()}
              placeholder="you@example.com"
              error={error}
            />
            <View style={styles.promise}>
              <Icon name="lock" size={16} color={colors.accentText} />
              <Text style={[type.bodySmall, styles.flex, { color: colors.muted }]}>
                Your email is never shown to other riders.
              </Text>
            </View>
          </View>

          <Button label="Send code" onPress={sendCode} loading={busy} disabled={!isEmail(emailAddress) || googleBusy} />

          <View style={styles.or}>
            <View style={[styles.orLine, { backgroundColor: colors.line }]} />
            <Text style={[type.bodySmall, { color: colors.muted }]}>or</Text>
            <View style={[styles.orLine, { backgroundColor: colors.line }]} />
          </View>

          <Button
            label="Continue with Google"
            variant="ghost"
            image={require('../../../assets/images/google-g.png')}
            onPress={continueWithGoogle}
            loading={googleBusy}
            disabled={busy}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.switch}>
        <Text style={[type.bodySmall, { color: colors.muted }]}>{copy.switchPrompt}</Text>
        <Button label={copy.switchLabel} variant="text" onPress={() => router.setParams({ mode: copy.switchTo })} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  back: { width: 48, height: 48, marginLeft: -12, alignItems: 'center', justifyContent: 'center' },
  content: { gap: 20, paddingTop: 8, paddingBottom: 24 },
  intro: { gap: 8, marginBottom: 8 },
  group: { gap: 10 },
  promise: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  or: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  orLine: { flex: 1, height: 1 },
  links: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 },
  switch: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 },
});
