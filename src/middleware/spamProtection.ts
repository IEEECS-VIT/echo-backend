//prevents users from submitting the same action repeatedly in a short period of time

import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';

const redis = new Redis({
    host:'redis',
    port: 6379,
  });

export const spamProtection = async (req: Request, res: Response, next: NextFunction):Promise<void> => {
  const ip = req.ip
  const actionKey = `spam:${ip}:${req.originalUrl}`;

  const isSpamming = await redis.get(actionKey); //check if same action have been performed before 

  if (isSpamming) {
    res.status(429).json({ message: 'Spam detected. Slow down a bit' });
    return
  }

  await redis.set(actionKey, '1', 'EX', 10); //action key is set to expire in 10 sec

  next();
};
