import express, { Request, Response } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { subscribeToChannel } from './redis/sub';
import { publishMessage } from './redis/pub';
import { setupVoiceSocket } from './sockets/voiceSocket';

const app = express();
const PORT = process.env.PORT || 5000;

app.get('/', (_req: Request, res: Response) => {
  res.send('Hello from echo-backend!');
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
  },
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join_room', (channelId: string) => {
    socket.join(channelId);
    console.log(`User ${socket.id} joined room ${channelId}`);
  });

  socket.on(
    'chat_message',
    async (data: { channelId: string; senderId: string; content: string }) => {
      if (!data.channelId || !data.senderId || !data.content) {
        console.error('Invalid chat message');
        return;
      }
      const message = JSON.stringify(data);
      await publishMessage(`chat:${data.channelId}`, message);
    }
  );
});

subscribeToChannel(io);
setupVoiceSocket(io);

httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

