import express, { Request, Response } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { subscribeToChannel } from './redis/sub';
import { publishMessage } from './redis/pub';
import { setupVoiceSocket } from './sockets/voiceSocket';
import { setupChatSocket } from './sockets/chatSocket';

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

setupChatSocket(io);
subscribeToChannel(io);
setupVoiceSocket(io);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
