import express, { Router,Request,Response } from 'express';
import { supabase } from '../client/supabase';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { v4 as uuidv4 } from 'uuid';



const router = Router()
const app = express();

export const screation= async (req:AuthenticatedRequest, res: Response ) => {
  const { name } = req.body;   
  const user =req.user;                               
  const user_Id = user?.userId;                                        

const file = req.file;
if(!file){
res.status(400).json({error: 'Icon image is required'});
return
}
const filePath = `icons/${Date.now()}-${file.originalname}`;
const { error: uploadError } = await supabase.storage
.from('server-icons')
.upload(filePath, file.buffer, {
contentType: file.mimetype,
upsert: false,
 });



if (uploadError) {
   res.status(500).json({ error: 'Image upload failed', details: uploadError });
 return
}

const { data: urlData } = supabase
.storage
 .from('server-icons')
.getPublicUrl(filePath);
const icon_url = urlData.publicUrl;

const serverId = uuidv4(); 
  try {
    const {data: server, error: serverError} = await supabase
    .from('servers')
    .insert([
      {
      id:serverId,
      name,
      icon_url,
      owner_id: user_Id,
      }
    ])
    .select()
    .single(); 


    if( serverError || !server){
      throw new Error(serverError?.message || 'Server creation failed')
    }
    

    const { error: memberError } = await supabase
    .from('server_members')
    .insert([
      {
        user_id: user_Id,
        server_id: serverId
      }
    ]);

  if (memberError) {
    throw new Error(memberError.message);
  }

  const channelId= uuidv4()

  const { error: channelError } = await supabase
    .from('channels')
    .insert([
      {
        name: 'general',
        type: 'text',
        is_private: false,
        server_id: serverId,
        id: channelId
      }
    ]);

  if (channelError) {
    throw new Error(channelError.message);
  }


   const { data: fullServer } = await supabase
    .from('servers')
    .select(`
      *,
      server_members (*),
      channels (*)
    `)
    .eq('id', serverId)
    .single();
    res.status(201).json(fullServer);
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error creating server' });
    return;
  }
};