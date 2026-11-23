import { Linking } from 'react-native';

/** ₹1,234 or ₹124.50, from paise. */
export const rupees = (paise: number) =>
  '₹' +
  (paise / 100).toLocaleString('en-IN', {
    minimumFractionDigits: paise % 100 ? 2 : 0,
    maximumFractionDigits: 2,
  });

/**
 * Opens the rider's own UPI app with the booker's UPI ID and the amount filled in.
 * HopShare never moves money. Some UPI apps refuse these links, so the screen also offers
 * the UPI ID to copy. Returns false if no UPI app opened.
 * https://www.npci.org.in/ (UPI linking specification: pa, pn, am, cu, tn)
 */
export async function payByUpi({ upiId, name, amountPaise, note }: {
  upiId: string;
  name: string;
  amountPaise: number;
  note: string;
}) {
  const query = Object.entries({ pa: upiId, pn: name, am: (amountPaise / 100).toFixed(2), cu: 'INR', tn: note })
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  try {
    await Linking.openURL(`upi://pay?${query}`);
    return true;
  } catch {
    return false;
  }
}
