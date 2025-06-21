import {getRoleDetailsWithPermissions,addRole, editRole, assignRole} from '../controllers/roleController';
import express from 'express';
import { authenticate } from '../middleware/authMiddleware';

const route = express.Router();

// interface AuthPayload {
//   userId:string;
//   sub: string
// }

// declare global {
//   namespace Express {
//     interface Request {
//       user: AuthPayload;
//       body: any;
//       params: any;
//       status: number;
//     }
//   }
// }


route.get('/view_permissions',getRoleDetailsWithPermissions);
route.post('/:server_id/Add_Role',authenticate,addRole)
route.post('/:server_id/:role_id/Edit_Role',authenticate,editRole)
route.post('/:server_id/Assign_Role',authenticate,assignRole)
export default route;