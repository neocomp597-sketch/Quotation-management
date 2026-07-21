import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
    const [isConnected, setIsConnected] = useState(false);
    const [isReconnecting, setIsReconnecting] = useState(false);
    const wsRef = useRef(null);
    const reconnectAttemptsRef = useRef(0);
    const reconnectTimerRef = useRef(null);

    const connect = useCallback(() => {
        let wsUrl = import.meta.env.VITE_WS_URL;

        if (!wsUrl) {
            const apiUrl = import.meta.env.VITE_API_URL;
            if (apiUrl) {
                // Derive from VITE_API_URL (e.g. https://api.domain.com/api -> wss://api.domain.com/ws)
                let derived = apiUrl.replace(/\/api\/?$/, '/ws');
                if (derived.startsWith('http://')) {
                    derived = derived.replace('http://', 'ws://');
                } else if (derived.startsWith('https://')) {
                    derived = derived.replace('https://', 'wss://');
                }
                wsUrl = derived;
            } else {
                const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

                if (isLocal) {
                    wsUrl = `${protocol}//127.0.0.1:4003/ws`;
                } else {
                    // Production on Coolify / Nginx / Reverse Proxy with SSL termination
                    wsUrl = `${protocol}//${window.location.host}/ws`;
                }
            }
        } else {
            // Normalize http(s) to ws(s) if needed
            if (wsUrl.startsWith('http://')) {
                wsUrl = wsUrl.replace('http://', 'ws://');
            } else if (wsUrl.startsWith('https://')) {
                wsUrl = wsUrl.replace('https://', 'wss://');
            }
        }

        const token = localStorage.getItem('accessToken');
        if (token) {
            const separator = wsUrl.includes('?') ? '&' : '?';
            wsUrl = `${wsUrl}${separator}token=${encodeURIComponent(token)}`;
        }

        console.log('[WebSocketClient] Connecting to:', wsUrl);

        try {
            if (wsRef.current) {
                wsRef.current.onopen = null;
                wsRef.current.onmessage = null;
                wsRef.current.onclose = null;
                wsRef.current.onerror = null;
                try { wsRef.current.close(); } catch (_) {}
                wsRef.current = null;
            }

            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('[WebSocketClient] Connected successfully!');
                setIsConnected(true);
                setIsReconnecting(false);
                reconnectAttemptsRef.current = 0;
                if (reconnectTimerRef.current) {
                    clearTimeout(reconnectTimerRef.current);
                    reconnectTimerRef.current = null;
                }
                // Dispatch realtime notification & data update events on connect/login
                window.dispatchEvent(new Event('onNotificationUpdate'));
                window.dispatchEvent(new CustomEvent('onCrmSocketUpdate', {
                    detail: { entity: 'SYSTEM', action: 'LOGIN_REFRESH', timestamp: new Date().toISOString() }
                }));
            };

            ws.onmessage = (event) => {
                try {
                    const payload = JSON.parse(event.data);
                    console.log('[WebSocketClient] Received live update:', payload);
                    if (payload.type === 'crm_update' || payload.type === 'auth_refresh' || payload.type === 'data_refresh') {
                        const customEvent = new CustomEvent('onCrmSocketUpdate', { detail: payload });
                        window.dispatchEvent(customEvent);
                        if (payload.entity === 'NOTIFICATION' || payload.type === 'auth_refresh') {
                            window.dispatchEvent(new Event('onNotificationUpdate'));
                        }
                    }
                } catch (err) {
                    console.error('[WebSocketClient] Error parsing message:', err);
                }
            };

            ws.onclose = () => {
                setIsConnected(false);

                // Reconnect up to max 5 attempts
                if (reconnectAttemptsRef.current < 5) {
                    reconnectAttemptsRef.current += 1;
                    setIsReconnecting(true);
                    reconnectTimerRef.current = setTimeout(connect, 3000);
                } else {
                    setIsReconnecting(false);
                }
            };

            ws.onerror = () => {
                // Handled in onclose
            };
        } catch (err) {
            setIsConnected(false);
            if (reconnectAttemptsRef.current < 5) {
                reconnectAttemptsRef.current += 1;
                setIsReconnecting(true);
                reconnectTimerRef.current = setTimeout(connect, 3000);
            } else {
                setIsReconnecting(false);
            }
        }
    }, []);

    const reconnectSocket = useCallback(() => {
        console.log('[WebSocketClient] Reconnect triggered for realtime data refresh');
        reconnectAttemptsRef.current = 0;
        if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
        }
        connect();
    }, [connect]);

    useEffect(() => {
        connect();

        const handleAuthLogin = () => {
            console.log('[WebSocketClient] Login detected, reconnecting socket for realtime data refresh');
            reconnectSocket();
        };

        const handleAuthSessionChange = () => {
            console.log('[WebSocketClient] Auth session changed, reconnecting socket');
            reconnectSocket();
        };

        const handleOnline = () => {
            console.log('[WebSocketClient] Network back online, reconnecting socket');
            reconnectSocket();
        };

        window.addEventListener('onAuthLogin', handleAuthLogin);
        window.addEventListener('onAuthSessionChange', handleAuthSessionChange);
        window.addEventListener('online', handleOnline);

        return () => {
            if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
            window.removeEventListener('onAuthLogin', handleAuthLogin);
            window.removeEventListener('onAuthSessionChange', handleAuthSessionChange);
            window.removeEventListener('online', handleOnline);
            if (wsRef.current) {
                wsRef.current.onopen = null;
                wsRef.current.onmessage = null;
                wsRef.current.onclose = null;
                wsRef.current.onerror = null;
                try { wsRef.current.close(); } catch (_) {}
            }
        };
    }, [connect, reconnectSocket]);

    return (
        <SocketContext.Provider value={{ socket: wsRef.current, isConnected, isReconnecting, reconnectSocket }}>
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

