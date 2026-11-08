import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CalendarPlus, CheckCircle2, RotateCcw, SearchX, Stethoscope } from "lucide-react";
import { PageHeading } from "@/components/medicita/page-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BookingDialog } from "@/components/medicita/booking-dialog";
import { DoctorFilterBar } from "@/components/medicita/doctor-filters";
import type { PublicDoctor } from "@/lib/booking";
import { fetchPublicDoctors } from "@/lib/doctors";
import { specialties as clinicalSpecialties } from "@/lib/clinical-schemas";
import {
  filterAndSortDoctors,
  formatFeeCLP,
  getSpecialtyCounts,
  type DoctorSortOption,
} from "@/lib/doctor-filter";

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
  head: () => ({
    meta: [
      { title: "Buscar citas — MediCita" },
      {
        name: "description",
        content:
          "Busca profesionales de salud por especialidad, modalidad, tarifa y fecha con filtros avanzados.",
      },
      { property: "og:title", content: "Buscar citas — MediCita" },
      { property: "og:description", content: "Encuentra una hora médica disponible." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SearchAppointments,
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

function SearchAppointments() {
  const doctors = useQuery({ queryKey: ["doctors"], queryFn: fetchPublicDoctors });
  const searchParams = Route.useSearch();
  const navigate = useNavigate();

  // Filter state initialized from URL
  const [searchTerm, setSearchTerm] = useState(searchParams.search ?? "");
  const [specialty, setSpecialty] = useState(searchParams.specialty ?? "all");
  const [date, setDate] = useState(searchParams.date ?? "");
  const [modality, setModality] = useState(searchParams.modality ?? "todas");
  const [maxFee, setMaxFee] = useState<number | undefined>(searchParams.maxPrice);
  const [sortBy, setSortBy] = useState<DoctorSortOption>(searchParams.sort ?? "default");

  // Booking dialog selection state
  const [selected, setSelected] = useState<PublicDoctor | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const rawDoctors = useMemo(() => doctors.data ?? [], [doctors.data]);

  // Active doctor for booking
  const bookingDoctor =
    selected ??
    (!dismissed && searchParams.doctor
      ? (rawDoctors.find((d) => d.id === searchParams.doctor) ?? null)
      : null);

  // Available specialties combined
  const availableSpecialties = useMemo(() => {
    const fromData = rawDoctors.map((d) => d.specialty).filter(Boolean);
    const combined = Array.from(new Set([...fromData, ...clinicalSpecialties]));
    return combined.sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  }, [rawDoctors]);

  // Doctor count per specialty
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

  // Reset all filters
  function handleResetFilters() {
    setSearchTerm("");
    setSpecialty("all");
    setDate("");
    setModality("todas");
    setMaxFee(undefined);
    setSortBy("default");
    void navigate({
      to: "/buscar-citas",
      search: {},
      replace: true,
    });
  }

  // Handle specialty change
  function handleSpecialtyChange(newSpecialty: string) {
    setSpecialty(newSpecialty);
    void navigate({
      to: "/buscar-citas",
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
        eyebrow="Agenda clínica"
        title="Encuentra una hora médica"
        description="Filtra por especialidad, profesional, modalidad y tarifa para agendar tu atención."
      />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Loading state */}
        {doctors.isLoading && (
          <div className="py-12 text-center">
            <div className="mx-auto size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="mt-4 text-sm text-muted-foreground">
              Cargando profesionales disponibles…
            </p>
          </div>
        )}

        {/* Error state */}
        {doctors.isError && (
          <Card className="border-destructive/40 bg-destructive/10 p-6 text-center">
            <p className="font-semibold text-destructive">
              No pudimos cargar los profesionales de salud.
            </p>
            {/* Diagnóstico temporal: quitar cuando se resuelva */}
            <p className="mt-2 break-words text-xs text-muted-foreground">
              {doctors.error instanceof Error ? doctors.error.message : String(doctors.error)}
            </p>
            <Button variant="outline" size="sm" onClick={() => doctors.refetch()} className="mt-4">
              Reintentar
            </Button>
          </Card>
        )}

        {/* Filter Bar & Results */}
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
              showModalityFilter={true}
              modality={modality}
              onModalityChange={setModality}
              showDateFilter={true}
              date={date}
              onDateChange={setDate}
            />

            {/* Empty state */}
            {filteredDoctors.length === 0 && rawDoctors.length > 0 && (
              <Card className="border-dashed border-border/80 bg-surface-subtle p-8 text-center sm:p-12">
                <SearchX className="mx-auto size-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-bold text-foreground">
                  No hay profesionales que coincidan con tu búsqueda
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                  Prueba modificando la especialidad, la tarifa máxima o los términos de búsqueda.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <Button onClick={handleResetFilters} variant="default" className="gap-2">
                    <RotateCcw className="size-4" />
                    Restablecer filtros
                  </Button>
                </div>
              </Card>
            )}

            {/* Empty state: No doctors in system */}
            {rawDoctors.length === 0 && (
              <div className="py-20 text-center">
                <Stethoscope className="mx-auto size-12 text-muted-foreground" />
                <p className="mt-3 font-semibold">Aún no hay profesionales registrados.</p>
              </div>
            )}

            {/* Doctor list cards */}
            <div className="grid gap-4">
              {filteredDoctors.map((doctor) => (
                <Card
                  key={doctor.id}
                  className="border-border/80 shadow-xs transition-all hover:border-primary/40 hover:shadow-clinical"
                >
                  <CardContent className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-center">
                    <div className="flex flex-col sm:flex-row gap-4">
                      {doctor.photo_url ? (
                        <img
                          src={doctor.photo_url}
                          alt={doctor.full_name}
                          className="size-16 shrink-0 rounded-full object-cover border border-border"
                          loading="lazy"
                        />
                      ) : (
                        <span className="flex size-16 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-clinical-soft text-base font-bold text-primary">
                          {initials(doctor.full_name)}
                        </span>
                      )}

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-lg font-bold text-foreground">{doctor.full_name}</h2>
                          <CheckCircle2 className="size-4 text-success" aria-label="Verificado" />
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSpecialtyChange(doctor.specialty)}
                            className="inline-block"
                          >
                            <Badge
                              variant="secondary"
                              className="hover:bg-secondary/80 cursor-pointer"
                            >
                              {doctor.specialty}
                            </Badge>
                          </button>
                          <span className="text-sm font-semibold text-primary">
                            {formatFeeCLP(doctor.consultation_fee)}{" "}
                            <span className="text-xs font-normal text-muted-foreground">
                              / consulta
                            </span>
                          </span>
                        </div>

                        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                          {doctor.bio}
                        </p>
                      </div>
                    </div>

                    <div className="flex sm:justify-end">
                      <Button
                        onClick={() => setSelected(doctor)}
                        size="lg"
                        className="w-full sm:w-auto gap-2"
                      >
                        <CalendarPlus className="size-4" />
                        Agendar cita
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
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
