import express from 'express';
import multer from 'multer';
import {screation,getServers, joinServer } from '../controllers/serverController';
import { authenticate } from '../middleware/authMiddleware';
const router = express.Router();
const upload = multer();

router.post('/create/',authenticate,upload.single('icon'),screation);
router.get('/getServers/',authenticate,getServers);
router.post('/joinServer/',authenticate,joinServer);

export default router;
