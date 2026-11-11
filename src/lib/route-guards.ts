import { redirect } from "@tanstack/react-router";
import type { AppRole } from "@/hooks/useUserRole";
import { supabase } from "@/lib/supabase";

/**
 * Reusable TanStack Router `beforeLoad` guard.
 * Verifies that the authenticated user possesses at least one of the `allowedRoles`.
 * Throws `redirect({ to: "/" })` if unauthenticated or unauthorized.
 */
export async function requireRole(
  allowedRoles: readonly AppRole[],
  contextUserId?: string,
): Promise<{ userId: string; roles: AppRole[] }> {
  let userId = contextUserId ?? null;

  if (!userId) {
    const { data: sessionData } = await supabase.auth.getSession();
    userId = sessionData.session?.user?.id ?? null;
  }

  if (!userId) {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/" });
    }
    userId = data.user.id;
  }

  const [rolesRes, doctorRes] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", userId),
    allowedRoles.includes("doctor")
      ? supabase.from("doctors").select("id").eq("user_id", userId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const userRoles = new Set<AppRole>((rolesRes.data ?? []).map((r) => r.role as AppRole));
  if (doctorRes.data?.id) {
    userRoles.add("doctor");
  }

  const isAuthorized = allowedRoles.some((role) => userRoles.has(role));
  if (!isAuthorized) {
    if (userRoles.has("admin") && !allowedRoles.includes("admin")) {
      throw redirect({ to: "/admin/doctores" });
    }
    throw redirect({ to: "/" });
  }

  return {
    userId,
    roles: Array.from(userRoles),
  };
}
