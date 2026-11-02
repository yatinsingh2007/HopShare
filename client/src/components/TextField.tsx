import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

type TextFieldProps = TextInputProps & {
  label: string;
  helper?: string;
  error?: string | null;
  prefix?: string;
};

export function TextField({ label, helper, error, prefix, style, ...inputProps }: TextFieldProps) {
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
        {prefix ? <Text style={[styles.input, styles.prefix, { color: colors.ink }]}>{prefix}</Text> : null}
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
  prefix: { flex: 0, marginRight: 8, fontWeight: '600' },
  input: { flex: 1, fontSize: 16, paddingVertical: 13 },
  meta: { fontSize: 13 },
});
