const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, '../frontend')));
app.use(express.json());

// In-memory store for sessions
// Structure: { sessionId: { hostSocketId: string, lastLocation: {lat, lng, timestamp} } }
const activeSessions = new Map();

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Host starts a session
    socket.on('host-session', (sessionId) => {
        activeSessions.set(sessionId, {
            hostSocketId: socket.id,
            lastLocation: null
        });
        socket.join(`session-${sessionId}`);
        console.log(`Session ${sessionId} created by ${socket.id}`);
    });

    // Host updates location
    socket.on('update-location', (data) => {
        const { sessionId, lat, lng, timestamp } = data;
        
        if (activeSessions.has(sessionId)) {
            const session = activeSessions.get(sessionId);
            
            // Only the host can update
            if (session.hostSocketId === socket.id) {
                session.lastLocation = { lat, lng, timestamp };
                
                // Broadcast to all viewers in the room (excluding host)
                socket.to(`session-${sessionId}`).emit('location-updated', { lat, lng, timestamp });
            }
        }
    });

    // Host stops session
    socket.on('stop-session', (sessionId) => {
        if (activeSessions.has(sessionId)) {
            const session = activeSessions.get(sessionId);
            if (session.hostSocketId === socket.id) {
                socket.to(`session-${sessionId}`).emit('session-ended');
                activeSessions.delete(sessionId);
                console.log(`Session ${sessionId} ended by host`);
            }
        }
    });

    // Viewer joins session
    socket.on('join-session', (sessionId) => {
        if (activeSessions.has(sessionId)) {
            socket.join(`session-${sessionId}`);
            socket.emit('session-joined', sessionId);
            console.log(`Viewer ${socket.id} joined session ${sessionId}`);
            
            // Send current location if available
            const session = activeSessions.get(sessionId);
            if (session.lastLocation) {
                socket.emit('location-updated', session.lastLocation);
            }
        } else {
            socket.emit('session-error', 'Session not found or has ended.');
        }
    });

    // Viewer leaves session
    socket.on('leave-session', (sessionId) => {
        socket.leave(`session-${sessionId}`);
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        // Find if user was a host, end those sessions
        for (const [sessionId, session] of activeSessions.entries()) {
            if (session.hostSocketId === socket.id) {
                io.to(`session-${sessionId}`).emit('session-ended');
                activeSessions.delete(sessionId);
                console.log(`Session ${sessionId} ended due to host disconnect`);
            }
        }
    });
});

// For HTTP API fallback (REST API endpoints as requested)
app.post('/api/location', (req, res) => {
    const { sessionId, lat, lng, timestamp } = req.body;
    if (activeSessions.has(sessionId)) {
        const session = activeSessions.get(sessionId);
        session.lastLocation = { lat, lng, timestamp };
        io.to(`session-${sessionId}`).emit('location-updated', { lat, lng, timestamp });
        res.status(200).json({ success: true });
    } else {
        res.status(404).json({ error: 'Session not found' });
    }
});

app.get('/api/location/:id', (req, res) => {
    const sessionId = req.params.id;
    if (activeSessions.has(sessionId)) {
        const session = activeSessions.get(sessionId);
        res.status(200).json(session.lastLocation || {});
    } else {
        res.status(404).json({ error: 'Session not found' });
    }
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
