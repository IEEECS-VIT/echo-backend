import express,{Response} from 'express'
import { supabase } from '../client/supabase';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { v4 as uuidv4 } from 'uuid';
const app = express();

export const createChannel = async (req: AuthenticatedRequest, res: Response):Promise<void> => {
  const { name, type, is_private } = req.body;
  const { server_id } = req.params;
  const email_Id = req.user?.email;

  // --- Input Validation ---
  if (!email_Id) {
     res.status(401).json({ error: 'Authentication error: User email not found.' });
    return
    }
  if (!name || !type || is_private === undefined) {
     res.status(400).json({ error: 'Request body must include name, type, and is_private.' });
    return
    }
  if (!server_id) {
    res.status(400).json({ error: 'Server ID is required in the URL parameters.' });
    return
  }

  try {
    // --- 1. Get User ID ---
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .ilike('email', email_Id)
      .single();

    if (userError || !userData) {
      res.status(404).json({ error: `User with email ${email_Id} not found.` });
      return
    }
    const user_id = userData.id;

    // --- 2. Call RPC for Secure, Transactional Creation ---
    // The RPC function handles the permission check and all database inserts.
    const { data: newChannel, error: rpcError } = await supabase.rpc('create_channel_and_add_member', {
      p_server_id: server_id,
      p_user_id: user_id,
      p_channel_name: name,
      p_channel_type: type,
      p_is_private: is_private,
    });

    if (rpcError) {
      // If the RPC errors, it might be a permissions issue or a database constraint.
      console.error('RPC `create_channel_and_add_member` error:', rpcError);
      // The error message from the RPC (e.g., the permission error) is sent to the client.
      res.status(403).json({ message: 'Error creating channel', details: rpcError.message });
      return
    }

    // The RPC returns an array, so we take the first element.
    res.status(201).json(newChannel?.[0]);
    return 
  } catch (err) {
    console.error('Unexpected error in createChannel controller:', err);
    const details = err instanceof Error ? err.message : 'An unknown error occurred.';
    res.status(500).json({ message: 'An unexpected error occurred.', details });
    return 
  }
};


/**
 * Gets all channels for a given server, but only if the requesting
 * user is a member of that server.
 */
export const getChannels = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { server_id } = req.params;
  const email_id = req.user?.email; // Assuming user ID is attached to the request by auth middleware

  console.log('getChannels called with server_id:', email_id);

  // --- Input Validation ---
  if (!server_id) {
    res.status(400).json({ error: 'Server ID is required in the URL.' });
    return;
  }
  if (!email_id) {
    res.status(401).json({ error: 'Authentication error: Email ID not found.' });
    return;
  }

  try {
    const { data: userData, error: userError } = await supabase
    .from('users')
    .select('id')
    .ilike('email', email_id)
    .single();

    if (userError || !userData) {
    res.status(404).json({ error: `User with email ${email_id} not found.` });
    return
    }
    const user_id = userData.id;


    // --- 1. Security Check: Verify user is a member of the server ---
    const { data: membership, error: membershipError } = await supabase
      .from('server_members')
      .select('user_id') // Efficiently check for existence
      .eq('user_id', user_id)
      .eq('server_id', server_id);

    if (membershipError) throw membershipError;

    if (membership === null) {
      res.status(403).json({ message: 'You are not a member of this server.' });
      return;
    }

    // --- 2. Fetch Channels ---
    // This query only runs if the membership check passes.
    const { data: channels, error: channelsError } = await supabase
      .from('channels')
      .select('id, name, type, is_private')
      .eq('server_id', server_id);

    if (channelsError) {
      throw new Error(`Database error: ${channelsError.message}`);
    }

    res.status(200).json(channels || []);

  } catch (error) {
    const err = error as Error;
    console.error('Error in getChannels controller:', err.message);
    res.status(500).json({ error: 'Internal server error.', details: err.message });
  }
};

export const joinChannel = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    
    const { serverId } = req.params
    const { channelId } = req.body 
    const email_id = req.user?.email; // Get the user ID directly from the token

    // --- Input Validation ---
    if (!email_id) {
        res.status(401).json({ error: 'Authentication failed. Email ID not found in token.' });
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

      const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .ilike('email', email_id)
      .single();

    if (userError || !userData) {
      res.status(404).json({ error: `User with email ${email_id} not found.` });
      return
    }
    const requestingUserId = userData.id;

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
