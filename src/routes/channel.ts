// POST /servers/:serverId/channels
import express from 'express'
import { cc,getChannels } from '../controllers/channelController';
import { authenticate } from '../middleware/authMiddleware';
import { get } from 'http';

const route = express.Router();
route.post('/:server_id/NewChannel',authenticate,cc);
route.get('/:server_id/getChannels',getChannels)

export default route;