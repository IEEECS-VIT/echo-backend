import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import authRoutes from './routes/auth';
import messageRoutes from './routes/message';
import './client/supabase';
import { checkBucketConnection } from './lib/storage';
import {rateLimiter} from './middleware/rateLimiter';
import { spamProtection } from './middleware/spamProtection';

dotenv.config();

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(cors());

app.use('/api/auth', authRoutes);
app.use('/api/message', messageRoutes);

app.get('/', (_req: Request, res: Response) => {
  res.send('Hello from echo-backend!');
});

app.use('/api/auth',rateLimiter,authRoutes);
app.use('/api/message', messages);
app.use('/api/profiles', profileRoutes);
checkBucketConnection().catch(console.error);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Local server running at http://localhost:${PORT}`);
});
