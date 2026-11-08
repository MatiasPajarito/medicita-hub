import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  CalendarPlus,
  CheckCircle2,
  RotateCcw,
  SearchX,
  Stethoscope,
  HeartPulse,
  Activity,
  Brain,
  Baby,
  ShieldCheck,
} from "lucide-react";
import { PageHeading } from "@/components/medicita/page-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DoctorFilterBar } from "@/components/medicita/doctor-filters";
import { specialties as clinicalSpecialties } from "@/lib/clinical-schemas";
import {
  filterAndSortDoctors,
  formatFeeCLP,
  getSpecialtyCounts,
  type DoctorSortOption,
} from "@/lib/doctor-filter";
import { supabase } from "@/lib/supabase";

interface RawDoctor {
  id: string;
  full_name: string;
  specialty: string;
  bio?: string | null;
  license_number?: string | null;
  price?: number | null;
  consultation_fee?: number | null;
  is_active?: boolean;
}

export const Route = createFileRoute("/medicos")({
  validateSearch: (
    s: Record<string, unknown>,
  ): {
    specialty?: string | undefined;
    search?: string | undefined;
    maxPrice?: number | undefined;
    sort?: DoctorSortOption | undefined;
  } => ({
    specialty: typeof s["specialty"] === "string" ? s["specialty"] : undefined,
    search: typeof s["search"] === "string" ? s["search"] : undefined,
    maxPrice:
      typeof s["maxPrice"] === "string" || typeof s["maxPrice"] === "number"
        ? Number(s["maxPrice"])
        : undefined,
    sort: typeof s["sort"] === "string" ? (s["sort"] as DoctorSortOption) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Profesionales médicos — MediCita" },
      {
        name: "description",
        content:
          "Busca y filtra profesionales médicos por especialidad, tarifa y nombre para agendar tu próxima atención.",
      },
      { property: "og:title", content: "Profesionales médicos — MediCita" },
      {
        property: "og:description",
        content:
          "Directorio de profesionales médicos disponibles con búsqueda y filtros avanzados.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DoctorsDirectory,
});

const initials = (name: string) =>
  name
    .replace(/^(dra?\.?|doctora?)\s*/i, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

// Asignación de iconos y estilos de distinción por especialidad
function getSpecialtyStyle(specialty: string) {
  const norm = specialty.toLowerCase();
  if (norm.includes("cardio")) {
    return {
      icon: HeartPulse,
      badgeClass: "border-rose-500/30 bg-rose-500/10 text-rose-400",
      avatarBg: "bg-rose-500/15 text-rose-400 border-rose-500/30",
      areaLabel: "Área Cardiovascular",
    };
  }
  if (norm.includes("trauma") || norm.includes("orto")) {
    return {
      icon: Activity,
      badgeClass: "border-amber-500/30 bg-amber-500/10 text-amber-400",
      avatarBg: "bg-amber-500/15 text-amber-400 border-amber-500/30",
      areaLabel: "Aparato Locomotor",
    };
  }
  if (norm.includes("mental") || norm.includes("psic") || norm.includes("psiq")) {
    return {
      icon: Brain,
      badgeClass: "border-indigo-500/30 bg-indigo-500/10 text-indigo-400",
      avatarBg: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
      areaLabel: "Salud Mental y Bienestar",
    };
  }
  if (norm.includes("pedia")) {
    return {
      icon: Baby,
      badgeClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
      avatarBg: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
      areaLabel: "Atención Pediátrica",
    };
  }
  return {
    icon: Stethoscope,
    badgeClass: "border-sky-500/30 bg-sky-500/10 text-sky-400",
    avatarBg: "bg-sky-500/15 text-sky-400 border-sky-500/30",
    areaLabel: "Medicina General y Preventiva",
  };
}

async function fetchDoctorsFromSupabase() {
  const { data, error } = await supabase
    .from("doctors")
    .select("id, full_name, specialty, bio, license_number, price, is_active")
    .order("full_name", { ascending: true });

  if (error) throw error;

  return (data || []).map((doc: RawDoctor) => ({
    ...doc,
    consultation_fee: Number(doc.price || doc.consultation_fee || 0),
  }));
}

function DoctorsDirectory() {
  const doctors = useQuery({
    queryKey: ["doctors"],
    queryFn: fetchDoctorsFromSupabase,
  });

  const searchParams = Route.useSearch();
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState(searchParams.search ?? "");
  const [specialty, setSpecialty] = useState(searchParams.specialty ?? "all");
  const [maxFee, setMaxFee] = useState<number | undefined>(searchParams.maxPrice);
  const [sortBy, setSortBy] = useState<DoctorSortOption>(searchParams.sort ?? "default");

  const rawDoctors = useMemo(() => doctors.data ?? [], [doctors.data]);

  const availableSpecialties = useMemo(() => {
    const fromData = rawDoctors.map((d) => d.specialty).filter(Boolean);
    const combined = Array.from(new Set([...fromData, ...clinicalSpecialties]));
    return combined.sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  }, [rawDoctors]);

  const specialtyCounts = useMemo(() => {
    return getSpecialtyCounts(rawDoctors);
  }, [rawDoctors]);

  const { minAvailableFee, maxAvailableFee } = useMemo(() => {
    if (rawDoctors.length === 0) return { minAvailableFee: 0, maxAvailableFee: 100000 };
    const fees = rawDoctors.map((d) => Number(d.consultation_fee || d.price || 0));
    return {
      minAvailableFee: Math.min(...fees),
      maxAvailableFee: Math.max(...fees),
    };
  }, [rawDoctors]);

  const filteredDoctors = useMemo(() => {
    return filterAndSortDoctors(rawDoctors, {
      searchTerm,
      specialty,
      maxFee,
      sortBy,
    });
  }, [rawDoctors, searchTerm, specialty, maxFee, sortBy]);

  function handleResetFilters() {
    setSearchTerm("");
    setSpecialty("all");
    setMaxFee(undefined);
    setSortBy("default");
    void navigate({
      to: "/medicos",
      search: {},
      replace: true,
    });
  }

  function handleSpecialtyChange(newSpecialty: string) {
    setSpecialty(newSpecialty);
    void navigate({
      to: "/medicos",
      search: (prev) => ({
        ...prev,
        specialty: newSpecialty === "all" ? undefined : newSpecialty,
      }),
      replace: true,
    });
  }

  return (
    <>
      <PageHeading
        eyebrow="Directorio clínico"
        title="Profesionales médicos"
        description="Encuentra al especialista adecuado mediante búsqueda inteligente y filtros avanzados por especialidad y tarifa."
      />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {doctors.isLoading && (
          <div className="py-12 text-center">
            <div className="mx-auto size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="mt-4 text-sm text-muted-foreground">
              Cargando directorio de profesionales…
            </p>
          </div>
        )}

        {doctors.isError && (
          <Card className="border-destructive/40 bg-destructive/10 p-6 text-center">
            <p className="font-semibold text-destructive">
              No pudimos cargar el directorio de profesionales.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Por favor, verifica tu conexión o intenta recargar la página.
            </p>
            <Button variant="outline" size="sm" onClick={() => doctors.refetch()} className="mt-4">
              Reintentar
            </Button>
          </Card>
        )}

        {doctors.isSuccess && (
          <>
            <DoctorFilterBar
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              specialty={specialty}
              onSpecialtyChange={handleSpecialtyChange}
              availableSpecialties={availableSpecialties}
              specialtyCounts={specialtyCounts}
              maxFee={maxFee}
              onMaxFeeChange={setMaxFee}
              minAvailableFee={minAvailableFee}
              maxAvailableFee={maxAvailableFee}
              sortBy={sortBy}
              onSortByChange={setSortBy}
              onReset={handleResetFilters}
              totalResults={filteredDoctors.length}
              totalDoctors={rawDoctors.length}
            />

            {filteredDoctors.length === 0 && rawDoctors.length > 0 && (
              <Card className="border-dashed border-border/80 bg-surface-subtle p-8 text-center sm:p-12">
                <SearchX className="mx-auto size-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-bold text-foreground">
                  No se encontraron profesionales coincidentes
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                  No hay médicos que coincidan con los filtros aplicados.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <Button onClick={handleResetFilters} variant="default" className="gap-2">
                    <RotateCcw className="size-4" />
                    Restablecer filtros
                  </Button>
                </div>
              </Card>
            )}

            {filteredDoctors.length > 0 && (
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {filteredDoctors.map((doctor) => {
                  const style = getSpecialtyStyle(doctor.specialty);
                  const Icon = style.icon;

                  return (
                    <Card
                      key={doctor.id}
                      className="flex flex-col border border-border/80 bg-slate-900/40 hover:bg-slate-900/80 transition-all duration-200 hover:border-slate-700 shadow-sm rounded-xl overflow-hidden"
                    >
                      {/* Cabecera con identidad de especialidad */}
                      <div className="p-5 pb-3 border-b border-border/50 bg-slate-950/40 flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={`size-12 rounded-xl flex items-center justify-center font-bold text-base border shrink-0 ${style.avatarBg}`}
                          >
                            {initials(doctor.full_name)}
                          </div>
                          <div>
                            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
                              {style.areaLabel}
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <h2 className="text-lg font-bold text-white tracking-tight leading-snug">
                                {doctor.full_name}
                              </h2>
                              <CheckCircle2
                                className="size-4 shrink-0 text-emerald-400"
                                aria-label="Profesional verificado"
                              />
                            </div>
                          </div>
                        </div>

                        <Badge
                          variant="outline"
                          onClick={() => handleSpecialtyChange(doctor.specialty)}
                          className={`gap-1.5 py-1 px-2.5 cursor-pointer shrink-0 transition-colors ${style.badgeClass}`}
                          title={`Filtrar por ${doctor.specialty}`}
                        >
                          <Icon className="size-3.5" />
                          {doctor.specialty}
                        </Badge>
                      </div>

                      {/* Descripción y Registro Médico */}
                      <CardContent className="flex flex-1 flex-col p-5">
                        <p className="line-clamp-3 text-sm text-slate-300 leading-relaxed min-h-[4.2rem]">
                          {doctor.bio || "Profesional de la salud enfocado en la atención médica integral y personalizada."}
                        </p>

                        <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                          <ShieldCheck className="size-3.5 text-slate-500" />
                          <span>Registro: {doctor.license_number || "Acreditado SIS"}</span>
                        </div>

                        {/* Pie de tarjeta con arancel y botón de agenda */}
                        <div className="mt-auto pt-4 border-t border-border/60 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                              Valor consulta
                            </p>
                            <p className="text-lg font-extrabold text-white">
                              {formatFeeCLP(doctor.consultation_fee)}
                            </p>
                          </div>

                          <Button asChild size="sm" className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
                            <Link
                              to="/buscar-citas"
                              search={{
                                doctor: doctor.id,
                                specialty: doctor.specialty,
                              }}
                            >
                              <CalendarPlus className="size-4" />
                              Agendar cita
                            </Link>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
