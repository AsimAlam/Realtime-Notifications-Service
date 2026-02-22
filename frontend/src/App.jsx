import React, { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import SockJS from 'sockjs-client'
import { Client } from '@stomp/stompjs'
import { format } from 'date-fns'

const API = ''

function useSessionStorage(key, initial) {
  const [state, setState] = useState(() => {
    try {
      const raw = sessionStorage.getItem(key)
      return raw ? JSON.parse(raw) : initial
    } catch { return initial }
  })
  useEffect(() => {
    sessionStorage.setItem(key, JSON.stringify(state))
  }, [key, state])
  return [state, setState]
}

export default function App() {
  const [username, setUsername] = useSessionStorage('rn_username', 'alice')
  const [token, setToken] = useSessionStorage('rn_token', null)
  const [connected, setConnected] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState([])
  const [messages, setMessages] = useState([])
  const [recipient, setRecipient] = useState('')
  const [text, setText] = useState('')
  const [toast, setToast] = useState(null)
  const stompRef = useRef(null)
  const messagesRef = useRef(null)

  function showToast(t) {
    setToast(t)
    setTimeout(() => setToast(null), 3500)
  }

  async function requestToken(name) {
    try {
      const res = await axios.get(`${API}/auth/token?username=${encodeURIComponent(name)}`)
      const t = res.data.token
      setToken(t)
      showToast('Token retrieved — ready to connect')
      return t
    } catch (err) {
      console.error(err)
      showToast('UserName already exists')
      throw err
    }
  }

  function connect() {
    if (!token) {
      showToast('No token — press "Get Token" first')
      return
    }
    const tokenNoBearer = token.replace('Bearer ', '')
    const url = `/ws?token=${encodeURIComponent(tokenNoBearer)}`
    const client = new Client({
      webSocketFactory: () => new SockJS(url),
      connectHeaders: { Authorization: token },
      debug: (msg) => { console.debug('STOMP:', msg) },
      onConnect: frame => {
        console.log('STOMP connected', frame)
        setConnected(true)

        window._stomp = client;
        window._stomp._connectedAt = Date.now();

        client.subscribe('/user/queue/notifications', (m) => {
          try {
            const notif = JSON.parse(m.body);

            const realId = notif.id != null ? String(notif.id) : null;

            let parsedPayload;
            try {
              parsedPayload = JSON.parse(notif.payload);
            } catch (e) {
              parsedPayload = { content: notif.payload };
              console.warn('Failed to parse notification payload as JSON, using raw string', e, notif.payload);
            }

            const fromUser = parsedPayload.from || parsedPayload.fromUser || notif.from || notif.fromUser || 'unknown';
            const content = parsedPayload.content || parsedPayload.message || notif.payload || '';

            const messageObj = {
              id: realId || ('tmp-' + Date.now()),
              payload: content,
              from: fromUser,
              toUserId: notif.toUserId,
              seq: notif.seq,
              createdAt: notif.createdAt,
              delivered: Boolean(notif.delivered),
            };

            console.log('Received server notif', messageObj);

            setMessages(prev => {
              const filtered = prev.filter(m => {
                if (m._me && m.payload === messageObj.payload && m.toUserId === messageObj.toUserId) {
                  return false;
                }
                return true;
              });

              const replaced = filtered.map(m => (m.id && realId && String(m.id) === realId) ? ({ ...m, ...messageObj }) : m);

              const exists = replaced.some(m => String(m.id) === String(messageObj.id));
              if (!exists) replaced.push(messageObj);

              return replaced;
            });

            if (realId) {
              console.log('Auto-ACK ->', realId);
              client.publish({
                destination: '/app/ack',
                body: JSON.stringify({ notificationId: realId, seq: notif.seq, toUserId: notif.toUserId })
              });
            }
          } catch (e) {
            console.error('Failed to parse STOMP incoming notification', e, m);
          }
        });


        client.subscribe('/user/queue/delivery-confirm', (m) => {
          try {
            const obj = JSON.parse(m.body);
            const notifId = obj.notificationId != null ? String(obj.notificationId) : null;
            console.log('delivery-confirm received', obj);

            setMessages(prev => {
              let updated = prev.map(msg => {
                if (msg.id != null && notifId && String(msg.id) === notifId) {
                  return { ...msg, delivered: true };
                }
                return msg;
              });

              const anyMatched = updated.some(m => m.id != null && notifId && String(m.id) === notifId);
              if (!anyMatched && obj.toUserId) {
                updated = updated.map(msg => {
                  if (!msg.delivered && msg.toUserId === obj.toUserId) {
                    return { ...msg, delivered: true };
                  }
                  return msg;
                });
              }

              return updated;
            });
          } catch (e) {
            console.error('Failed to parse delivery-confirm', e, m);
          }
        });



        client.subscribe('/topic/presence', msg => {
          try {
            const p = JSON.parse(msg.body); setOnlineUsers(p.users || [])
          } catch (e) {
            console.error('Failed to parse presence message', msg, e)
          }
        })
        client.publish({ destination: '/app/recover', body: JSON.stringify({ lastSeenSeq: 0 }) })
      },
      onStompError: (err) => {
        console.error('STOMP error', err)
        showToast('STOMP Error')
      },
      onWebSocketClose: () => { setConnected(false); showToast('Disconnected') }
    })

    client.activate()
    window._stomp = client;
    stompRef.current = client
    showToast('Connecting...')
  }

  function disconnect() {
    const c = stompRef.current
    if (c) {
      try {
        c.deactivate();
      } catch (e) {
        console.error('Error during STOMP disconnect', e)
      }
    }
    setConnected(false)
    stompRef.current = null
  }

  function sendPrivate() {
    if (!stompRef.current || !connected) { showToast('Not connected'); return }
    if (!recipient) { showToast('Select recipient'); return }
    const payload = { toUserId: recipient, content: text || '(empty)' }

    const tmpId = 'tmp-' + Date.now();

    setMessages(prev => [...prev, {
      id: tmpId,
      payload: payload.content,
      from: username,
      toUserId: recipient,
      seq: null,
      _me: true,
      delivered: false,
      createdAt: new Date().toISOString()
    }]);

    stompRef.current.publish({ destination: '/app/send', body: JSON.stringify(payload) });

    setText('');
  }

  useEffect(() => {
    const id = setInterval(() => {
      if (stompRef.current && stompRef.current.active) {
        stompRef.current.publish({ destination: "/app/heartbeat", body: "{}" });
      }
    }, 30000);
    return () => clearInterval(id);
  }, []);


  async function sendRest() {
    if (!recipient) {
      showToast('Select recipient');
      return
    }
    try {
      await axios.post('/notify', { userId: recipient, message: text || '(empty)' })
      showToast('REST notify sent')
      setText('')
    } catch (err) {
      console.error(err)
      showToast('REST failed')
    }
  }

  async function handleGetToken() {
    await requestToken(username)
    setTimeout(() => {
      connect()
    }, 350)
  }

  useEffect(() => {
    let stop = false
    async function poll() {
      try {
        const r = await axios.get('/presence')
        if (!stop) setOnlineUsers(r.data.users || [])
      } catch (err) {
        console.error(err)
      }
    }
    const id = setInterval(poll, 5000)
    poll()
    return () => {
      stop = true; clearInterval(id)
    }
  }, [])

  useEffect(() => {
    window.__messages = messages;
    if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight + 200
  }, [messages])

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="header">
          <div className="brand">RealtimeNotify</div>
          <div className="status">
            <span className="dot" style={{ background: connected ? 'var(--success)' : '#f59e0b' }} />
            <div className="small">{connected ? 'Connected' : 'Offline'}</div>
          </div>
        </div>

        <div>
          <label className="small">Username</label>
          <input className="input" value={username} onChange={e => setUsername(e.target.value)} />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={handleGetToken}>Get Token</button>
          <button className="btn secondary" onClick={connected ? disconnect : connect}>{connected ? 'Disconnect' : 'Connect'}</button>
        </div>

        <div style={{ marginTop: 8 }}>
          <label className="small">Recipient</label>
          <select className="input" value={recipient} onChange={e => setRecipient(e.target.value)}>
            <option value="">— select user —</option>
            {onlineUsers
              .filter(u => u && u !== username)
              .map(u => <option key={u} value={u}>{u}</option>)
            }
          </select>
        </div>

        <div className="small" style={{ marginTop: 8 }}>Online</div>
        <div className="presence-list" aria-live="polite">
          {
            onlineUsers.length === 0 && <div className="small" style={{ color: '#9ca3af' }}>No users online</div>
          }
          {onlineUsers.map(u => (
            <div key={u} className="presence-item">
              <div className="avatar">{u.slice(0, 1).toUpperCase()}</div>
              <div>
                <div className="presence-name">{u}</div>
                <div className="small">online</div>
              </div>
            </div>
          ))}
        </div>
      </aside>

      <main className="panel">
        <div className="topbar">
          <div className="title">Messages</div>
          <div className="right small">
            <div>Logged in as <strong style={{ marginLeft: 6 }}>{username}</strong></div>
          </div>
        </div>

        <div className="messages" ref={messagesRef}>
          {messages.map((m, i) => {
            const me = m._me || m.from === username
            return (
              <div key={m.id || i} className={`msg-row ${me ? 'me' : ''}`}>
                {!me && <div className="avatar">{(m.from || m.toUserId || 'U').slice(0, 1).toUpperCase()}</div>}
                <div>
                  <div className={`bubble ${me ? 'me' : ''}`}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{me ? 'You' : (m.from || m.toUserId)}</div>
                    <div style={{ marginTop: 6 }}>{m.payload || m.content}</div>
                    <div className="meta">
                      <div>{m.seq != null ? `#${m.seq}` : ''}</div>
                      <div>{m.createdAt ? format(new Date(m.createdAt), 'p, MMM d') : ''}</div>
                      <div style={{ marginLeft: 6, color: m.delivered ? 'var(--success)' : 'var(--muted)' }}>
                        {m.delivered ? '✓ Delivered' : (m._me ? 'Pending' : '')}
                      </div>
                    </div>
                  </div>
                </div>
                {me && <div style={{ width: 36 }}></div>}
              </div>
            )
          })}
        </div>

        <div className="composer">
          <input className="input" placeholder="Write a message..." value={text} onChange={e => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') sendPrivate() }} />
          <button className="btn" onClick={sendPrivate}>Send</button>
          <button className="btn secondary" onClick={sendRest}>Send via REST</button>
        </div>
      </main>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
