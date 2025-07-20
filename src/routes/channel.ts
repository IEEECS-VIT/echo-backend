// POST /servers/:serverId/channels
import express from 'express'
import { cc,getChannels, joinChannel } from '../controllers/channelController';
import { authenticate } from '../middleware/authMiddleware';
import { get } from 'http';

const route = express.Router();
route.post('/:server_id/NewChannel',authenticate,cc);
route.get('/:server_id/getChannels',getChannels)
route.post('/:server_id/joinChannel',joinChannel)

export default route;