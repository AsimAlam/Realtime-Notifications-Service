import React, { useEffect, useState } from 'react'
import { useAuth } from '../providers/AuthProvider'
import { useSocket } from '../providers/SocketProvider'
import MessageList from '../components/MessageList'
import Composer from '../components/Composer'
import PresenceList from '../components/PresenceList'
import { fetchPresence } from '../services/presenceApi'
import { sendNotifyRest } from '../services/notificationsApi'

export default function Messages() {
    const { username, token, requestToken, setUsername } = useAuth()
    const { connect, disconnect, subscribe, publish, connected } = useSocket()

    const [onlineUsers, setOnlineUsers] = useState([])
    const [messages, setMessages] = useState([])
    const [recipient, setRecipient] = useState('')
    const [text, setText] = useState('')

    async function handleGetToken() {
        if (!username || username.trim() === '') return alert('Enter a username first')
        try {
            const t = await requestToken(username)
            handleConnect(t)
        } catch (err) {
            console.error('Failed to get token', err)
            alert('Failed to get token: ' + (err?.response?.data || err.message || 'unknown'))
        }
    }

    function handleConnect(tokenArg) {
        const connectToken = tokenArg || token
        if (!connectToken) return alert('no token')

        connect(connectToken, () => {
            try {
                subscribe('/topic/presence', m => {
                    try {
                        const p = JSON.parse(m.body);
                        setOnlineUsers(p.users || [])
                    } catch {
                        console.error('Failed to parse presence message', m.body)
                    }
                })
            } catch (e) {
                console.error('Failed to subscribe presence topic', e)
            }

            subscribe('/user/queue/notifications', m => {
                try {
                    const notif = JSON.parse(m.body)
                    const realId = notif.id != null ? String(notif.id) : null
                    let parsedPayload
                    try {
                        parsedPayload = JSON.parse(notif.payload)
                    } catch (e) {
                        parsedPayload = { content: notif.payload }
                    }
                    const messageObj = {
                        id: realId || ('tmp-' + Date.now()),
                        payload: parsedPayload.content || notif.payload,
                        from: parsedPayload.from || notif.from || 'unknown',
                        toUserId: notif.toUserId,
                        seq: notif.seq,
                        createdAt: notif.createdAt,
                        delivered: Boolean(notif.delivered)
                    }

                    setMessages(prev => {
                        const filtered = prev.filter(m => !(m._me && m.payload === messageObj.payload && m.toUserId === messageObj.toUserId))
                        const replaced = filtered.map(m => (m.id && realId && String(m.id) === realId) ? ({ ...m, ...messageObj }) : m)
                        const exists = replaced.some(m => String(m.id) === String(messageObj.id))
                        if (!exists) replaced.push(messageObj)
                        return replaced
                    })

                    if (realId) publish('/app/ack', { notificationId: realId, seq: notif.seq, toUserId: notif.toUserId })
                } catch (e) {
                    console.error(e)
                }
            })

            subscribe('/user/queue/delivery-confirm', m => {
                try {
                    const obj = JSON.parse(m.body)
                    const notifId = obj.notificationId != null ? String(obj.notificationId) : null
                    setMessages(prev => {
                        let updated = prev.map(msg => (msg.id != null && notifId && String(msg.id) === notifId) ? ({ ...msg, delivered: true }) : msg)
                        const anyMatched = updated.some(m => m.id != null && notifId && String(m.id) === notifId)
                        if (!anyMatched && obj.toUserId) {
                            updated = updated.map(msg => (msg._me && msg.toUserId === obj.toUserId) ? ({ ...msg, delivered: true }) : msg)
                        }
                        return updated
                    })
                } catch (e) {
                    console.error(e)
                }
            })

            publish('/app/recover', { lastSeenSeq: 0 })
        })
    }

    function handleDisconnect() { disconnect() }

    useEffect(() => {
        let id = null
        async function poll() {
            try {
                const r = await fetchPresence()
                setOnlineUsers(r.users || [])
            } catch {
                console.error('Failed to fetch presence')
            }
        }
        poll()
        id = setInterval(poll, 5000)
        return () => clearInterval(id)
    }, [])

    function sendPrivate() {
        if (!connected) return alert('connect first')
        if (!recipient) return alert('select recipient')
        const tmpId = 'tmp-' + Date.now()
        setMessages(prev => [...prev, { id: tmpId, payload: text, from: username, toUserId: recipient, _me: true, delivered: false, createdAt: new Date().toISOString() }])
        publish('/app/send', { toUserId: recipient, content: text || '(empty)' })
        setText('')
    }

    async function sendRest() {
        if (!recipient) return alert('select recipient')
        try {
            await sendNotifyRest({ userId: recipient, message: text || '(empty)' });
            setText('')
        }
        catch (e) {
            console.error(e); alert('REST failed')
        }
    }

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr' }}>
            <aside style={{ padding: 12 }}>
                <div style={{ marginBottom: 8 }}>
                    <label className="small">Username</label>
                    <input
                        className="input"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        placeholder="Enter username (e.g. alice)"
                    />
                </div>

                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <button className="btn" onClick={handleGetToken}>Get Token</button>
                    <button className="btn secondary" onClick={connected ? handleDisconnect : () => handleConnect()}>{connected ? 'Disconnect' : 'Connect'}</button>
                </div>

                <div style={{ marginBottom: 8 }}>
                    <label className="small">Recipient</label>
                    <select className="input" value={recipient} onChange={e => setRecipient(e.target.value)}>
                        <option value="">— select user —</option>
                        {onlineUsers.filter(u => u && u !== username).map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                </div>

                <div style={{ marginTop: 8 }}>
                    <PresenceList onlineUsers={onlineUsers} currentUser={username} />
                </div>
            </aside>

            <main style={{ display: 'flex', flexDirection: 'column', minHeight: '80vh' }}>
                <div style={{ padding: 12, borderBottom: '1px solid #eef2f7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 700 }}>Messages</div>
                    <div style={{ color: '#6b7280' }}>Logged in as <strong>{username}</strong></div>
                </div>

                <MessageList messages={messages} currentUser={username} />

                <Composer text={text} setText={setText} sendPrivate={sendPrivate} sendRest={sendRest} />
            </main>
        </div>
    )
}
