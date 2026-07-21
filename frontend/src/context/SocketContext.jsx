import React, { createContext, useContext, useEffect, useState, useRef } from 'react';

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
    const [isConnected, setIsConnected] = useState(false);
    const [isReconnecting, setIsReconnecting] = useState(false);
    const wsRef = useRef(null);
    const reconnectAttemptsRef = useRef(0);
    const reconnectTimerRef = useRef(null);

    useEffect(() => {
        let isMounted = true;

        const connect = () => {
            if (!isMounted) return;

            // Environment variable support for Coolify / Production or fallback auto-detection
            const envWsUrl = import.meta.env.VITE_WS_URL;
            let wsUrl = envWsUrl;

            if (!wsUrl) {
                const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

                if (isLocal) {
                    wsUrl = `${protocol}//127.0.0.1:4003/ws`;
                } else {
                    // Production on Coolify / Nginx / Reverse Proxy with SSL termination
                    wsUrl = `${protocol}//${window.location.host}/ws`;
                }
            }

            console.log('[WebSocketClient] Connecting to:', wsUrl);

            try {
                if (wsRef.current) {
                    wsRef.current.onopen = null;
                    wsRef.current.onmessage = null;
                    wsRef.current.onclose = null;
                    wsRef.current.onerror = null;
                    try { wsRef.current.close(); } catch (_) {}
                }

                const ws = new WebSocket(wsUrl);
                wsRef.current = ws;

                ws.onopen = () => {
                    if (!isMounted) return;
                    console.log('[WebSocketClient] Connected successfully!');
                    setIsConnected(true);
                    setIsReconnecting(false);
                    reconnectAttemptsRef.current = 0;
                    if (reconnectTimerRef.current) {
                        clearTimeout(reconnectTimerRef.current);
                        reconnectTimerRef.current = null;
                    }
                    window.dispatchEvent(new Event('onNotificationUpdate'));
                };

                ws.onmessage = (event) => {
                    if (!isMounted) return;
                    try {
                        const payload = JSON.parse(event.data);
                        if (payload.type === 'crm_update') {
                            console.log('[WebSocketClient] Received live update:', payload);
                            const customEvent = new CustomEvent('onCrmSocketUpdate', { detail: payload });
                            window.dispatchEvent(customEvent);
                            if (payload.entity === 'NOTIFICATION') {
                                window.dispatchEvent(new Event('onNotificationUpdate'));
                            }
                        }
                    } catch (err) {
                        console.error('[WebSocketClient] Error parsing message:', err);
                    }
                };

                ws.onclose = (e) => {
                    if (!isMounted) return;
                    setIsConnected(false);

                    // Reconnect up to max 3 attempts
                    if (reconnectAttemptsRef.current < 3) {
                        reconnectAttemptsRef.current += 1;
                        setIsReconnecting(true);
                        reconnectTimerRef.current = setTimeout(connect, 3000);
                    } else {
                        setIsReconnecting(false);
                    }
                };

                ws.onerror = () => {
                    if (!isMounted) return;
                };
            } catch (err) {
                if (!isMounted) return;
                setIsConnected(false);
                if (reconnectAttemptsRef.current < 3) {
                    reconnectAttemptsRef.current += 1;
                    setIsReconnecting(true);
                    reconnectTimerRef.current = setTimeout(connect, 3000);
                } else {
                    setIsReconnecting(false);
                }
            }
        };

        connect();

        return () => {
            isMounted = false;
            if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
            if (wsRef.current) {
                wsRef.current.onopen = null;
                wsRef.current.onmessage = null;
                wsRef.current.onclose = null;
                wsRef.current.onerror = null;
                try { wsRef.current.close(); } catch (_) {}
            }
        };
    }, []);

    return (
        <SocketContext.Provider value={{ socket: wsRef.current, isConnected, isReconnecting }}>
            {children}
        </SocketContext.Provider>
    );
};

export const useSocket = () => {
    const context = useContext(SocketContext);
    if (!context) {
        throw new Error('useSocket must be used within a SocketProvider');
    }
    return context;
};

export default SocketContext;
