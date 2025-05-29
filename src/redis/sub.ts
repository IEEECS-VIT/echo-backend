
import { createClient } from 'redis';
import { Server } from 'socket.io';

const subscriber = createClient();
await subscriber.connect();

export const subscribeToChannel = (channel: string, io: Server) => {
  subscriber.subscribe(channel, (message) => {
    io.emit(channel, message);
  });
};
