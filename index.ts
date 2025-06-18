import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import serverless from 'serverless-http';
import authRoutes from './api/routes/auth';
import messageRoutes from './api/routes/message';
import profileRoutes from './api/routes/profile';
import { rateLimiter } from './api/middleware/rateLimiter';

dotenv.config();

const app = express();

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Routes with middleware
app.use('/api/auth', rateLimiter, authRoutes);
app.use('/api/message', messageRoutes);
app.use('/api/profile', profileRoutes);

// Health check endpoint
app.get('/', (_req: Request, res: Response) => {
  res.json({ message: 'Hello from echo-backend!', status: 'healthy' });
});

export default serverless(app); 