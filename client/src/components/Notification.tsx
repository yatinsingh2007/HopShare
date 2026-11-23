import { useState, useEffect } from 'react';
import { Text, View, PermissionsAndroid, Platform, StyleSheet } from 'react-native';
import messaging, { type FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import * as Clipboard from 'expo-clipboard';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Button } from '@/components/Button';
import { Pictogram } from '@/components/Pictogram';
import { Bone } from '@/components/Skeleton';
import { useTheme } from '@/context/ThemeContext';
import { fonts, type } from '@/theme/type';

export async function requestPermissionAndGetToken() {
  if (Platform.OS === 'android') {
    await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
    );
  } else {
    const status = await messaging().requestPermission();
    if (
      status !== messaging.AuthorizationStatus.AUTHORIZED &&
      status !== messaging.AuthorizationStatus.PROVISIONAL
    ) {
      return 'Permission denied';
    }
  }
  return messaging().getToken();
}

export default function NotificationWrapper() {
  const { colors } = useTheme();
  const [fcmToken, setFcmToken] = useState('fetching…');
  const [notif, setNotif] = useState<FirebaseMessagingTypes.RemoteMessage | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    requestPermissionAndGetToken()
      .then(setFcmToken)
      .catch((e) => setFcmToken(String(e)));

    // Foreground message handler
    const unsub = messaging().onMessage(async (msg) => setNotif(msg));
    return unsub;
  }, []);

  const copy = async () => {
    await Clipboard.setStringAsync(fcmToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.line }]}>
      <View style={[styles.block, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line }]}>
        <View style={styles.head}>
          <Pictogram name="notifications" size={36} />
          <View style={styles.flex}>
            <Text style={[type.meta, { color: colors.muted }]}>FCM TOKEN</Text>
            <Text style={[type.bodySmall, { color: colors.muted }]}>Paste it in the Firebase console to send a test.</Text>
          </View>
        </View>
        {fcmToken === 'fetching…' ? (
          <Bone width="100%" height={56} radius={8} />
        ) : (
          <Animated.View entering={FadeIn.duration(200)} style={styles.inner}>
            <Text selectable style={[styles.token, { color: colors.ink, backgroundColor: colors.field, borderColor: colors.line }]}>
              {fcmToken}
            </Text>
            <Button label={copied ? 'Copied' : 'Copy token'} icon={copied ? 'check' : 'content_copy'} variant="ghost" onPress={copy} />
          </Animated.View>
        )}
      </View>

      <View style={styles.block}>
        <Text style={[type.meta, { color: colors.muted }]}>LAST NOTIFICATION</Text>
        {notif ? (
          <Animated.View key={notif.messageId} entering={FadeInDown.duration(240)} style={styles.inner}>
            <Text style={[type.title, { color: colors.ink }]}>Title: {notif.notification?.title}</Text>
            <Text style={[type.body, { color: colors.ink }]}>Body: {notif.notification?.body}</Text>
            <Text selectable style={[styles.token, { color: colors.muted, backgroundColor: colors.field, borderColor: colors.line }]}>
              Data: {JSON.stringify(notif.data)}
            </Text>
          </Animated.View>
        ) : (
          <Text style={[type.bodySmall, { color: colors.muted }]}>Nothing yet. Messages that arrive while HopShare is open show up here.</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { borderWidth: 1.5, borderRadius: 12, overflow: 'hidden' },
  block: { padding: 16, gap: 12 },
  inner: { gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  token: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 18, padding: 12, borderWidth: 1, borderRadius: 8 },
});
