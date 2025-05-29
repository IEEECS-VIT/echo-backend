import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import cookieParser from 'cookie-parser';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(cookieParser());

app.use('/api/auth',authRoutes);

app.get('/', (_req: Request, res: Response) => {
  res.send('Hello from echo-backend!')
})

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})
