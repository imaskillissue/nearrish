'use client';

import { createContext, useContext, useEffect, useRef, useCallback, useState, ReactNode } from 'react';
import { Client, IMessage } from '@stomp/stompjs';

type WsEventType = 'chat' | 'friends' | 'online';
type WsHandler = (payload: Record<string, unknown>) => void;

interface WsContextType {
  connected: boolean;
  subscribe: (event: WsEventType, handler: WsHandler) => () => void;
  onlineUsers: Set<string>;
}

const WsContext = createContext<WsContextType>({
  connected: false,
  subscribe: () => () => {},
  onlineUsers: new Set(),
});

const WS_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export function WsProvider({ children }: { children: ReactNode }) {
  const clientRef = useRef<Client | null>(null);
  const listenersRef = useRef<Map<WsEventType, Set<WsHandler>>>(new Map());
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  // Helper to emit to registered listeners
  const emit = useCallback((type: WsEventType, payload: Record<string, unknown>) => {
    listenersRef.current.get(type)?.forEach(fn => fn(payload));
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('session_token');
    if (!token) return;

    // Build WebSocket URL from API base — SockJS raw WebSocket endpoint
    const wsUrl = WS_BASE.replace(/^http/, 'ws') + '/ws/websocket';

    const client = new Client({
      brokerURL: wsUrl,
      connectHeaders: { AUTH: token },
      reconnectDelay: 5000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      onConnect: () => {
        setConnected(true);

        // Subscribe to personal chat notifications
        client.subscribe('/user/queue/chat', (msg: IMessage) => {
          emit('chat', { messageId: msg.body });
        });

        // Subscribe to personal friend request notifications
        client.subscribe('/user/queue/friends', (msg: IMessage) => {
          try {
            emit('friends', JSON.parse(msg.body));
          } catch {
            emit('friends', { raw: msg.body });
          }
        });

        // Subscribe to global online status
        client.subscribe('/topic/online', (msg: IMessage) => {
          try {
            const data = JSON.parse(msg.body);
            setOnlineUsers(prev => {
              const next = new Set(prev);
              if (data.status === 'ONLINE') next.add(data.userId);
              else next.delete(data.userId);
              return next;
            });
            emit('online', data);
          } catch { /* ignore */ }
        });
      },
      onDisconnect: () => setConnected(false),
      onStompError: (frame) => {
        console.error('[WS] STOMP error:', frame.headers['message']);
      },
    });

    client.activate();
    clientRef.current = client;

    return () => {
      client.deactivate();
      clientRef.current = null;
      setConnected(false);
    };
  }, [emit]);

  const subscribe = useCallback((event: WsEventType, handler: WsHandler) => {
    if (!listenersRef.current.has(event)) {
      listenersRef.current.set(event, new Set());
    }
    listenersRef.current.get(event)!.add(handler);
    return () => {
      listenersRef.current.get(event)?.delete(handler);
    };
  }, []);

  return (
    <WsContext.Provider value={{ connected, subscribe, onlineUsers }}>
      {children}
    </WsContext.Provider>
  );
}

export function useWs() {
  return useContext(WsContext);
}
