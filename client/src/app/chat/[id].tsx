import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Icon } from '@/components/Icon';
import { groupCode } from '@/components/RideCard';
import { PlaceRowSkeleton } from '@/components/Skeleton';
import { useSession } from '@/context/AuthContext';
import { useSocketEvent } from '@/context/SocketContext';
import { useTheme } from '@/context/ThemeContext';
import { ApiError } from '@/services/api';
import { markChatSeen, setOpenChat } from '@/services/chatSeen';
import { fonts, type } from '@/theme/type';

type Message = { id: string; senderId: string; firstName: string | null; content: string; createdAt: string; isMe: boolean };
type Page = { messages: Message[]; hasMore: boolean; open: boolean };
type RideBits = { destination: { name: string }; members: { id: string; firstName: string | null; isMe: boolean }[] };

const QUICK = ["I'm at the pickup", 'Running 2 min late', 'Where are you?', 'On my way'];
const MAX = 500;

const time = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

function Bubble({ m, showName }: { m: Message; showName: boolean }) {
  const { colors } = useTheme();
  const mine = m.isMe;
  return (
    <Animated.View
      entering={FadeInUp.duration(180)}
      accessible
      accessibilityLabel={`${mine ? 'You' : (m.firstName ?? 'Rider')}: ${m.content}. ${time(m.createdAt)}`}
      style={[styles.bubbleRow, mine ? styles.mineRow : styles.theirsRow]}
    >
      {showName && !mine ? (
        <Text style={[type.meta, styles.name, { color: colors.muted }]}>{(m.firstName ?? 'Rider').toUpperCase()}</Text>
      ) : null}
      <View
        style={[
          styles.bubble,
          mine
            ? { backgroundColor: colors.accent, borderBottomRightRadius: 4 }
            : { backgroundColor: colors.card, borderColor: colors.line, borderWidth: 1.5, borderBottomLeftRadius: 4 },
        ]}
      >
        <Text style={[type.body, { color: mine ? colors.accentInk : colors.ink }]}>{m.content}</Text>
        <Text style={[styles.time, type.figure, { color: mine ? 'rgba(17,17,17,0.6)' : colors.muted }]}>{time(m.createdAt)}</Text>
      </View>
    </Animated.View>
  );
}

/** The group's chat for one ride: members only, open while the ride is on and for a day after. */
export default function Chat() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { request } = useSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [open, setOpen] = useState(true);
  const [ride, setRide] = useState<RideBits | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // add without duplicates: my own message comes back both from POST and over the socket
  const merge = useCallback((incoming: Message[]) => {
    setMessages((all) => {
      const seen = new Set((all ?? []).map((m) => m.id));
      return [...(all ?? []), ...incoming.filter((m) => !seen.has(m.id))].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    });
  }, []);

  useEffect(() => {
    setOpenChat(id);
    markChatSeen(id);
    request<Page>(`/api/rides/${id}/messages`)
      .then((page) => {
        merge(page.messages);
        setHasMore(page.hasMore);
        setOpen(page.open);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load the chat.'));
    request<RideBits>(`/api/rides/${id}`).then(setRide).catch(() => {});
    return () => {
      setOpenChat(null);
      markChatSeen(id);
    };
  }, [id, request, merge]);

  useSocketEvent<{ rideId: string; message: Message }>('chat:message', ({ rideId, message }) => {
    if (rideId !== id) return;
    merge([message]);
    markChatSeen(id);
  });

  const loadOlder = async () => {
    if (!hasMore || loadingOlder || !messages?.length) return;
    setLoadingOlder(true);
    try {
      const page = await request<Page>(`/api/rides/${id}/messages?before=${encodeURIComponent(messages[0].createdAt)}`);
      merge(page.messages);
      setHasMore(page.hasMore);
    } catch {
      // try again on the next scroll
    } finally {
      setLoadingOlder(false);
    }
  };

  const send = async (content: string) => {
    const body = content.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      merge([await request<Message>(`/api/rides/${id}/messages`, { method: 'POST', body: { content: body } })]);
      if (body === text.trim()) setText('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Not sent. Try again.');
      if (e instanceof ApiError && e.status === 409) setOpen(false);
    } finally {
      setSending(false);
    }
  };

  // newest at the bottom: the list is inverted, so it's fed newest first
  const newestFirst = useMemo(() => [...(messages ?? [])].reverse(), [messages]);
  const others = ride?.members.filter((m) => !m.isMe).map((m) => m.firstName ?? 'Rider') ?? [];
  const canSend = open && !!text.trim() && !sending;

  return (
    <KeyboardAvoidingView style={[styles.flex, { backgroundColor: colors.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.line, backgroundColor: colors.bg }]}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={({ pressed }) => [styles.back, { backgroundColor: colors.card, borderColor: colors.ink }, pressed && styles.pressed]}
        >
          <Icon name="arrow_back" size={22} color={colors.ink} />
        </Pressable>
        <View style={styles.flex}>
          <Text style={[type.title, { color: colors.ink }]} accessibilityRole="header" numberOfLines={1}>
            {groupCode(id)} chat{ride ? ` · to ${ride.destination.name}` : ''}
          </Text>
          <Text style={[type.bodySmall, { color: colors.muted }]} numberOfLines={1}>
            {others.length ? `With ${others.join(', ')}` : 'Only people in this group see it'}
          </Text>
        </View>
      </View>

      {messages === null && !error ? (
        <View style={styles.body}>
          {[0, 1, 2].map((i) => (
            <PlaceRowSkeleton key={i} index={i} />
          ))}
        </View>
      ) : (
        <FlatList
          inverted
          data={newestFirst}
          keyExtractor={(m) => m.id}
          renderItem={({ item, index }) => {
            // the list is inverted: the message drawn just above this one is the next item
            const above = newestFirst[index + 1];
            return <Bubble m={item} showName={!above || above.senderId !== item.senderId} />;
          }}
          contentContainerStyle={styles.list}
          onEndReached={loadOlder}
          onEndReachedThreshold={0.3}
          ListFooterComponent={loadingOlder ? <ActivityIndicator style={styles.older} color={colors.muted} /> : undefined}
          ListEmptyComponent={
            <View style={[styles.empty, styles.flip]}>
              <Text style={[type.body, styles.center, { color: colors.muted }]}>
                Say hi, or tell the group where you are. Only people in this ride see these messages.
              </Text>
            </View>
          }
          keyboardShouldPersistTaps="handled"
        />
      )}

      {error ? <Text style={[type.bodySmall, styles.error, { color: colors.danger }]}>{error}</Text> : null}

      {open ? (
        <View style={[styles.composer, { borderTopColor: colors.line, backgroundColor: colors.bg, paddingBottom: insets.bottom + 8 }]}>
          {!text ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quick} keyboardShouldPersistTaps="handled">
              {QUICK.map((q) => (
                <Pressable
                  key={q}
                  onPress={() => send(q)}
                  disabled={sending}
                  accessibilityRole="button"
                  accessibilityLabel={`Send: ${q}`}
                  style={({ pressed }) => [styles.chip, { borderColor: colors.ink, backgroundColor: colors.card }, pressed && styles.pressed]}
                >
                  <Text style={[type.label, { color: colors.ink }]}>{q}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
          <View style={styles.inputRow}>
            <View style={[styles.field, { backgroundColor: colors.field, borderColor: colors.line }]}>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Message the group"
                placeholderTextColor={colors.muted}
                accessibilityLabel="Message"
                multiline
                maxLength={MAX}
                cursorColor={colors.ink}
                selectionColor={colors.accentText}
                style={[type.body, styles.input, { color: colors.ink }]}
              />
            </View>
            <Pressable
              onPress={() => send(text)}
              disabled={!canSend}
              accessibilityRole="button"
              accessibilityLabel="Send"
              accessibilityState={{ disabled: !canSend, busy: sending }}
              style={({ pressed }) => [
                styles.send,
                { backgroundColor: canSend ? colors.accent : colors.line },
                pressed && canSend && styles.pressed,
              ]}
            >
              {sending ? (
                <ActivityIndicator color={colors.accentInk} />
              ) : (
                <Icon name="send" size={22} color={canSend ? colors.accentInk : colors.muted} />
              )}
            </Pressable>
          </View>
        </View>
      ) : (
        <Animated.View
          entering={FadeIn.duration(200)}
          style={[styles.closed, { borderTopColor: colors.line, paddingBottom: insets.bottom + 12 }]}
        >
          <Text style={[type.bodySmall, styles.center, { color: colors.muted }]}>
            This chat has closed. It stays open for a day after the ride ends.
          </Text>
        </Animated.View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  flip: { transform: [{ scaleY: -1 }] },
  pressed: { transform: [{ scale: 0.96 }] },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  back: { width: 48, height: 48, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 16 },
  list: { paddingHorizontal: 12, paddingVertical: 12, gap: 4, flexGrow: 1 },
  older: { paddingVertical: 12 },
  empty: { flex: 1, justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 48 },
  bubbleRow: { maxWidth: '82%', gap: 2, marginTop: 4 },
  mineRow: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  theirsRow: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  name: { marginLeft: 6, marginTop: 6 },
  bubble: { borderRadius: 16, paddingHorizontal: 14, paddingTop: 8, paddingBottom: 6 },
  time: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 14, alignSelf: 'flex-end', marginTop: 2 },
  error: { paddingHorizontal: 16, paddingBottom: 6 },
  composer: { borderTopWidth: 1, paddingTop: 8, gap: 8 },
  quick: { paddingHorizontal: 12, gap: 8 },
  chip: { minHeight: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1.5, justifyContent: 'center' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12 },
  field: { flex: 1, borderWidth: 1.5, borderRadius: 22, paddingHorizontal: 16, minHeight: 48, justifyContent: 'center' },
  input: { maxHeight: 120, paddingVertical: 10 },
  send: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  closed: { borderTopWidth: 1, paddingTop: 12, paddingHorizontal: 24 },
});
