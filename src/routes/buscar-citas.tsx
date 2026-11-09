import { createFileRoute, Navigate, redirect } from "@tanstack/react-router";
import type { DoctorSortOption } from "@/lib/doctor-filter";

export const Route = createFileRoute("/buscar-citas")({
  validateSearch: (
    s: Record<string, unknown>,
  ): {
    doctor?: string | undefined;
    specialty?: string | undefined;
    search?: string | undefined;
    date?: string | undefined;
    modality?: string | undefined;
    maxPrice?: number | undefined;
    sort?: DoctorSortOption | undefined;
  } => ({
    doctor: typeof s["doctor"] === "string" ? s["doctor"] : undefined,
    specialty: typeof s["specialty"] === "string" ? s["specialty"] : undefined,
    search: typeof s["search"] === "string" ? s["search"] : undefined,
    date:
      typeof s["date"] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s["date"])
        ? s["date"]
        : undefined,
    modality: typeof s["modality"] === "string" ? s["modality"] : undefined,
    maxPrice:
      typeof s["maxPrice"] === "string" || typeof s["maxPrice"] === "number"
        ? Number(s["maxPrice"])
        : undefined,
    sort: typeof s["sort"] === "string" ? (s["sort"] as DoctorSortOption) : undefined,
  }),
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/medicos",
      search,
      replace: true,
    });
  },
  component: BuscarCitasRedirect,
});

function BuscarCitasRedirect() {
  const search = Route.useSearch();
  return <Navigate to="/medicos" search={search} replace />;
}
