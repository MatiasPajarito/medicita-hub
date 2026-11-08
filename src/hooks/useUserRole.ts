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

export interface UseUserRoleResult {
  isDoctor: boolean;
  doctorData: DoctorData | null;
  loading: boolean;
  isLoading: boolean;
  signedIn: boolean;
  userId: string | null;
  email: string | null;
  doctorProfile: DoctorData | null;
  doctorDisplayName: string;
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

export async function fetchUserRoleData() {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authError ? null : (authData.user ?? null);

  if (!user) {
    return {
      isDoctor: false,
      doctorData: null as DoctorData | null,
      signedIn: false,
      userId: null as string | null,
      email: null as string | null,
      doctorProfile: null as DoctorData | null,
      doctorDisplayName: "Portal Médico",
    };
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
  const isDoctor = roleList.includes("doctor") || Boolean(doctorRow);

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
    : isDoctor
      ? {
          id: user.id,
          full_name: metadataName ?? user.email?.split("@")[0] ?? "Profesional Médico",
          specialty: "Medicina General",
          is_active: true,
        }
      : null;

  return {
    isDoctor,
    doctorData: resolvedDoctorData,
    signedIn: true,
    userId: user.id,
    email: user.email ?? null,
    doctorProfile: resolvedDoctorData,
    doctorDisplayName: formatShortDoctorBadgeName(resolvedDoctorData?.full_name ?? metadataName),
  };
}

export function useUserRole(): UseUserRoleResult {
  const queryClient = useQueryClient();
  const [authVersion, setAuthVersion] = useState(0);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange(() => {
      setAuthVersion((v) => v + 1);
      void queryClient.invalidateQueries({ queryKey: ["user-role-state"] });
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);

  const query = useQuery({
    queryKey: ["user-role-state", authVersion],
    queryFn: fetchUserRoleData,
    staleTime: 30_000,
  });

  if (!query.data) {
    return {
      isDoctor: false,
      doctorData: null,
      loading: query.isPending,
      isLoading: query.isPending,
      signedIn: false,
      userId: null,
      email: null,
      doctorProfile: null,
      doctorDisplayName: "Portal Médico",
    };
  }

  return {
    ...query.data,
    loading: query.isPending,
    isLoading: query.isPending,
  };
}
