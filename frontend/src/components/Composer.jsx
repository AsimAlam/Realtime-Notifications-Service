import React, { useState } from 'react'

export default function Composer({ text, setText, sendPrivate, sendRest }) {
  const [advancedOpen, setAdvancedOpen] = useState(false)

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      <div style={{ display:'flex', gap:8, padding:12, borderTop:'1px solid #eef2f7', alignItems:'center' }}>
        <input
          className="input"
          placeholder="Write a message..."
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') sendPrivate() }}
        />
        <button className="btn" title="Send real-time" onClick={sendPrivate}>Send</button>

        <button
          className="btn secondary"
          onClick={() => setAdvancedOpen(prev => !prev)}
          style={{ padding: '6px 10px' }}
          aria-expanded={advancedOpen}
          aria-controls="composer-advanced"
        >
          {advancedOpen ? 'Hide Dev' : 'Advanced'}
        </button>
      </div>

      {advancedOpen && (
        <div id="composer-advanced" style={{ padding: '0 12px 12px 12px', display:'flex', gap:8, alignItems:'center' }}>
          <small className="small" style={{ marginRight:8 }}>Developer tools:</small>
          <button className="btn secondary" onClick={sendRest}>Send via REST</button>
          <div style={{ marginLeft: 12, fontSize:12, color:'#6b7280' }}>
            Use this when testing enqueue/delivery via REST API
          </div>
        </div>
      )}
    </div>
  )
}
