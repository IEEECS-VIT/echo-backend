import { Request, Response } from 'express';

let profiles: { id: number; name: string; email: string }[] = [];
let idCounter = 1;

export const createProfile = (req: Request, res: Response) => {
  const { name, email } = req.body;
  const newProfile = { id: idCounter++, name, email };
  profiles.push(newProfile);
  res.status(201).json(newProfile);
};

export const getProfiles = (req: Request, res: Response) => {
  res.json(profiles);
};

export const getProfileById = (req: Request, res: Response) => {
  const profile = profiles.find(p => p.id === parseInt(req.params.id));
  if (!profile) return res.status(404).json({ error: 'Profile not found' });
  res.json(profile);
};

export const deleteProfile = (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const index = profiles.findIndex(p => p.id === id);
  if (index === -1) return res.status(404).json({ error: 'Profile not found' });
  const deleted = profiles.splice(index, 1)[0];
  res.json({ message: 'Profile deleted', profile: deleted });
};
