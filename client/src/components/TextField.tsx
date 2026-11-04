import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useTheme } from '@/context/ThemeContext';

type TextFieldProps = TextInputProps & {
  label: string;
  helper?: string;
  error?: string | null;
};

export function TextField({ label, helper, error, style, ...inputProps }: TextFieldProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.ink }]}>{label}</Text>
      <View
        style={[
          styles.field,
          { backgroundColor: colors.field, borderColor: error ? colors.danger : colors.line },
        ]}
      >
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.muted}
          style={[styles.input, { color: colors.ink }, style]}
          {...inputProps}
        />
      </View>
      {error ? (
        <Text style={[styles.meta, { color: colors.danger }]}>{error}</Text>
      ) : helper ? (
        <Text style={[styles.meta, { color: colors.muted }]}>{helper}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontSize: 14, fontWeight: '600' },
  field: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 14 },
  input: { flex: 1, fontSize: 16, paddingVertical: 13 },
  meta: { fontSize: 13 },
});
