import React, { createContext, useContext, useState } from 'react'
import socket from '../services/socket'

const SocketContext = createContext()

export function SocketProvider({ children }) {
    const [connected, setConnected] = useState(false)

    function connect(token, onConnect, onError) {
        socket.connect(token, (frame) => { setConnected(true); if (onConnect) onConnect(frame) }, onError)
    }

    function disconnect() { socket.disconnect(); setConnected(false) }
    function subscribe(dest, handler) { return socket.subscribe(dest, handler) }
    function unsubscribe(dest) { socket.unsubscribe(dest) }
    function publish(dest, body) { socket.publish(dest, body) }

    return (
        <SocketContext.Provider value={{ connected, connect, disconnect, subscribe, unsubscribe, publish }}>
            {children}
        </SocketContext.Provider>
    )
}

export function useSocket() { 
    return useContext(SocketContext) 
}