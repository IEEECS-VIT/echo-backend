import dotenv from 'dotenv';
dotenv.config();

import authRoutes from './routes/auth';
import cookieParser from 'cookie-parser';
import express, { Request, Response } from 'express';
import messages from './routes/message';
import './client/supabase';
import { checkBucketConnection } from './lib/storage';
import {rateLimiter} from './middleware/rateLimiter';
import { spamProtection } from './middleware/spamProtection';

checkBucketConnection().catch(console.error);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(cookieParser());

app.get('/', (_req: Request, res: Response) => {
  res.send('Hello from echo-backend!');
});

app.use('/api/auth',rateLimiter,authRoutes);
app.use('/api/message', messages);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});