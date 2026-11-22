import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useSession } from '@/context/AuthContext';
import { API_URL } from '@/services/api';
import { isChatOpen } from '@/services/chatSeen';
import { notifyAccepted, notifyChat, notifyJoinRequest, notifyPaymentClaimed, notifyPaymentDue } from '@/services/notifications';

const SocketContext = createContext<Socket | null>(null);

/**
 * One Socket.io connection while signed in. The handshake sends our access token; if the server
 * says it's expired, we refresh it once and reconnect.
 */
export function SocketProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, getAccessToken, refreshAccessToken } = useSession();
  // created when signing in, connected by the effect below
  const socket = useMemo(
    () =>
      isSignedIn
        ? io(API_URL, {
            autoConnect: false,
            transports: ['websocket'],
            // read on every (re)connect, so a refreshed token is picked up
            auth: (cb) => cb({ token: getAccessToken() }),
          })
        : null,
    [isSignedIn, getAccessToken],
  );

  useEffect(() => {
    if (!socket) return;
    let retried = false;
    const onConnect = () => {
      retried = false;
    };
    const onError = async (err: Error) => {
      if (err.message !== 'unauthorized' || retried) return;
      retried = true;
      if (await refreshAccessToken()) socket.connect();
    };
    // the app may be on any screen when these arrive
    const onRequests = ({ firstName }: { firstName?: string | null }) => {
      if (firstName !== undefined) notifyJoinRequest(firstName);
    };
    const onAnswered = ({ status }: { status: string }) => {
      if (status === 'ACCEPTED') notifyAccepted();
    };

    const onDue = ({ amountPaise, bookerName }: { amountPaise: number; bookerName: string | null }) =>
      notifyPaymentDue(amountPaise, bookerName);
    const onClaimed = ({ amountPaise, firstName }: { amountPaise: number; firstName: string | null }) =>
      notifyPaymentClaimed(amountPaise, firstName);

    type ChatEvent = { rideId: string; message: { isMe: boolean; firstName: string | null; content: string } };
    const onChat = ({ rideId, message }: ChatEvent) => {
      if (!message.isMe && !isChatOpen(rideId)) notifyChat(message.firstName, message.content);
    };

    socket.on('connect', onConnect);
    socket.on('chat:message', onChat);
    socket.on('payment:due', onDue);
    socket.on('payment:claimed', onClaimed);
    socket.on('connect_error', onError);
    socket.on('requests:updated', onRequests);
    socket.on('request:answered', onAnswered);
    socket.connect();
    return () => {
      socket.off('connect', onConnect);
      socket.off('chat:message', onChat);
      socket.off('payment:due', onDue);
      socket.off('payment:claimed', onClaimed);
      socket.off('connect_error', onError);
      socket.off('requests:updated', onRequests);
      socket.off('request:answered', onAnswered);
      socket.disconnect();
    };
  }, [socket, refreshAccessToken]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  return useContext(SocketContext);
}

/** Runs `handler` for each `event` from the server. The latest handler is used without resubscribing. */
export function useSocketEvent<T>(event: string, handler: (data: T) => void) {
  const socket = useSocket();
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });

  useEffect(() => {
    if (!socket) return;
    const listener = (data: T) => latest.current(data);
    socket.on(event, listener);
    return () => {
      socket.off(event, listener);
    };
  }, [socket, event]);
}
