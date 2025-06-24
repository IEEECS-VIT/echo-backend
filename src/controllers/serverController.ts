import express, { Router,Request,Response } from 'express';
import { supabase } from '../client/supabase';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { v4 as uuidv4 } from 'uuid';



const router = Router()
const app = express();

export const screation= async (req:AuthenticatedRequest, res: Response ) => {
  const { name } = req.body;   
  const user =req.user;                               
  const email_Id=user?.email;                                     

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

// console.log(email_Id);
const serverId = uuidv4(); 
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

    const user_Id = userData.id;
    console.log(user_Id)
    console.log(email_Id)
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

/*0220869c-233a-4545-ba30-736f48807cd1 
265e6a14-73de-4852-bc70-a81855cdf9a8*/