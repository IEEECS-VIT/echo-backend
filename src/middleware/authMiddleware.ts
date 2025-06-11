//checks for valid token under header or cookies 

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  let token: string| undefined;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')){
      token = authHeader.split(' ')[1];
  }
  else if(req.cookies &&req.cookies.access_token){
      token = req.cookies.access_token;
  }
  
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
    (req as any).user = payload; 
    next();
  } catch (err) {
    res.status(403).json({ message: 'Invalid token' });
  }
};
