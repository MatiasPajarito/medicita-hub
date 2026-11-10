import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
  MapPin,
  ShieldCheck,
} from "lucide-react";
import { BookingDialog } from "@/components/medicita/booking-dialog";
import { PageHeading } from "@/components/medicita/page-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DoctorFilterBar } from "@/components/medicita/doctor-filters";
import type { PublicDoctor } from "@/lib/booking";
import { specialties as clinicalSpecialties } from "@/lib/clinical-schemas";
import {
  defaultCities,
  filterAndSortDoctors,
  formatFeeCLP,
  getCityCounts,
  getSpecialtyCounts,
  type DoctorSortOption,
} from "@/lib/doctor-filter";
import { supabase } from "@/lib/supabase";

interface RawDoctor {
  id: string;
  full_name: string;
  specialty: string;
  city?: string | null;
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
    doctor?: string | undefined;
    specialty?: string | undefined;
    city?: string | undefined;
    search?: string | undefined;
    date?: string | undefined;
    modality?: string | undefined;
    maxPrice?: number | undefined;
    sort?: DoctorSortOption | undefined;
  } => ({
    doctor: typeof s["doctor"] === "string" ? s["doctor"] : undefined,
    specialty: typeof s["specialty"] === "string" ? s["specialty"] : undefined,
    city: typeof s["city"] === "string" ? s["city"] : undefined,
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
  head: () => ({
    meta: [
      { title: "Profesionales médicos — MediCita" },
      {
        name: "description",
        content:
          "Busca y filtra profesionales médicos por especialidad, ciudad, tarifa y nombre para agendar tu próxima atención.",
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
    .select("*")
    .order("full_name", { ascending: true });

  if (error) throw error;

  return (data || []).map((doc: RawDoctor) => ({
    ...doc,
    city: doc.city?.trim() || "Santiago",
    consultation_fee: Number(doc.price || doc.consultation_fee || 0),
  }));
}

function DoctorsDirectory() {
  const doctors = useQuery({
    queryKey: ["doctors", "directory"],
    queryFn: fetchDoctorsFromSupabase,
  });

  const searchParams = Route.useSearch();
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState(searchParams.search ?? "");
  const [specialty, setSpecialty] = useState(searchParams.specialty ?? "all");
  const [city, setCity] = useState(searchParams.city ?? "all");
  const [date, setDate] = useState(searchParams.date ?? "");
  const [modality, setModality] = useState(searchParams.modality ?? "todas");
  const [maxFee, setMaxFee] = useState<number | undefined>(searchParams.maxPrice);
  const [sortBy, setSortBy] = useState<DoctorSortOption>(searchParams.sort ?? "default");
  const [selected, setSelected] = useState<PublicDoctor | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const rawDoctors = useMemo(() => doctors.data ?? [], [doctors.data]);

  const bookingDoctor = useMemo<PublicDoctor | null>(() => {
    if (selected) return selected;
    if (!dismissed && searchParams.doctor) {
      const found = rawDoctors.find((d) => d.id === searchParams.doctor);
      if (found) {
        return {
          id: found.id,
          full_name: found.full_name,
          specialty: found.specialty,
          city: found.city,
          bio: found.bio ?? "",
          photo_url: null,
          consultation_fee: found.consultation_fee,
        };
      }
    }
    return null;
  }, [selected, dismissed, searchParams.doctor, rawDoctors]);

  const availableSpecialties = useMemo(() => {
    const fromData = rawDoctors.map((d) => d.specialty).filter(Boolean);
    const combined = Array.from(new Set([...fromData, ...clinicalSpecialties]));
    return combined.sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  }, [rawDoctors]);

  const availableCities = useMemo(() => {
    const fromData = rawDoctors
      .map((d) => d.city?.trim())
      .filter((c): c is string => Boolean(c));
    const combined = Array.from(new Set([...defaultCities, ...fromData]));
    return combined.sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  }, [rawDoctors]);

  const specialtyCounts = useMemo(() => {
    return getSpecialtyCounts(rawDoctors);
  }, [rawDoctors]);

  const cityCounts = useMemo(() => {
    return getCityCounts(rawDoctors);
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
      city,
      maxFee,
      sortBy,
    });
  }, [rawDoctors, searchTerm, specialty, city, maxFee, sortBy]);

  function handleResetFilters() {
    setSearchTerm("");
    setSpecialty("all");
    setCity("all");
    setDate("");
    setModality("todas");
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

  function handleCityChange(newCity: string) {
    setCity(newCity);
    void navigate({
      to: "/medicos",
      search: (prev) => ({
        ...prev,
        city: newCity === "all" ? undefined : newCity,
      }),
      replace: true,
    });
  }

  return (
    <>
      <PageHeading
        eyebrow="Directorio clínico"
        title="Profesionales médicos"
        description="Encuentra al especialista adecuado mediante búsqueda inteligente y filtros avanzados por especialidad, ciudad y tarifa."
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
              city={city}
              onCityChange={handleCityChange}
              availableCities={availableCities}
              cityCounts={cityCounts}
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
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 auto-rows-fr">
                {filteredDoctors.map((doctor) => {
                  const style = getSpecialtyStyle(doctor.specialty);
                  const Icon = style.icon;

                  return (
                    <Card
                      key={doctor.id}
                      className="flex flex-col h-full border border-border/80 bg-slate-900/40 hover:bg-slate-900/80 transition-all duration-200 hover:border-slate-700 shadow-sm rounded-xl overflow-hidden"
                    >
                      {/* Cabecera simétrica con altura uniforme */}
                      <div className="p-5 pb-4 border-b border-border/50 bg-slate-950/40">
                        <div className="flex items-start justify-between gap-3 min-h-[58px]">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div
                              className={`size-12 rounded-xl flex items-center justify-center font-bold text-sm border shrink-0 ${style.avatarBg}`}
                            >
                              {initials(doctor.full_name)}
                            </div>

                            <div className="min-w-0 flex-1">
                              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block truncate">
                                {style.areaLabel}
                              </span>
                              <div className="h-[46px] flex items-center mt-0.5">
                                <h2 className="text-base font-bold text-white tracking-tight leading-snug line-clamp-2">
                                  {doctor.full_name}
                                </h2>
                                <CheckCircle2
                                  className="size-4 shrink-0 text-emerald-400 ml-1.5 inline-block"
                                  aria-label="Profesional verificado"
                                />
                              </div>
                            </div>
                          </div>

                          <Badge
                            variant="outline"
                            onClick={() => handleSpecialtyChange(doctor.specialty)}
                            className={`gap-1.5 py-1 px-2.5 cursor-pointer shrink-0 transition-colors whitespace-nowrap ${style.badgeClass}`}
                            title={`Filtrar por ${doctor.specialty}`}
                          >
                            <Icon className="size-3.5" />
                            {doctor.specialty}
                          </Badge>
                        </div>
                      </div>

                      {/* Cuerpo de tarjeta nivelado */}
                      <CardContent className="flex flex-1 flex-col p-5 pt-4">
                        <div className="h-[66px] flex items-start">
                          <p className="line-clamp-3 text-xs leading-relaxed text-slate-300">
                            {doctor.bio ||
                              "Profesional de la salud enfocado en la atención médica integral y personalizada."}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 mt-2 mb-4">
                          <span className="flex items-center gap-1.5 truncate">
                            <ShieldCheck className="size-3.5 text-slate-500 shrink-0" />
                            <span className="truncate">
                              Registro: {doctor.license_number || "Acreditado SIS"}
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCityChange(doctor.city || "Santiago")}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-700/80 bg-slate-800/60 px-2 py-0.5 text-[11px] font-medium text-slate-300 transition-colors hover:border-primary/40 hover:text-primary cursor-pointer"
                            title={`Filtrar por ${doctor.city || "Santiago"}`}
                          >
                            <MapPin className="size-3 text-primary" />
                            {doctor.city || "Santiago"}
                          </button>
                        </div>

                        {/* Pie con precio y botón de reserva alineados al fondo */}
                        <div className="mt-auto pt-4 border-t border-border/60 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                              Valor consulta
                            </p>
                            <p className="text-lg font-extrabold text-white leading-tight">
                              {formatFeeCLP(doctor.consultation_fee)}
                            </p>
                          </div>

                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              setDismissed(false);
                              setSelected({
                                id: doctor.id,
                                full_name: doctor.full_name,
                                specialty: doctor.specialty,
                                city: doctor.city,
                                bio: doctor.bio ?? "",
                                photo_url: null,
                                consultation_fee: doctor.consultation_fee,
                              });
                            }}
                            className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium shrink-0"
                          >
                            <CalendarPlus className="size-4" />
                            Agendar cita
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

      <BookingDialog
        doctor={bookingDoctor}
        initialDate={date || searchParams.date}
        initialModality={modality !== "todas" ? modality : searchParams.modality}
        onClose={() => {
          setSelected(null);
          setDismissed(true);
        }}
      />
    </>
  );
}
