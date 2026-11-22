import AsyncStorage from '@react-native-async-storage/async-storage';

// When I last read each ride's chat, to show a "new" dot. Not secret, so AsyncStorage.
const key = (rideId: string) => `hopshare.chatSeen.${rideId}`;

export const markChatSeen = (rideId: string) => AsyncStorage.setItem(key(rideId), new Date().toISOString()).catch(() => {});

export async function hasUnseenChat(rideId: string, lastMessageAt: string | null) {
  if (!lastMessageAt) return false;
  const seen = await AsyncStorage.getItem(key(rideId)).catch(() => null);
  return !seen || new Date(lastMessageAt) > new Date(seen);
}

// the chat on screen right now, so its messages don't also pop up as notifications
let open: string | null = null;
export const setOpenChat = (rideId: string | null) => {
  open = rideId;
};
export const isChatOpen = (rideId: string) => open === rideId;
