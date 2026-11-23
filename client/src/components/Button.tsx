import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import type { AndroidSymbol } from 'expo-symbols';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/context/ThemeContext';
import { type } from '@/theme/type';

type ButtonProps = {
  label: string;
  onPress: () => void;
  /** primary: signal yellow, the screen's one "go". ghost: outlined. text: no container, for low-emphasis links. */
  variant?: 'primary' | 'ghost' | 'text';
  icon?: AndroidSymbol;
  /** A full-colour image instead of a tinted icon, e.g. a brand logo. */
  image?: ImageSourcePropType;
  loading?: boolean;
  disabled?: boolean;
};

export function Button({ label, onPress, variant = 'primary', icon, image, loading, disabled }: ButtonProps) {
  const { colors } = useTheme();
  const primary = variant === 'primary';
  const inactive = disabled || loading;
  const fg = primary ? colors.accentInk : variant === 'text' ? colors.ink : colors.ink;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      android_ripple={{ color: primary ? 'rgba(17,17,17,0.14)' : colors.line, borderless: false }}
      style={({ pressed }) => [
        styles.button,
        variant === 'text' && styles.textButton,
        primary && { backgroundColor: inactive ? colors.line : colors.accent },
        variant === 'ghost' && { borderWidth: 1.5, borderColor: colors.ink },
        variant === 'ghost' && inactive && { borderColor: colors.line },
        pressed && !inactive && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.row}>
          {image ? (
            <Image source={image} style={styles.image} />
          ) : icon ? (
            <Icon name={icon} size={20} color={inactive ? colors.muted : fg} />
          ) : null}
          <Text
            style={[
              variant === 'text' ? type.label : styles.label,
              { color: inactive ? colors.muted : fg },
              variant === 'text' && styles.underline,
            ]}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 12,
    minHeight: 56,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  textButton: { minHeight: 48, paddingHorizontal: 12 },
  pressed: { transform: [{ scale: 0.98 }] },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { ...type.title, fontSize: 17 },
  underline: { textDecorationLine: 'underline' },
  image: { width: 20, height: 20 },
});
