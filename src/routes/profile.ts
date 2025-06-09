import express from 'express';
import { updateProfile } from '../controllers/profileController';
const router = express.Router();

router.put('/update', updateProfile); 

export default router;
