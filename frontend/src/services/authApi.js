import api from './api';
import { ENDPOINTS } from '../api/endPoints';

export async function getTokenForUsername(username) {
    const res = await api.get(ENDPOINTS.auth.token, { params: { username } });
    if (!res || !res.data) return null;
    if (typeof res.data === 'string') return res.data;
    if (res.data.token) return res.data.token;
    return res.data;
}

export default { getTokenForUsername };
