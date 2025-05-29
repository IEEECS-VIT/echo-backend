import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../prisma/client';

// const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';
const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET || 'your_access_secret';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_SECRET || 'your_refresh_secret';

export const testRoute = (_req: Request, res: Response) => {
  console.log("Test route hit");
  res.status(200).json({ message: 'Test route is working!' });
};

export const register = async (req: Request, res: Response):Promise<void> => {
  const { email, username, password } = req.body;
  try {
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }]
      }
    });

    if (existingUser) {
      res.status(409).json({ message: 'User already exists' });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        email,
        username,
        passwordHash
      }
    });

    res.status(201).json({ message: 'User created', userId: newUser.id });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }
    const accessToken = jwt.sign({ userId: user.id }, ACCESS_TOKEN_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ userId: user.id }, REFRESH_TOKEN_SECRET, { expiresIn: '7d' });
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    res.cookie('jwt', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({ accessToken, userId: user.id });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  const cookies = req.cookies;

  if (!cookies?.jwt) {
    res.status(401).json({ message: 'No token provided' });
    return;
  }

  const refreshToken = cookies.jwt;

  try {
    const payload = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET) as { userId: string };

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || user.refreshToken !== refreshToken) {
      res.status(403).json({ message: 'Invalid refresh token' });
      return;
    }

    const newAccessToken = jwt.sign({ userId: user.id }, ACCESS_TOKEN_SECRET, { expiresIn: '15m' });

    res.json({ accessToken: newAccessToken });
  } catch (err) {
    res.status(403).json({ message: 'Token expired or invalid', error: err });
  }
};
