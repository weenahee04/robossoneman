import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import { verifyAccessToken } from '../lib/jwt.js';
import { onSessionProgress } from './mqtt.js';

interface WsClient {
  ws: WebSocket;
  userId: string;
  sessionId?: string;
}

const clients = new Map<string, WsClient>();

export function initWebSocket(server: ReturnType<typeof import('http').createServer>) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
      ws.close(4001, 'Token required');
      return;
    }

    let userId: string;
    try {
      const payload = verifyAccessToken(token);
      userId = payload.userId;
    } catch {
      ws.close(4001, 'Invalid token');
      return;
    }

    const clientId = `${userId}_${Date.now()}`;
    const client: WsClient = { ws, userId };
    clients.set(clientId, client);

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.type === 'subscribe_session' && msg.sessionId) {
          client.sessionId = msg.sessionId;

          // Subscribe to MQTT progress updates for this session
          const unsub = onSessionProgress(msg.sessionId, (data) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'session_progress', sessionId: msg.sessionId, ...data as object }));
            }
          });

          ws.on('close', unsub);
        }

        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
      } catch { /* ignore malformed */ }
    });

    ws.on('close', () => {
      clients.delete(clientId);
    });

    ws.send(JSON.stringify({ type: 'connected', userId }));
  });

  return wss;
}

export function broadcastToUser(userId: string, message: object) {
  clients.forEach((client) => {
    if (client.userId === userId && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  });
}

export function broadcastToSession(sessionId: string, message: object) {
  clients.forEach((client) => {
    if (client.sessionId === sessionId && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  });
}
