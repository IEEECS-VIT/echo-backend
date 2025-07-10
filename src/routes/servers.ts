import express from 'express';
import multer from 'multer';
import {screation,getServers } from '../controllers/serverController';
import { authenticate } from '../middleware/authMiddleware';
const router = express.Router();
const upload = multer();

router.post('/create/',authenticate,upload.single('icon'),screation);
router.post('/getServers/',authenticate,getServers);

export default router;
