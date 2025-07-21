// POST /servers/:serverId/channels
import express from 'express'
import { createChannel,getChannels, joinChannel } from '../controllers/channelController';
import { authenticate } from '../middleware/authMiddleware';
import { get } from 'http';

const route = express.Router();
route.post('/:server_id/NewChannel',authenticate,createChannel);
route.get('/:server_id/getChannels',authenticate,getChannels)
route.post('/:serverId/joinChannel',authenticate,joinChannel)

export default route;