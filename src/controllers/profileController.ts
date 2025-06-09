import { Request, Response } from 'express';
import { supabase } from '../client/supabase';
import jwt from 'jsonwebtoken';

export const updateProfile = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No or invalid token provided' });
    }

    const token = authHeader.split(' ')[1];

    const decoded = jwt.decode(token) as { email?: string };
    const email = decoded?.email;

    if (!email) {
      return res.status(400).json({ error: 'Email not found in token' });
    }

    const { name, bio, avatar_url } = req.body;

    const { data, error } = await supabase
      .from('profiles')
      .update({ name, bio, avatar_url }) 
      .eq('email', email)
      .select();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.status(200).json({ message: 'Profile updated', profile: data?.[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
};
