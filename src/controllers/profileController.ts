import { Response } from 'express';
import { supabase } from '../client/supabase';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

export const updateProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ message: 'Authentication error, user not found on request.' });
    return;
  }

  const userId = req.user.sub;
  const { username, bio , fullname } = req.body;
  const avatarFile = req.file;
  const updateData: { [key: string]: string | undefined } = {};

  if (username !== undefined) {
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id') 
      .eq('username', username) 
      .neq('id', userId)       
      .maybeSingle(); 

    if (checkError) {
      console.error('Error checking for existing username:', checkError);
      res.status(500).json({ message: 'Error while checking username availability.' });
      return;
    }
    
    if (existingUser) {
      res.status(409).json({ message: 'This username is already taken by another user.' });
      return;
    }
    updateData.username = username;
  }

  if (bio !== undefined ) updateData.bio = bio;
  if(fullname !==undefined) updateData.fullname = fullname;
  
  if (avatarFile) {
    const ext = path.extname(avatarFile.originalname);
    const fileName = `${uuidv4()}${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, avatarFile.buffer, {
        contentType: avatarFile.mimetype,
        upsert: true
      });

      if (uploadError) {
        console.error('Supabase upload error:', uploadError);
        res.status(500).json({ message: 'Failed to upload avatar.' });
        return;
      }

    const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
    updateData.avatar_url = publicUrlData?.publicUrl;
  }

  if (Object.keys(updateData).length === 0) {
    res.status(400).json({ error: 'No fields provided for update' });
    return;
  }

  const { error: updateError } = await supabase
    .from('users')
    .update(updateData)
    .eq('id', userId)

  if (updateError) {
    console.error('Error updating profile:', updateError.message);
    res.status(500).json({ message: 'Failed to update profile' });
    return;
  }

  res.status(200).json({ message: 'Profile updated successfully'});
};



export const updateStatus = async (req: AuthenticatedRequest, res: Response): Promise <void> => {
  if (!req.user) {
    res.status(401).json({ message: 'Authentication error, user not found on request.' });
    return;
  }
  const userId = req.user.sub;

  const { status } = req.body;
  if (!status) {
    res.status(400).json({ error: 'Status is required' });
    return 
  }

  const { error } = await supabase
    .from('users')
    .update({ status })
    .eq('id', userId)

  if (error) {
   res.status(500).json({ error: error.message });
   return 
  }

  res.status(200).json({ message: 'Status updated successfully'});
};

export const getProfile = async(req: AuthenticatedRequest, res: Response): Promise <void> =>{
  if (!req.user) {
    res.status(401).json({ message: 'Authentication error, user not found on request.' });
    return;
  }

  const userId = req.user.sub;
  try {
    const { data: userDetails, error: fetchError } = await supabase
      .from('users')
      .select('id, email, username, fullname, avatar_url, bio, date_of_birth, status, created_at')
      .eq('id', userId)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching user profile:', fetchError.message); // Log the actual error
      res.status(500).json({ message: 'An internal server error occurred.' });
      return;
    }

    if (!userDetails) {
      res.status(404).json({ message: 'User profile not found.' });
      return;
    }
    
    res.status(200).json({ message: 'Profile details fetched successfully', user: userDetails });

  } catch (error) {
    console.error('Unexpected error in getProfile:', error);
    res.status(500).json({ message: 'An unexpected internal server error occurred.' });
  }
};