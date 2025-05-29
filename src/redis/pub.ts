
import { createClient } from 'redis';

const publisher = createClient();
await publisher.connect();

export const publishMessage = async (channel: string, message: string) => {
  await publisher.publish(channel, message);
};
