require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const authRoutes = require('./routes/authRoutes');
const projectRoutes = require('./routes/projectRoutes');
const executeRoutes = require('./routes/executeRoutes');
const gitRoutes = require('./routes/gitRoutes');
const aiRoutes = require('./routes/aiRoutes');

/**
 * Main Express Application and HTTP Server Initialization.
 * Sets up the REST API routes and configures Socket.IO for real-time features.
 */
const app = express();
const httpServer = http.createServer(app);

// Setup dynamic allowed origins for production UI (Vercel) and local dev
const allowedOrigins = ['http://localhost:5173', process.env.FRONTEND_URL].filter(Boolean);

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true, // Required to maintain session persistence over WebSockets
  },
});

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(express.json());

app.use('/auth', authRoutes);
app.use('/projects', projectRoutes);
app.use('/projects', gitRoutes);
app.use('/api/execute', executeRoutes);
app.use('/projects', aiRoutes);

/**
 * Socket.IO Event Handlers.
 * Manages WebSocket connections for:
 * - Real-time Collaborative Editing (Yjs editor-update)
 * - Architecture Canvas synchronization (canvas-update)
 * - Live Chat (chat_message)
 * - WebRTC Signaling for Video Rooms (offer, answer, ice candidates)
 */
io.on('connection', (socket) => {
  console.log(`User connected with socket ID: ${socket.id}`);

  socket.on('join-workspace', (workspaceId) => {
    socket.join(workspaceId);
    socket.to(workspaceId).emit('peer-joined', socket.id);
  });

  socket.on('editor-update', ({ workspaceId, update }) => {
    socket.to(workspaceId).emit('editor-update', update);
  });

  socket.on('canvas-update', ({ workspaceId, update }) => {
    socket.to(workspaceId).emit('canvas-update', update);
  });

  socket.on('chat_message', ({ workspaceId, message }) => {
    socket.to(workspaceId).emit('chat_message', message);
  });

  socket.on('webrtc_offer', ({ workspaceId, target, sdp }) => {
    socket.to(target).emit('webrtc_offer', { sender: socket.id, sdp });
  });

  socket.on('webrtc_answer', ({ workspaceId, target, sdp }) => {
    socket.to(target).emit('webrtc_answer', { sender: socket.id, sdp });
  });

  socket.on('webrtc_ice_candidate', ({ workspaceId, target, candidate }) => {
    socket.to(target).emit('webrtc_ice_candidate', { sender: socket.id, candidate });
  });

  socket.on('webrtc_join', ({ workspaceId, userId, userName }) => {
    socket.to(workspaceId).emit('webrtc_peer_joined', { socketId: socket.id, userName });
  });

  socket.on('webrtc_leave', ({ workspaceId }) => {
    socket.to(workspaceId).emit('webrtc_peer_left', { socketId: socket.id });
  });

  socket.on('disconnecting', () => {
    for (const room of socket.rooms) {
      if (room !== socket.id) {
        socket.to(room).emit('peer-left', socket.id);
      }
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

const port = process.env.PORT || 5000;

httpServer.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
