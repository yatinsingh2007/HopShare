import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth, useSignIn, useSignUp, useSSO } from '@clerk/expo';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { CodeField } from '@/components/CodeField';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/context/ThemeContext';
import { useSession } from '@/context/AuthContext';
import { ApiError, apiFetch } from '@/services/api';
import { type } from '@/theme/type';

type ClerkResultError = { code?: string; errors?: { code?: string }[] } | null;

const hasCode = (error: ClerkResultError, code: string) =>
  !!error && (error.code === code || !!error.errors?.some((e) => e.code === code));

const GENERIC_ERROR = 'Something went wrong. Please try again.';
const RATE_LIMITED = 'Too many codes requested. Wait a few minutes and try again.';

const sendError = (error: ClerkResultError) =>
  hasCode(error, 'verification_code_rate_limit_exceeded') ? RATE_LIMITED : GENERIC_ERROR;
const RESEND_SECONDS = 30;

const COPY = {
  signup: {
    title: 'Create your account',
    body: "We'll email you a 6-digit code to confirm it's you, then you'll choose a password.",
    switchPrompt: 'Already have an account?',
    switchLabel: 'Log in',
    switchTo: 'login',
  },
  login: {
    title: 'Welcome back',
    body: 'Log in with your email and password.',
    switchPrompt: 'New to HopShare?',
    switchLabel: 'Create an account',
    switchTo: 'signup',
  },
} as const;

const MIN_PASSWORD = 8;
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
  const clerk = useAuth();
  const session = useSession();

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<'start' | 'code' | 'password'>('start');
  // why the email code was sent: a new account, or "forgot password"
  const [purpose, setPurpose] = useState<'signup' | 'reset'>('signup');
  const [flow, setFlow] = useState<'signIn' | 'signUp'>('signIn');
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  const emailAddress = email.trim().toLowerCase();

  // a Clerk session left over from an earlier sign-in would block a new one
  useEffect(() => {
    if (clerk.isSignedIn) clerk.signOut().catch(() => {});
    // wake the database while the user is still choosing how to sign in
    apiFetch('/api/auth/warmup', { token: null }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clerk has proved the email (code) or Google account. Send its token to our server once, then drop the Clerk session.
  const withClerkToken = async (path: '/api/auth/set-password' | '/api/auth/clerk', body: object = {}) => {
    const clerkToken = await clerk.getToken();
    if (!clerkToken) throw new ApiError(401, 'That code has expired. Please start again.');
    try {
      await session.signIn(path, { ...body, clerkToken });
    } finally {
      await clerk.signOut().catch(() => {});
    }
  };

  const showError = (e: unknown) => setError(e instanceof ApiError ? e.message : GENERIC_ERROR);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  // Clerk tells us whether the email already has an account, so either mode works for either user.
  const sendCode = async (why: 'signup' | 'reset' = purpose) => {
    setPurpose(why);
    setBusy(true);
    setError(null);
    try {
      const { error: signInError } = await signIn.emailCode.sendCode({ emailAddress });
      if (!signInError) {
        setFlow('signIn');
      } else if (!hasCode(signInError, 'form_identifier_not_found')) {
        setError(sendError(signInError));
        return;
      } else {
        const created = await signUp.create({ emailAddress });
        const sent = created.error ? created : await signUp.verifications.sendEmailCode();
        if (sent.error) {
          setError(sendError(sent.error));
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
      if (finalizeError) {
        setError(GENERIC_ERROR);
        return;
      }
      setPassword('');
      setStep('password');
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  // Google gives us the name too, so new riders skip the name question
  const continueWithGoogle = async () => {
    setError(null);
    setGoogleBusy(true);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({ strategy: 'oauth_google' });
      if (!createdSessionId || !setActive) return;
      await setActive({ session: createdSessionId });
      await withClerkToken('/api/auth/clerk');
    } catch (e) {
      showError(e);
    } finally {
      setGoogleBusy(false);
    }
  };

  const logIn = async () => {
    setBusy(true);
    setError(null);
    try {
      await session.signIn('/api/auth/login', { email: emailAddress, password });
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  const forgotPassword = () => {
    if (!isEmail(emailAddress)) {
      setError('Enter your email first, then tap Forgot password.');
      return;
    }
    sendCode('reset');
  };

  const savePassword = async () => {
    setBusy(true);
    setError(null);
    try {
      await withClerkToken('/api/auth/set-password', { password });
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  const startOver = () => {
    setError(null);
    setCode('');
    setPassword('');
    setStep('start');
    clerk.signOut().catch(() => {});
  };

  const passwordField = (label: string, isNew: boolean, onSubmit: () => void) => (
    <View style={styles.group}>
      <TextField
        label={label}
        value={password}
        onChangeText={setPassword}
        secureTextEntry={!showPassword}
        autoComplete={isNew ? 'new-password' : 'current-password'}
        textContentType={isNew ? 'newPassword' : 'password'}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="go"
        onSubmitEditing={onSubmit}
        placeholder={isNew ? `At least ${MIN_PASSWORD} characters` : 'Your password'}
        error={error}
      />
      <View style={styles.passwordLinks}>
        <Button label={showPassword ? 'Hide password' : 'Show password'} variant="text" onPress={() => setShowPassword((v) => !v)} />
        {!isNew ? <Button label="Forgot password?" variant="text" onPress={forgotPassword} disabled={busy} /> : null}
      </View>
    </View>
  );

  if (step === 'password') {
    const isReset = purpose === 'reset';
    const submit = () => password.length >= MIN_PASSWORD && !busy && savePassword();
    return (
      <Screen>
        <BackButton onPress={startOver} />
        <KeyboardAvoidingView behavior="height" style={styles.flex}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.intro}>
              <Text style={[type.headline, { color: colors.ink }]} accessibilityRole="header">
                {isReset ? 'Set a new password' : 'Choose a password'}
              </Text>
              <Text style={[type.body, { color: colors.muted }]}>
                You’ll log in with <Text style={{ color: colors.ink }}>{emailAddress}</Text> and this password.
              </Text>
            </View>
            {passwordField(isReset ? 'New password' : 'Password', true, submit)}
            <Button
              label={isReset ? 'Save and log in' : 'Create account'}
              onPress={savePassword}
              loading={busy}
              disabled={password.length < MIN_PASSWORD}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </Screen>
    );
  }

  if (step === 'code') {
    return (
      <Screen>
        <BackButton onPress={startOver} />
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
                <Button label="Resend code" variant="text" onPress={() => sendCode()} disabled={busy} />
              )}
              <Button label="Change email" variant="text" onPress={startOver} />
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
              returnKeyType={mode === 'login' ? 'next' : 'send'}
              onSubmitEditing={() => mode === 'signup' && isEmail(emailAddress) && !busy && sendCode('signup')}
              placeholder="you@example.com"
              error={mode === 'signup' ? error : null}
            />
            <View style={styles.promise}>
              <Icon name="lock" size={16} color={colors.accentText} />
              <Text style={[type.bodySmall, styles.flex, { color: colors.muted }]}>
                Your email is never shown to other riders.
              </Text>
            </View>
          </View>

          {mode === 'login' ? (
            <>
              {passwordField('Password', false, () => isEmail(emailAddress) && password && !busy && logIn())}
              <Button label="Log in" onPress={logIn} loading={busy} disabled={!isEmail(emailAddress) || !password || googleBusy} />
            </>
          ) : (
            <Button
              label="Send code"
              onPress={() => sendCode('signup')}
              loading={busy}
              disabled={!isEmail(emailAddress) || googleBusy}
            />
          )}

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
        <Button
          label={copy.switchLabel}
          variant="text"
          onPress={() => {
            setError(null);
            setPassword('');
            router.setParams({ mode: copy.switchTo });
          }}
        />
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
  passwordLinks: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 40 },
  links: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 },
  switch: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 },
});
