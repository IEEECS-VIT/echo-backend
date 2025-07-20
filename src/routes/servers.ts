import express from 'express';
import multer from 'multer';
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit
import { screation, getServers } from '../controllers/serverController';
import { authenticate } from '../middleware/authMiddleware';
const router = express.Router();

router.post('/create/', authenticate, upload.single('icon'), screation);
router.get('/getServers/', authenticate, getServers);

export default router;
