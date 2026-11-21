import { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { type } from '@/theme/type';

type TextFieldProps = TextInputProps & {
  label: string;
  helper?: string;
  error?: string | null;
};

export function TextField({ label, helper, error, style, onFocus, onBlur, ...inputProps }: TextFieldProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      <Text style={[type.label, { color: colors.ink }]}>{label}</Text>
      <View
        style={[
          styles.field,
          {
            backgroundColor: colors.field,
            borderColor: error ? colors.danger : focused ? colors.ink : colors.line,
            borderWidth: error || focused ? 2 : 1.5,
          },
        ]}
      >
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.muted}
          selectionColor={colors.accentText}
          cursorColor={colors.ink}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[type.body, styles.input, { color: colors.ink }, style]}
          {...inputProps}
        />
      </View>
      {error ? (
        <Text style={[type.bodySmall, { color: colors.danger }]}>{error}</Text>
      ) : helper ? (
        <Text style={[type.bodySmall, { color: colors.muted }]}>{helper}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  field: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingHorizontal: 14, minHeight: 56 },
  input: { flex: 1, paddingVertical: 12 },
});
