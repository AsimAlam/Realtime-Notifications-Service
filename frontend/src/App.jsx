import React, { Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home'
import Messages from './pages/Messages'
import Presence from './pages/Presence'

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div style={{ padding: 20 }}>Loading…</div>}>
        <Routes>
          <Route path="*" element={<Navigate to="/messages" replace />} />
          <Route path="/" element={<Navigate to="/messages" replace />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/presence" element={<Presence />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}