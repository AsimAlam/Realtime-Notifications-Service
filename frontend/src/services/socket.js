import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';
import { API } from '../config';

class SocketService {
    constructor() {
        this.client = null;
        this.connected = false;
        this.subscriptions = new Map();
    }

    connect(token, onConnect, onError) {
        if (!token) throw new Error('token required');
        if (this.client && this.client.active) return;

        const tokenNoBearer = String(token).replace(/^Bearer\s+/i, '');
        const base = (API || '').replace(/\/+$/, '');
        const url = base ? `${base}/ws?token=${encodeURIComponent(tokenNoBearer)}` : `/ws?token=${encodeURIComponent(tokenNoBearer)}`;

        this.client = new Client({
            webSocketFactory: () => new SockJS(url),
            connectHeaders: { Authorization: token },
            debug: () => { },
            onConnect: frame => {
                this.connected = true;
                if (onConnect) onConnect(frame);
            },
            onStompError: err => { console.error('STOMP error', err); if (onError) onError(err); },
            onWebSocketClose: () => { this.connected = false; }
        });
        this.client.activate();
        window.__stomp_client = this.client;
    }

    subscribe(destination, handler) {
        if (!this.client) throw new Error('Socket not connected');
        const sub = this.client.subscribe(destination, handler);
        this.subscriptions.set(destination, sub);
        return sub;
    }

    unsubscribe(destination) {
        const sub = this.subscriptions.get(destination);
        if (sub) { sub.unsubscribe(); this.subscriptions.delete(destination); }
    }

    publish(destination, body) {
        if (!this.client) throw new Error('Socket not connected');
        const payload = typeof body === 'string' ? body : JSON.stringify(body);
        this.client.publish({ destination, body: payload });
    }

    disconnect() {
        try { if (this.client) this.client.deactivate(); } catch (e) { console.warn(e); }
        this.client = null; this.connected = false; this.subscriptions.clear(); window.__stomp_client = null;
    }
}

export default new SocketService();
