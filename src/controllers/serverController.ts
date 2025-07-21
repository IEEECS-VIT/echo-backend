import { Request,Response } from 'express';
import { supabase } from '../client/supabase';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

/**
 * Handles the creation of a new server.
 * This involves:
 * 1. Uploading an icon to Supabase Storage.
 * 2. Finding the user's ID from their email.
 * 3. Calling a single database RPC to create the server and all its
 * related resources (member, channel, roles) in one transaction.
 * 4. Fetching and returning the complete server object.
 */
export const screation = async (req: AuthenticatedRequest, res: Response): Promise<void>=> {
  const { name } = req.body;
  const user = req.user;
  const email_Id = user?.email;
  const file = req.file;

  // --- Input Validation ---
  if (!file) {
    res.status(400).json({ error: 'Icon image is required' });
    return 
  }
  if (!name) {
    res.status(400).json({ error: 'Server name is required' });
    return   
  }
  if (!email_Id) {
    res.status(401).json({ error: 'Authentication error: User email not found.' });
    return   
  }

  try {
    // --- 1. Upload Icon to Storage ---
    const filePath = `icons/${Date.now()}-${file.originalname}`;
    const { error: uploadError } = await supabase.storage
      .from('server-icons')
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
      });

    if (uploadError) {
      console.error('Supabase storage upload error:', uploadError);
      res.status(500).json({ error: 'Image upload failed', details: uploadError.message });
    return     
    }

    const { data: urlData } = supabase.storage.from('server-icons').getPublicUrl(filePath);
    const icon_url = urlData?.publicUrl;

    if (!icon_url) {
      res.status(500).json({ error: 'Failed to get public URL for uploaded icon.' });
      return     
    }

    // --- 2. Get User ID ---
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .ilike('email', email_Id)
      .single();

    if (userError || !userData) {
      console.error('User lookup error:', userError);
      res.status(404).json({ error: `User not found.`, details: userError?.message });
          return 
    }
    const user_Id = userData.id;

    // --- 3. Call RPC for Transactional Creation ---
    const { data: newServerId, error: rpcError } = await supabase.rpc('create_server_with_resources', {
    server_name: name,
    server_icon_url: icon_url,
    owner_user_id: user_Id,
    });

    if (rpcError) {
      // The RPC handles the transaction, so if it fails, nothing is committed to the DB.
      console.error('RPC `create_server_with_resources` error:', rpcError);
      res.status(500).json({ message: 'Error creating server', details: rpcError.message });
          return 
    }

    // --- 4. Fetch and Return Full Server Data ---
    const { data: fullServer, error: fetchError } = await supabase
      .from('servers')
      .select(`*, server_members (*), channels (*)`)
      .eq('id', newServerId)
      .single();

    if (fetchError) {
      console.error('Error fetching newly created server:', fetchError);
      // The server was created, but we failed to fetch the full object for the response.
      // A 207 status indicates partial success.
      res.status(207).json({ 
          message: 'Server created successfully, but failed to fetch the complete data.', 
          serverId: newServerId,
          details: fetchError.message 
      });
          return 
    }

    res.status(201).json(fullServer);
    return 

  } catch (err) {
    console.error('Unexpected error in server creation:', err);
    const details = err instanceof Error ? err.message : 'An unknown error occurred.';
    res.status(500).json({ message: 'An unexpected error occurred.', details });
    return 
  }
};
export const getServers = async (req: Request, res: Response):Promise<void> => {
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
        return;
    } catch (error) {
        const err = error as Error;
        console.error('Error in getServers controller:', err.message);
        res.status(500).json({ error: 'Internal server error.', details: err.message });
    }
};

export const joinServer = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { serverId } = req.body;
    const email_Id = req.user?.email;

    // --- Input Validation ---
    if (!serverId) {
        res.status(400).json({ error: 'Server ID is required in the request body.' });
        return;
    }
    if (!email_Id) {
        res.status(401).json({ error: 'Authentication error: User email not found.' });
        return;
    }

    try {
        // --- 1. Get User ID from email ---
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('id')
            .ilike('email', email_Id)
            .single();

        if (userError || !userData) {
            res.status(404).json({ error: `User with email ${email_Id} not found.` });
            return;
        }
        const requestingUserId = userData.id;

        // --- 2. Call RPC for Secure, Transactional Join ---
        // This single function handles checking for existing membership,
        // adding the user, and assigning the 'Member' role.
        const { data: newMember, error: rpcError } = await supabase.rpc('join_server_and_assign_member_role', {
            p_server_id: serverId,
            p_user_id: requestingUserId,
        });

        if (rpcError) {
            // The RPC will error if the user is already a member or if the 'Member' role doesn't exist.
            console.error('RPC `join_server_and_assign_member_role` error:', rpcError);
            // Return a 409 Conflict for "already a member" or other issues.
            res.status(409).json({ message: 'Failed to join server.', details: rpcError.message });
            return 
          }

        // --- Success Response ---
        res.status(201).json({
            message: 'Successfully joined the server and assigned Member role.',
            data: newMember?.[0] // The RPC returns an array
        });

    } catch (error) {
        const err = error as Error;
        console.error('Error in joinServer controller:', err.message);
        res.status(500).json({ error: 'An unexpected internal server error occurred.' });
    }
};