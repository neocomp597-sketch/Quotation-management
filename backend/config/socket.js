const { WebSocketServer, WebSocket } = require('ws');

let wss = null;

const initSocket = (server) => {
    wss = new WebSocketServer({ server, path: '/ws' });

    wss.on('connection', (ws, req) => {
        console.log(`[WebSocket Server] Client connected from ${req.socket.remoteAddress}`);

        ws.on('message', (message) => {
            console.log('[WebSocket Server] Received message:', message.toString());
        });

        ws.on('close', () => {
            console.log('[WebSocket Server] Client disconnected');
        });

        ws.on('error', (err) => {
            console.error('[WebSocket Server] Client error:', err);
        });
    });

    console.log('[WebSocket Server] WebSocket Server attached to HTTP server successfully.');
    return wss;
};

const getWss = () => {
    return wss;
};

const broadcastCrmUpdate = (entity, action, data) => {
    if (!wss) {
        console.warn('[WebSocket Server] Cannot broadcast update; WebSocket server not initialized.');
        return;
    }
    try {
        const payload = JSON.stringify({
            type: 'crm_update',
            entity,
            action,
            data,
            timestamp: new Date().toISOString()
        });

        console.log(`[WebSocket Broadcast] ${entity}:${action}`);

        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(payload);
            }
        });
    } catch (err) {
        console.error('[WebSocket Broadcast Error]', err);
    }
};

module.exports = {
    initSocket,
    getWss,
    broadcastCrmUpdate
};
