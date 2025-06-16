import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response } from 'express';
import serverless from 'serverless-http';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import authRoutes from './routes/auth';
import messageRoutes from './routes/message';
import './client/supabase';
import { checkBucketConnection } from './lib/storage';


const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(cors());

app.use('/api/auth', authRoutes);
app.use('/api/message', messageRoutes);

app.get('/', (_req: Request, res: Response) => {
  res.send('Hello from echo-backend!');
});

checkBucketConnection().catch(console.error);

const handler = serverless(app);
export { handler };

if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`✅ Local server running at http://localhost:${PORT}`);
  });
}