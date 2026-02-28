import api from './api'
import { ENDPOINTS } from '../api/endPoints';

export async function sendNotifyRest({ userId, message }) {
    const res = await api.post(ENDPOINTS.notify.post, { userId, message })
    return res.data
}

export default { sendNotifyRest }