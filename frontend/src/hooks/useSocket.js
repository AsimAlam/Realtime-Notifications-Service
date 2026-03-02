import { useEffect, useRef, useState } from 'react';
import socket from '../services/socket';

export function useSocket() {
    const [connected, setConnected] = useState(false);
    const subsRef = useRef([]);

    useEffect(() => {
        return () => {
            subsRef.current.forEach(d => socket.unsubscribe(d));
            try { 
                socket.disconnect(); 
            } catch (e) {
                console.error('Error disconnecting socket on unmount', e);
            }
        };
    }, []);

    function connect(token, onConnect, onError) {
        socket.connect(token, (frame) => {
            setConnected(true);
            if (onConnect) onConnect(frame);
        }, onError);
    }

    function disconnect() {
        try {
            socket.disconnect();
        } finally {
            setConnected(false);
        }
    }

    function subscribe(dest, handler) {
        const sub = socket.subscribe(dest, handler);
        subsRef.current.push(dest);
        return sub;
    }

    function unsubscribe(dest) {
        socket.unsubscribe(dest);
        subsRef.current = subsRef.current.filter(d => d !== dest);
    }

    function publish(dest, body) {
        socket.publish(dest, body);
    }

    return { connect, disconnect, subscribe, unsubscribe, publish, connected };
}