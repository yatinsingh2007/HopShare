import { useRef, type ComponentRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { type } from '@/theme/type';

type CodeFieldProps = {
  value: string;
  onChange: (code: string) => void;
  length?: number;
  error?: string | null;
};

/** Six boxes over one real TextInput, so one-time-code autofill and paste still work. */
export function CodeField({ value, onChange, length = 6, error }: CodeFieldProps) {
  const { colors } = useTheme();
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const active = Math.min(value.length, length - 1);

  return (
    <View style={styles.wrap}>
      <Pressable style={styles.boxes} onPress={() => input.current?.focus()} accessible={false}>
        {Array.from({ length }, (_, i) => {
          const focused = i === active;
          return (
            <View
              key={i}
              style={[
                styles.box,
                {
                  backgroundColor: colors.field,
                  borderColor: error ? colors.danger : focused ? colors.accentText : colors.line,
                  borderWidth: focused || error ? 2 : 1,
                },
              ]}
            >
              <Text style={[styles.digit, type.figure, { color: colors.ink }]}>{value[i] ?? ''}</Text>
            </View>
          );
        })}
      </Pressable>
      <TextInput
        ref={input}
        value={value}
        onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, length))}
        keyboardType="number-pad"
        autoComplete="sms-otp"
        textContentType="oneTimeCode"
        maxLength={length}
        autoFocus
        caretHidden
        accessibilityLabel={`${length}-digit code`}
        style={styles.hidden}
      />
      {error ? <Text style={[type.bodySmall, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  boxes: { flexDirection: 'row', gap: 8 },
  box: { flex: 1, height: 58, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  digit: { fontFamily: 'SchibstedGrotesk_700Bold', fontSize: 24 },
  hidden: { position: 'absolute', opacity: 0, height: 1, width: 1 },
});
