import {Router} from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/authMiddleware';
import { getProfile, updateProfile, updateStatus } from '../controllers/profileController';


const storage = multer.memoryStorage();

//accepts only images 
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true); 
    } else {
      cb(new Error('Invalid file type. Only images are allowed.'));
    }
  };

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
      fileSize: 1024 * 1024 * 5, // 5 MB file size limit
    },
});

const router = Router();

router.get('/getProfile', authenticate, getProfile);
router.patch('/updateProfile', authenticate, upload.single('avatar'), updateProfile);
router.patch('/updatestatus', authenticate, updateStatus);

export default router;