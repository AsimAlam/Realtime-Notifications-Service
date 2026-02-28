import axios from 'axios';
import { API } from '../config';

const baseURL = API || '';
const api = axios.create({ baseURL, timeout: 10000 });

api.interceptors.request.use(cfg => {
    try {
        const token = sessionStorage.getItem('rn_token');
        if (token) cfg.headers = { ...(cfg.headers || {}), Authorization: token };
    } catch (e) {
        console.error('Failed to set auth header', e);
    }
    return cfg;
}, err => Promise.reject(err));

export default api;
