import { Request,Response } from 'express';
import { supabase } from '../client/supabase';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { v4 as uuidv4 } from 'uuid';

export const screation = async (req: AuthenticatedRequest, res: Response) => {
  const { name } = req.body;
  const user = req.user;
  const email_Id = user?.email;

  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'Icon image is required' });
    return;
  }
  const filePath = `icons/${Date.now()}-${file.originalname}`;
  let uploadResponse;
  try {
    uploadResponse = await supabase.storage
      .from('server-icons')
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });
  } catch (err) {
    res.status(500).json({ error: 'Image upload threw error', details: err });
    return;
  }
  const { error: uploadError } = uploadResponse || {};
  if (uploadError) {
    res.status(500).json({ error: 'Image upload failed', details: uploadError });
    return;
  }
  const { data: urlData } = supabase.storage.from('server-icons').getPublicUrl(filePath);
  const icon_url = urlData?.publicUrl;
  if (!icon_url) {
    res.status(500).json({ error: 'Failed to get public URL for uploaded icon.' });
    return;
  }
  const serverId = uuidv4();
  try {
    if (!email_Id) {
      res.status(400).json({ error: 'owner_email is required in the request body.' });
      return;
    }
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .ilike('email', email_Id)
      .single();
    if (userError || !userData) {
      res.status(404).json({ error: `User with email ${email_Id} not found.`, details: userError });
      return;
    }
    const user_Id = userData.id;
    const { data: server, error: serverError } = await supabase
      .from('servers')
      .insert([
        {
          id: serverId,
          name,
          icon_url,
          owner_id: user_Id,
        },
      ])
      .select()
      .single();
    if (serverError || !server) {
      throw new Error(serverError?.message || 'Server creation failed');
    }
    const { error: memberError } = await supabase
      .from('server_members')
      .insert([
        {
          user_id: user_Id,
          server_id: serverId,
        },
      ]);
    if (memberError) {
      throw new Error(memberError.message);
    }
    const channelId = uuidv4();
    const { error: channelError } = await supabase
      .from('channels')
      .insert([
        {
          name: 'general',
          type: 'text',
          is_private: false,
          server_id: serverId,
          id: channelId,
        },
      ]);
    if (channelError) {
      throw new Error(channelError.message);
    }
    const roleId = uuidv4();

    const { data: ownerRole, error: roleError } = await supabase
      .from('roles')
      .insert([
        {
          id: roleId,
          server_id: serverId,
          name: 'Owner',
          color: '#FFD700',
          position: 0,
        },
      ])
      .select()
      .single();
    if (roleError || !ownerRole) {
      throw new Error(`Failed to create owner role: ${roleError?.message}`);
    }
    const { error: permError } = await supabase.from('permissions').insert({
      role_id: ownerRole.id,
      can_manage_server: true,
      can_kick_members: true,
      can_manage_channels: true,
      can_send_messages: true,
      can_connect_voice: true,
    });
    if (permError) {
      throw new Error(`Failed to set permissions for owner role: ${permError.message}`);
    }
    const { error: userRoleError } = await supabase.from('user_roles').insert({
      user_id: user_Id,
      role_id: ownerRole.id,
    });
    if (userRoleError) {
      throw new Error(`Failed to assign owner role to user: ${userRoleError.message}`);
    }
    const { data: fullServer } = await supabase
      .from('servers')
      .select(`*,server_members (*),channels (*)`)
      .eq('id', serverId)
      .single();
    res.status(201).json(fullServer);
    return;
  } catch (err) {
    res.status(500).json({ message: 'Error creating server', details: err instanceof Error ? err.message : err });
    return;
  }
};

export const getServers = async (req: Request, res: Response): Promise<void> => {
    try {
        // 'servers' table records 
        const { data: servers, error } = await supabase
            .from('servers')
            .select('name,icon_url,id'
            );

        if (error) {
            //Supabase returns an error
            throw new Error(`Database error: ${error.message}`);
        }

        // no server exist
        if (!servers || servers.length === 0) {
            res.status(200).json([]);
            return;
        }

        //Success.
        res.status(200).json(servers);

    } catch (error) {
        const err = error as Error;
        console.error('Error in getServers controller:', err.message);
        res.status(500).json({ error: 'Internal server error.', details: err.message });
    }
};