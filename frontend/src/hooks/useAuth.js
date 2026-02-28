import { useState, useEffect } from 'react';
import authApi from '../service/authApi';

const TOKEN_KEY = 'rn_token';
const USER_KEY = 'rn_username';

export function useAuth() {
    const [username, setUsername] = useState(() => sessionStorage.getItem(USER_KEY) || '');
    const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) || null);

    useEffect(() => {
        if (username) sessionStorage.setItem(USER_KEY, username);
        else sessionStorage.removeItem(USER_KEY);
    }, [username]);

    useEffect(() => {
        if (token) sessionStorage.setItem(TOKEN_KEY, token);
        else sessionStorage.removeItem(TOKEN_KEY);
    }, [token]);

    async function requestToken(name) {
        const raw = await authApi.getTokenForUsername(name);
        if (!raw) throw new Error('No token returned from server');
        const t = typeof raw === 'string' && raw.startsWith('Bearer ') ? raw : `Bearer ${raw}`;
        setToken(t);
        setUsername(name);
        return t;
    }

    function clear() {
        setToken(null);
        setUsername('');
    }

    return { username, setUsername, token, setToken, requestToken, clear };
}
