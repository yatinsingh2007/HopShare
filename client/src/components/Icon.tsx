import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import type { ColorValue } from 'react-native';

// Material Symbols on Android and web, SF Symbols on iOS.
const IOS: Partial<Record<AndroidSymbol, SFSymbol>> = {
  arrow_forward: 'arrow.right',
  arrow_back: 'arrow.left',
  verified: 'checkmark.seal.fill',
  check_circle: 'checkmark.circle.fill',
  lock: 'lock.fill',
  account_circle: 'person.crop.circle',
  person: 'person.fill', currency_rupee: 'indianrupeesign', location_on: 'location.fill',
  directions_car: 'car.fill',
  home: 'house.fill',
};

export function Icon({ name, size = 20, color }: { name: AndroidSymbol; size?: number; color: ColorValue }) {
  return <SymbolView name={{ ios: IOS[name], android: name, web: name }} size={size} tintColor={color} />;
}
