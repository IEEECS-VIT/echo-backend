import express, { Request, Response } from 'express'

const app = express()
const PORT = process.env.PORT || 5000

app.get('/', (_req: Request, res: Response) => {
  res.send('Hello from echo-backend!')
})

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})

//updates
import express, { Request, Response } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { subscribeToChannel } from './redis/sub';
import { publishMessage } from './redis/pub';

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

// Redis + Socket.IO logic
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // channel room
  socket.on('join_room', (channelId) => {
    socket.join(channelId);
    console.log(`User ${socket.id} joined room ${channelId}`);
  });

  //new chat message
  socket.on('chat_message', async (data) => {
    // { channelId, senderId, content }
    const message = JSON.stringify(data);
    await publishMessage(`chat:${data.channelId}`, message);
  });
});


subscribeToChannel(io);

httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
