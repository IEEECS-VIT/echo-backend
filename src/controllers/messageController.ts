import type { Request, Response } from "express";
import { supabase } from '../client/supabase';
import {v4} from 'uuid';

export const messagePostController = async (req:Request, res:Response):Promise<any>=>{
    
    const id = v4();
    const {content, channelId, senderId, replyToId } = req.body;
    if(!channelId){
        return res.status(400).json({'error':'No channelId received.'});
    } 
    if(!senderId){
        return res.status(400).json({'error':'No senderId received.'});
    }

    let mediaUrl:string | null = null;

    try{
        if (req.file) {
            const fileExt = req.file.originalname.split('.').pop();//gets the extension of the file
            const fileName = `${id}.${fileExt}`;//filename to store as , should not conflict.

            const {data, error: uploadError}= await supabase.storage
                .from('attachments')
                .upload(fileName, req.file.buffer, {
                contentType: req.file.mimetype,
                upsert: true,
            });

            if(uploadError){
                console.error(uploadError);
                return res.status(500).json({'error':'Server error'});
            }

            // Get public URL
            const { data: publicUrlData } = supabase.storage.from(process.env.SUPABASE_BUCKET!).getPublicUrl(fileName);
            mediaUrl = publicUrlData.publicUrl;
        }

        //store all data in "Message" table
        const { error: insertError } = await supabase.from('messages').insert({
            id,
            content,
            mediaUrl,
            isEdited: false,
            channelId,
            senderId,
            replyToId: replyToId || null,
        });

        if (insertError) {
            console.error(insertError);
            return res.status(500).json({error:'Server error'});
        }
        return res.status(200).json({msg:'Message saved successfully'});
    } 
    catch(error:any){
        console.error(error);
        return res.status(500).json({error:'Server error'});
    }
};

/* note : for every get message request , we send 15 messages. */
/* if the offset received is 0 , we send latest 15 messgages. 
    if the offset is 1 , then we send the next 15 messages and so on */
export const messageGetController = async (req:Request, res:Response):Promise<any>=>{
    try{
        const channelId:number = parseInt(req.query.channelId as string); // as string to satisfy typescript
        const offset:number = parseInt(req.query.offset as string) || 0;
        if(!channelId){
            return res.status(400).json({msg:'No channelId received'});
        }
        /* if no offset is received , then we assume 0 as offset*/
        /* use parseInt */
        const from = offset * 15;
        const to = from + 14;
        const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('channel_id', channelId)
        .order('timestamp', { ascending: false }) //latest messages
        .range( from, to ); //send 15 messages

        if(error){
            console.error('Error fetching messages:', error);
            return res.status(500).json({msg:'Server Error'});
        }else{
            console.log('Fetched messages:', data);
            return res.status(200).json({data});
        }
    }
    catch(e:any){
        console.log(`Error in GET message : ${e}`);
        return res.status(500).json({'msg':'Server Error'});
    }
}