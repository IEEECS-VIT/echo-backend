import { Request, Response } from 'express';
import { supabase } from '../client/supabase';
import { getPermissionsByRoleId } from '../middleware/permissionMiddleware';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import {v4 as uuidv4} from 'uuid'

type Role = {
  id: string;
  name: string;
  color: string;
  position: number;
  server_id: string
}; 

//To feftch the Role Details
export const getRoleDetailsWithPermissions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { username } = req.body;
  const {serverId} = req.params;

  if (!serverId){
    res.status(400).json({ error: 'ServerId required.'});
    return;
  }

  if (!username) {
    res.status(400).json({ error: 'Username is required.' });
    return;
  }
  try {

const {data: serveruser, error: serverError} = await supabase
.from('server_members')
.select('user_id')
.eq('user_id',req.body.sub)
.eq('server_id',serverId)
.single()

if(serverError || !serveruser){
  res.status(404).json({error:'No user on the given server.'})
  return;
}

const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .single();

    console.log(typeof(userData?.id))
      
    if (userDataError || !userData) {
      res.status(404).json({ error: 'There is no User.' });
      return;
    }
    const userId = userData.id;



const { data: users, error: rolesError } = await supabase
      .from('user_roles')
      .select(`
        user_id,
        roles (
          id,
          name,
          color,
          position,
          server_id
        )
      `)
      .eq('user_id', userId);
              // Here we equate user_roles.user_id with the ID we found

    if (rolesError) {
            console.error("Supabase error fetching roles:", rolesError);
            res.status(404).json({ error: 'User has no roles assigned.' });
      return;
    }

    if (!users || users.length === 0) {
          res.status(404).json({ error: 'User is not assigned any roles.' });
          return;
        }
    const user= users[0]; 
    console.log('Data from Supabase:', JSON.stringify(user, null, 2));
            if (!user.roles || user.roles.length === 0) {
            res.status(404).json({ error: 'Role details not found for this user.' });
            return;
        }

    const role = user.roles as unknown as Role;
    const permissions = await getPermissionsByRoleId(role.id);

        res.json({
      role: {
        id: role.id,
        name: role.name,
        color: role.color,
        position: role.position,
      },
      permissions,
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error.' });
    return;
  }
};

export interface RolePermissions{
    "can_manage_server": boolean,
    "can_kick_members": boolean,
    "can_manage_channels": boolean,
    "can_send_messages": boolean,
    "can_connect_voice": boolean}

export const addRole = async (req:AuthenticatedRequest, res: Response): Promise<void> => {

    const serverId = req.params.server_id

    const { name, permissions, color } = req.body as {
      name: string;
      permissions: RolePermissions;
      color?: string;
    };

    if (!name || !permissions) {
      res.status(400).json({ error: 'Missing required fields in body: name and permissions are required.' });
      return;
    }

    try {

          // Checking for existing role with the same name
    const { data: existingRole, error: checkError } = await supabase
      .from('roles')
      .select('name')
      .eq('server_id', serverId)
      .ilike('name', name); // .ilike() is for case-insensitive matching

    // If the query returns any results, a role with that name already exists.
    if (existingRole && existingRole.length > 0) {
        res.status(409).json({ error: `A role with the name "${name}" already exists on this server.` });
        return;
    }

    // Handle any unexpected errors during the check
    if (checkError) {
        throw new Error(`Error checking for existing role: ${checkError.message}`);
    }
      
    // Finding the highest current position for roles on this server
    const { data: lastRole, error: positionError } = await supabase
      .from('roles')
      .select('position')
      .eq('server_id', serverId)
      .order('position', { ascending: false })
      .limit(1)
      .single();

    if (positionError && positionError.code !== 'PGRST116') {
      // Any error other than "no rows found" is a problem.
      throw new Error(`Could not determine role position: ${positionError.message}`);
    }

    // New position is one higher than the last, or 0 if it's the first role.
    const newPosition = lastRole ? lastRole.position + 1 : 0;

    // full record for insertion
    const RoleId=uuidv4()
    
    console.log(RoleId,serverId,name,color,newPosition)

    const newRoleData = {
      id:RoleId,
      server_id: serverId,
      name,
      color: color || '#99AAB5',
      position: newPosition,
    };

    const permid= uuidv4()

    const perms={
      role_id:RoleId,
      id: permid,
      ...permissions
    };
    //Inserting
    const { data, error: insertError } = await supabase
      .from('roles')
      .insert(newRoleData)
      .select()
      .single();

    if (insertError) {
      throw new Error(`Database error: ${insertError.message}`);
    }

    const {data:Perms, error: insertpError} = await supabase
      .from('permissions')
      .insert(perms)
      .select()
      .single();

    if (insertpError) {
      throw new Error(`Database error: ${insertpError.message}`);
    }

    const {data:URoles, error: URolesinsertError} = await supabase
      .from('user_roles')
      .insert({
        user_id:req.user?.userId,
        role_id:RoleId
      })
      .select()
      .single();

    if (URolesinsertError) {
      throw new Error(`Database error: ${URolesinsertError.message}`);
    }

    const result={
      data,
      Perms,
      URoles
    }

    res.status(201).json(result);

  } catch (error) {
    const err = error as Error;
    console.error('Error in addRole controller:', err.message);
    res.status(500).json({ error: 'Internal server error.', details: err.message });
  }
};

export const editRole = async(req:AuthenticatedRequest, res:Response): Promise<void>=>{

    const serverId= req.params.server_id
    const RoleId=req.params.role_id

    const{new_name,new_color}=req.body as{
      new_name?:string;
      new_color?:string;
    };

    try{
            //Verify permission 
    const { data: userRoles, error: permissionError } = await supabase
      .from('user_roles')
      .select(`
        roles!inner (
        server_id,
          permissions!inner (
            can_manage_server
            )
          )
        `)
      .eq('user_id', req.user?.userId)
      .eq('roles.server_id', serverId);

      if (permissionError) {
          throw new Error(`Permission check failed: ${permissionError.message}`);
      }

    const hasPermission = userRoles && userRoles.some(
      (userRole: any) => userRole.roles.permissions.can_manage_server === true||"TRUE"
      );
      console.log(hasPermission)
    if (!hasPermission) {
        
        res.status(403).json({ error: 'You do not have permission to edit roles on this server.' });
          return;
      }

        const updateFields: { name?: string; color?: string } = {};

        if (new_name) {
            updateFields.name = new_name;
        }
        if (new_color) {
            updateFields.color = new_color;
        }

        //anything to update
        if (Object.keys(updateFields).length === 0) {
            res.status(400).json({ error: 'No new name or color provided to update.' });
            return;
        }
        
        //update query
        const { data: editedRole, error: editError } = await supabase
            .from('roles')
            .update(updateFields)
            .eq('id', RoleId)
            .eq('server_id', serverId)
            .select()
            .single();

        if (editError) {
            //roleId doesn't exist.
            if (editError.code === 'PGRST116') {
                res.status(404).json({ error: 'Role not found on this server.' });
                return;
            }
            throw new Error(`Failed to edit role: ${editError.message}`);
        }
        
        res.status(200).json(editedRole);

    } catch (error) {
        const err = error as Error;
        console.error('Error in editRole controller:', err.message);
        res.status(500).json({ error: 'Internal server error.', details: err.message });
    }
    
}

export const assignRole = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { serverId } = req.params;
    const { userId: targetUserId, role_name } = req.body as {
        userId: string;
        role_name: string;
    };

    if (!targetUserId || !role_name) {
        res.status(400).json({ error: 'User ID and role name are required in the request body.' });
        return;
    }

    try {

        // roles table.
        const { data: userRolesOnServer, error: rolesError } = await supabase
            .from('user_roles')
            .select(`
                role_id,
                roles!inner(server_id)
            `)
            .eq('user_id', req.user?.userId)
            .eq('roles.server_id', serverId);

        if (rolesError) {
            throw new Error(`Permission check failed at roles lookup: ${rolesError.message}`);
        }
        if (!userRolesOnServer || userRolesOnServer.length === 0) {
            res.status(403).json({ error: 'You do not have any roles on this server.' });
            return;
        }

//permissions table
        const roleIds = userRolesOnServer.map(r => r.role_id);
        const { data: permissions, error: permError } = await supabase
            .from('permissions')
            .select('can_manage_server')
            .in('role_id', roleIds)
            .eq('can_manage_server', true)
            .limit(1);

        if (permError) {
            throw new Error(`Permission check failed at permissions lookup: ${permError.message}`);
        }

        const hasPermission = permissions && permissions.length > 0;

        if (!hasPermission) {
            res.status(403).json({ error: 'You do not have permission to assign roles on this server.' });
            return;
        }
        // --- Step 2: Find the role to be assigned (case-insensitive) ---
        const { data: roleToAssign, error: findRoleError } = await supabase
            .from('roles')
            .select('id')
            .eq('server_id', serverId)
            .ilike('name', role_name) 
            .single();

          console.log(roleToAssign);          

        if (findRoleError || !roleToAssign) {
            res.status(404).json({ error: `Role with name "${role_name}" not found on this server.` });
            return;
        }

        // --- Step 3: Verify the target user is a member of the server ---
        const { data: serverMember, error: memberCheckError } = await supabase
            .from('server_members')
            .select('user_id')
            .eq('server_id', serverId)
            .eq('user_id', targetUserId)
            .single();

        if (memberCheckError || !serverMember) {
            res.status(404).json({ error: 'The specified user is not a member of this server.' });
            return;
        }

        // --- Step 4: Assign the role to the user ---
        const { data: assignedRole, error: assignError } = await supabase
            .from('user_roles')
            .upsert({
                user_id: targetUserId,
                role_id: roleToAssign.id,
            })
            .select();

        if (assignError) {
            throw new Error(`Failed to assign role: ${assignError.message}`);
        }

        // --- Success Response ---
        res.status(200).json({
            message: `Successfully assigned role "${role_name}" to user.`,
            data: assignedRole,
        });

    } catch (error) {
        const err = error as Error;
        console.error('Error in assignRole controller:', err.message);
        res.status(500).json({ error: 'Internal server error.', details: err.message });
    }
  
  }