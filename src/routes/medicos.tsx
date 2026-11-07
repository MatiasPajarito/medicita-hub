import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  CalendarPlus,
  CheckCircle2,
  RotateCcw,
  SearchX,
  Stethoscope,
  UserRound,
} from "lucide-react";
import { PageHeading } from "@/components/medicita/page-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DoctorFilterBar } from "@/components/medicita/doctor-filters";
import { listDoctors } from "@/lib/clinical.functions";
import { specialties as clinicalSpecialties } from "@/lib/clinical-schemas";
import {
  filterAndSortDoctors,
  formatFeeCLP,
  getSpecialtyCounts,
  type DoctorSortOption,
} from "@/lib/doctor-filter";

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

function DoctorsDirectory() {
  const fetchDoctors = useServerFn(listDoctors);
  const doctors = useQuery({
    queryKey: ["doctors"],
    queryFn: () => fetchDoctors(),
  });
  const searchParams = Route.useSearch();
  const navigate = useNavigate();

  // Search & Filter state initialized from URL params
  const [searchTerm, setSearchTerm] = useState(searchParams.search ?? "");
  const [specialty, setSpecialty] = useState(searchParams.specialty ?? "all");
  const [maxFee, setMaxFee] = useState<number | undefined>(searchParams.maxPrice);
  const [sortBy, setSortBy] = useState<DoctorSortOption>(searchParams.sort ?? "default");

  const rawDoctors = useMemo(() => doctors.data ?? [], [doctors.data]);

  // Compute available specialties dynamically from active doctors, combined with standard list
  const availableSpecialties = useMemo(() => {
    const fromData = rawDoctors.map((d) => d.specialty).filter(Boolean);
    const combined = Array.from(new Set([...fromData, ...clinicalSpecialties]));
    return combined.sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  }, [rawDoctors]);

  // Compute doctor count per specialty
  const specialtyCounts = useMemo(() => {
    return getSpecialtyCounts(rawDoctors);
  }, [rawDoctors]);

  // Fee boundaries for slider
  const { minAvailableFee, maxAvailableFee } = useMemo(() => {
    if (rawDoctors.length === 0) return { minAvailableFee: 0, maxAvailableFee: 100000 };
    const fees = rawDoctors.map((d) => d.consultation_fee);
    return {
      minAvailableFee: Math.min(...fees),
      maxAvailableFee: Math.max(...fees),
    };
  }, [rawDoctors]);

  // Filtered and sorted doctors
  const filteredDoctors = useMemo(() => {
    return filterAndSortDoctors(rawDoctors, {
      searchTerm,
      specialty,
      maxFee,
      sortBy,
    });
  }, [rawDoctors, searchTerm, specialty, maxFee, sortBy]);

  // Clear all filters
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

  // Handle specialty pill click
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
        {/* Loading state */}
        {doctors.isLoading && (
          <div className="py-12 text-center">
            <div className="mx-auto size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="mt-4 text-sm text-muted-foreground">
              Cargando directorio de profesionales…
            </p>
          </div>
        )}

        {/* Error state */}
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

        {/* Loaded view with Filter Bar & Grid */}
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

            {/* Empty state: No matching results */}
            {filteredDoctors.length === 0 && rawDoctors.length > 0 && (
              <Card className="border-dashed border-border/80 bg-surface-subtle p-8 text-center sm:p-12">
                <SearchX className="mx-auto size-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-bold text-foreground">
                  No se encontraron profesionales coincidentes
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                  No hay médicos que coincidan con los filtros aplicados. Intenta ampliar tus
                  términos de búsqueda o restablecer los filtros.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <Button onClick={handleResetFilters} variant="default" className="gap-2">
                    <RotateCcw className="size-4" />
                    Restablecer filtros
                  </Button>
                  {specialty !== "all" && (
                    <Button onClick={() => handleSpecialtyChange("all")} variant="outline">
                      Ver todas las especialidades
                    </Button>
                  )}
                </div>
              </Card>
            )}

            {/* Empty state: No doctors in database at all */}
            {rawDoctors.length === 0 && (
              <div className="py-20 text-center">
                <Stethoscope className="mx-auto size-12 text-muted-foreground" />
                <h2 className="mt-4 text-xl font-bold">Aún no hay profesionales disponibles</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  El equipo médico se encuentra en proceso de incorporación.
                </p>
              </div>
            )}

            {/* Doctor cards grid */}
            {filteredDoctors.length > 0 && (
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {filteredDoctors.map((doctor) => (
                  <Card
                    key={doctor.id}
                    className="flex flex-col overflow-hidden border-border/80 shadow-xs transition-all hover:shadow-clinical"
                  >
                    {/* Header Image or Avatar */}
                    <div className="relative aspect-[16/10] bg-clinical-soft">
                      {doctor.photo_url ? (
                        <img
                          src={doctor.photo_url}
                          alt={doctor.full_name}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center gap-2 text-primary/40">
                          <UserRound className="size-16" />
                          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            {initials(doctor.full_name)}
                          </span>
                        </div>
                      )}
                      <div className="absolute top-3 right-3">
                        <button
                          type="button"
                          onClick={() => handleSpecialtyChange(doctor.specialty)}
                          title={`Filtrar por ${doctor.specialty}`}
                        >
                          <Badge
                            variant="secondary"
                            className="bg-background/90 backdrop-blur shadow-xs hover:bg-background transition-colors cursor-pointer"
                          >
                            {doctor.specialty}
                          </Badge>
                        </button>
                      </div>
                    </div>

                    {/* Content */}
                    <CardContent className="flex flex-1 flex-col p-5">
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold text-foreground">{doctor.full_name}</h2>
                        <CheckCircle2
                          className="size-4 shrink-0 text-success"
                          title="Profesional verificado"
                        />
                      </div>

                      <p className="mt-2 line-clamp-3 min-h-[4.5rem] text-sm leading-6 text-muted-foreground">
                        {doctor.bio}
                      </p>

                      <div className="mt-auto pt-5 border-t border-border/60 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">
                            Valor consulta
                          </p>
                          <p className="text-base font-extrabold text-foreground">
                            {formatFeeCLP(doctor.consultation_fee)}
                          </p>
                        </div>

                        <Button asChild className="gap-2">
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
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
