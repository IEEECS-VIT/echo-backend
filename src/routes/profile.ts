import express from 'express';
import {
  createProfile,
  getProfiles,
  getProfileById,
  deleteProfile,
} from '../controllers/profileController';

const router = express.Router();

router.post('/', createProfile);
router.get('/', getProfiles);
router.get('/:id', getProfileById);
router.delete('/:id', deleteProfile);

export default router;
