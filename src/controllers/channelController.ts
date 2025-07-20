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
        .ilike('email', email_Id)
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

export const getChannels = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    // Get serverId
    const { server_id } = req.params;

    if (!server_id) {
        res.status(400).json({ error: 'Server ID is required in the URL.' });
        return;
    }

    try {
        // Fetch channels 
        const { data: channels, error } = await supabase
            .from('channels')
            .select('id,name,type,is_private')
            .eq('server_id', server_id); 

        
        if (error) {
            throw new Error(`Database error: ${error.message}`);
        }

        if (!channels) {
            res.status(200).json([]);
            return;
        }

        // Success Response 
        res.status(200).json(channels);

    } catch (error) {
        const err = error as Error;
        console.error('Error in getChannels controller:', err.message);
        res.status(500).json({ error: 'Internal server error.', details: err.message });
    }
};

export const joinChannel = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    
    const { serverId } = req.params
    const { channelId } = req.body 
    const requestingUserId = req.user?.userId; // Get the user ID directly from the token

    // --- Input Validation ---
    if (!requestingUserId) {
        res.status(401).json({ error: 'Authentication failed. User ID not found in token.' });
        return;
    }
    if (!serverId) {
        res.status(400).json({ error: 'Server ID is required in the URL parameters.' });
        return;
    }
    if (!channelId) {
        res.status(400).json({ error: 'Channel ID is required in the request body.' });
        return;
    }

    try {
        // --- Step 1: Verify the user is a member of the server ---
        const { data: serverMember, error: serverMemberError } = await supabase
            .from('server_members')
            .select('user_id')
            .eq('user_id', requestingUserId)
            .eq('server_id', serverId)
            .single();

        if (serverMemberError || !serverMember) {
            res.status(403).json({ error: 'Forbidden. You are not a member of this server.' });
            return;
        }

        // --- Step 2: Verify the channel exists on the specified server ---
        const { data: channel, error: channelError } = await supabase
            .from('channels')
            .select('id')
            .eq('id', channelId)
            .eq('server_id', serverId)
            .single();

        if (channelError || !channel) {
            res.status(404).json({ error: `Channel with ID ${channelId} not found on this server.` });
            return;
        }

        // --- Step 3: Check if the user is already a member of the channel ---
        const { data: existingMember, error: memberCheckError } = await supabase
            .from('channel_members')
            .select('*')
            .eq('user_id', requestingUserId)
            .eq('channel_id', channelId)
            .single();

        if (memberCheckError && memberCheckError.code !== 'PGRST116') { // Ignore "no rows found" error
            throw new Error(`Error checking channel membership: ${memberCheckError.message}`);
        }
        if (existingMember) {
            res.status(409).json({ error: 'You are already a member of this channel.' });
            return;
        }

        // --- Step 4: Insert the new member into the channel_members table ---
        const { data: newMember, error: joinError } = await supabase
            .from('channel_members')
            .insert({
                user_id: requestingUserId,
                channel_id: channelId
            })
            .select()
            .single();

        if (joinError) {
            throw new Error(`Failed to join channel: ${joinError.message}`);
        }

        // --- Success Response ---
        res.status(201).json({
            message: 'Successfully joined the channel.',
            data: newMember
        });

    } catch (error) {
        const err = error as Error;
        console.error('Error in joinChannel controller:', err.message);
        res.status(500).json({ error: 'An unexpected internal server error occurred.' });
    }
};
