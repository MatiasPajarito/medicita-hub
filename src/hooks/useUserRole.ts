import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface DoctorData {
  id: string;
  full_name: string;
  specialty: string;
  is_active?: boolean;
  consultation_fee?: number;
  photo_url?: string | null;
}

export interface ResolvedUserRoleData {
  isDoctor: boolean;
  hasDoctorProfile: boolean;
  doctorData: DoctorData | null;
  signedIn: boolean;
  userId: string | null;
  email: string | null;
  doctorProfile: DoctorData | null;
  doctorDisplayName: string;
}

export interface UseUserRoleResult extends ResolvedUserRoleData {
  loading: boolean;
  isLoading: boolean;
  isAuthReady: boolean;
}

const ROLE_CACHE_STORAGE_KEY = "medicita_auth_role_cache_v2";
export const USER_ROLE_QUERY_KEY = ["user-role-state"] as const;

const GUEST_ROLE_DATA: ResolvedUserRoleData = {
  isDoctor: false,
  hasDoctorProfile: false,
  doctorData: null,
  signedIn: false,
  userId: null,
  email: null,
  doctorProfile: null,
  doctorDisplayName: "Portal Médico",
};

let memoryRoleCache: ResolvedUserRoleData | null = null;

function readCachedRoleData(): ResolvedUserRoleData | undefined {
  if (memoryRoleCache) return memoryRoleCache;
  if (typeof window === "undefined") return undefined;
  try {
    const raw =
      window.localStorage.getItem(ROLE_CACHE_STORAGE_KEY) ??
      window.sessionStorage.getItem(ROLE_CACHE_STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as ResolvedUserRoleData;
    if (
      typeof parsed.signedIn === "boolean" &&
      parsed.signedIn &&
      typeof parsed.hasDoctorProfile === "boolean"
    ) {
      memoryRoleCache = parsed;
      return parsed;
    }
  } catch {
    // Ignore storage read errors
  }
  return undefined;
}

function writeCachedRoleData(data: ResolvedUserRoleData) {
  memoryRoleCache = data;
  if (typeof window === "undefined") return;
  try {
    if (data.signedIn) {
      const serialized = JSON.stringify(data);
      window.localStorage.setItem(ROLE_CACHE_STORAGE_KEY, serialized);
      window.sessionStorage.setItem(ROLE_CACHE_STORAGE_KEY, serialized);
    } else {
      window.localStorage.removeItem(ROLE_CACHE_STORAGE_KEY);
      window.sessionStorage.removeItem(ROLE_CACHE_STORAGE_KEY);
    }
  } catch {
    // Ignore storage write errors
  }
}

export function clearCachedRoleData() {
  memoryRoleCache = GUEST_ROLE_DATA;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ROLE_CACHE_STORAGE_KEY);
    window.sessionStorage.removeItem(ROLE_CACHE_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function formatDoctorTitle(fullName?: string | null, email?: string | null): string {
  if (fullName && fullName.trim().length > 0) {
    const clean = fullName.trim();
    if (/^(dr\.?|dra\.?|doctor|doctora)\s+/i.test(clean)) {
      return clean;
    }
    return `Dr(a). ${clean}`;
  }
  if (email) {
    const prefix = email.split("@")[0] ?? "Profesional";
    return `Dr(a). ${prefix}`;
  }
  return "Portal Médico";
}

export function formatShortDoctorBadgeName(fullName?: string | null): string {
  if (!fullName || !fullName.trim()) return "Portal Médico";
  const clean = fullName.trim();
  const withoutPrefix = clean.replace(/^(dr\.?|dra\.?|doctor|doctora)\s+/i, "").trim();
  const parts = withoutPrefix.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Portal Médico";
  const isDra = /^(dra\.?|doctora)\s+/i.test(clean);
  const title = isDra ? "Dra." : "Dr.";
  const shortName = parts.length >= 2 ? `${parts[0]} ${parts[1]}` : parts[0];
  return `${title} ${shortName}`;
}

export async function fetchUserRoleData(): Promise<ResolvedUserRoleData> {
  const { data: sessionData } = await supabase.auth.getSession();
  let user = sessionData.session?.user ?? null;

  if (!user) {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (!authError && authData.user) {
      user = authData.user;
    }
  }

  if (!user) {
    writeCachedRoleData(GUEST_ROLE_DATA);
    return GUEST_ROLE_DATA;
  }

  const [rolesRes, doctorRes] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", user.id),
    supabase
      .from("doctors")
      .select("id, full_name, specialty, is_active, consultation_fee, photo_url")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const roleList = (rolesRes.data ?? []).map((r) => r.role);
  const doctorRow = doctorRes.data ?? null;
  const hasDoctorProfile = Boolean(doctorRow?.id);
  const isDoctor = roleList.includes("doctor") || hasDoctorProfile;

  const metadataName =
    typeof user.user_metadata?.["full_name"] === "string"
      ? user.user_metadata["full_name"]
      : null;

  const resolvedDoctorData: DoctorData | null = doctorRow
    ? {
        id: doctorRow.id,
        full_name: doctorRow.full_name,
        specialty: doctorRow.specialty,
        is_active: doctorRow.is_active,
        consultation_fee: doctorRow.consultation_fee,
        photo_url: doctorRow.photo_url,
      }
    : null;

  const result: ResolvedUserRoleData = {
    isDoctor,
    hasDoctorProfile,
    doctorData: resolvedDoctorData,
    signedIn: true,
    userId: user.id,
    email: user.email ?? null,
    doctorProfile: resolvedDoctorData,
    doctorDisplayName: formatShortDoctorBadgeName(resolvedDoctorData?.full_name ?? metadataName),
  };

  writeCachedRoleData(result);
  return result;
}

export function useUserRole(): UseUserRoleResult {
  const queryClient = useQueryClient();
  const [hasHydrated, setHasHydrated] = useState(() => typeof window !== "undefined");
  const [isResolvingAuthEvent, setIsResolvingAuthEvent] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setIsResolvingAuthEvent(false);
        clearCachedRoleData();
        queryClient.setQueryData<ResolvedUserRoleData>(USER_ROLE_QUERY_KEY, GUEST_ROLE_DATA);
        return;
      }
      if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        if (!memoryRoleCache?.signedIn) {
          setIsResolvingAuthEvent(true);
        }
        void queryClient
          .invalidateQueries({ queryKey: USER_ROLE_QUERY_KEY })
          .finally(() => setIsResolvingAuthEvent(false));
      }
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);

  const cachedInitial = readCachedRoleData();

  const query = useQuery({
    queryKey: USER_ROLE_QUERY_KEY,
    queryFn: fetchUserRoleData,
    enabled: typeof window !== "undefined",
    ...(cachedInitial ? { initialData: cachedInitial } : {}),
    placeholderData: (previousData) => previousData,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const isLoading = !hasHydrated || isResolvingAuthEvent || (query.isPending && !query.data);
  const isAuthReady = !isLoading;
  const resolved = query.data ?? cachedInitial ?? GUEST_ROLE_DATA;

  return {
    ...resolved,
    loading: isLoading,
    isLoading,
    isAuthReady,
  };
}
