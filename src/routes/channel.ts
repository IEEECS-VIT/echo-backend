// POST /servers/:serverId/channels
import express from 'express'
import { cc } from '../controllers/channelController';
import { authenticate } from '../middleware/authMiddleware';

const route = express.Router();
route.post('/:server_id/NewChannel',authenticate,cc);

export default route;