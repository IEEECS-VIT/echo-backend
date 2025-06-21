import express,{Response} from 'express'
import { supabase } from '../client/supabase';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { v4 as uuidv4 } from 'uuid';
const app = express();

export const cc=async (req:AuthenticatedRequest, res: Response) => {
  const { name, type, is_private} = req.body;
  const { server_id } = req.params;
  const email_Id=req.user?.email;

   try {
        if (!email_Id) {
        res.status(400).json({ error: 'owner_email is required in the request body.' });
        return;
    }

    const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('email', email_Id)
        .single();

    if (userError || !userData) {
        res.status(404).json({ error: `User with email ${email_Id} not found.` });
        return;
    }

    const user_id = userData.id;

    const { data: membership, error: membershipError } = await supabase
      .from('server_members')
      .select('*')
      .eq('user_id', user_id)
      .eq('server_id', server_id)
      .limit(1)
      .maybeSingle();

    if (membershipError) throw membershipError;

    if (!membership) {
      res.status(403).json({ message: 'You are not a member of this server.' });
      return;
    }

    const { data: permission, error: permissionError } = await supabase
      .from('permissions')
      .select('*')
      .eq('can_manage_channels',"TRUE")
      .limit(1)
      .maybeSingle();

    if (permissionError) throw permissionError;

    if (!permission) {
      res.status(403).json({ message: 'You do not have the permission to make a channel.' });
      return;
    }
    const channelId= uuidv4()

    const { data: channel, error: channelError } = await supabase
      .from('channels')
      .insert([
        {
          name,
          type,
          is_private:is_private,
          server_id:server_id,
          id:channelId
        }
      ])
      .select()
      .single();

    if (channelError) throw channelError;
      console.log(user_id,channelId)
    const {data: channelmembers, error:channelmembersError} = await supabase
    .from('channel_members')
    .insert([
    {
      channel_id: channelId,
      user_id:user_id
    }
  ])
    .select()
    .single()

    const result={
      channel,
      channelmembers
    }

    if (channelmembersError) throw (channelmembersError);

    res.status(201).json(result);
    return;

  } catch (err) {
    console.error('Error creating channel:', err);
    res.status(500).json({ message: 'Error creating channel' });
    return;
  }
};
