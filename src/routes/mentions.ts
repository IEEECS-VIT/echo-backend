import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware';
import { 
  getMentions, 
  markMentionAsRead,
  markAllMentionsAsRead,
  searchMentionable 
} from '../controllers/mentionController';

const router = Router();

// Get user's mentions
router.get('/', authenticate, getMentions);

// Mark all mentions as read
router.patch('/mark-all-read', authenticate, markAllMentionsAsRead);

// Mark mention as read
router.patch('/:mentionId/read', authenticate, markMentionAsRead);

// Search for mentionable users and roles in a server
router.get('/search/:serverId', authenticate, searchMentionable);

export default router;
