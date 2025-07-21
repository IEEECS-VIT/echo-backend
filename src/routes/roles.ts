// At the very top of your roleRoutes.ts file
console.log("--- roleRoutes.ts file has been loaded by the server ---");
 
import {getRoleDetailsWithPermissions,addRole, editRole, assignRole} from '../controllers/roleController';
import express from 'express';
import { authenticate } from '../middleware/authMiddleware';

const route = express.Router();

route.get(`/:server_id/view`,getRoleDetailsWithPermissions);
route.post('/:server_id/Add_Role',authenticate,addRole);
route.post('/:server_id/:role_id/Edit_Role',authenticate,editRole);
route.post('/:server_id/Assign_Role',authenticate,assignRole);
export default route;