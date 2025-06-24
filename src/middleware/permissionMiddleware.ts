// middleware/permissionMiddleware.ts
import {supabase} from "../client/supabase";
;

export const getPermissionsByRoleId = async (roleId: string) =>{
  const { data: permissions, error } = await supabase
    .from('permissions')
    .select('*')
    .eq('role_id', roleId);

  if (error) {
    throw new Error(error.message);
  }

  if(!permissions || permissions.length===0){
    return{};
  }

  // Combine permissions and only return keys with true values
  const combined = permissions.reduce((acc, perm) => {
    for (const [key, value] of Object.entries(perm)) {
      if (key !== 'id' && key !== 'roleId' && typeof value == 'boolean' && value === true) {
        acc[key] = true;
      }
    }
    return acc;
  }, {} as Record<string, boolean>);

  return combined;
};
