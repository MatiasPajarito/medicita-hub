import { useMemo, useState } from "react";
import {
  ArrowUpDown,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Coins,
  Filter,
  MapPin,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Video,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { defaultCities, formatFeeCLP, type DoctorSortOption } from "@/lib/doctor-filter";

export interface DoctorFilterBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  specialty: string;
  onSpecialtyChange: (value: string) => void;
  availableSpecialties: string[];
  specialtyCounts?: Record<string, number>;
  // City filter (Req #4)
  city?: string;
  onCityChange?: (value: string) => void;
  availableCities?: string[];
  cityCounts?: Record<string, number>;
  maxFee?: number | undefined;
  onMaxFeeChange: (value: number | undefined) => void;
  maxAvailableFee?: number;
  minAvailableFee?: number;
  sortBy: DoctorSortOption;
  onSortByChange: (value: DoctorSortOption) => void;
  onReset: () => void;
  totalResults: number;
  totalDoctors: number;
  // Optional modality filter
  modality?: string;
  onModalityChange?: (value: string) => void;
  showModalityFilter?: boolean;
  // Optional date filter
  date?: string;
  onDateChange?: (value: string) => void;
  showDateFilter?: boolean;
}

const feePresets = [
  { label: "Cualquier tarifa", value: undefined },
  { label: "Hasta $25.000", value: 25000 },
  { label: "Hasta $35.000", value: 35000 },
  { label: "Hasta $50.000", value: 50000 },
  { label: "Hasta $70.000", value: 70000 },
];

export function DoctorFilterBar({
  searchTerm,
  onSearchChange,
  specialty,
  onSpecialtyChange,
  availableSpecialties,
  specialtyCounts = {},
  city = "all",
  onCityChange,
  availableCities = [...defaultCities],
  cityCounts = {},
  maxFee,
  onMaxFeeChange,
  maxAvailableFee = 100000,
  minAvailableFee = 0,
  sortBy,
  onSortByChange,
  onReset,
  totalResults,
  totalDoctors,
  modality = "todas",
  onModalityChange,
  showModalityFilter = false,
  date = "",
  onDateChange,
  showDateFilter = false,
}: DoctorFilterBarProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Calculate count of active advanced filters
  const activeAdvancedCount = useMemo(() => {
    let count = 0;
    if (maxFee !== undefined && maxFee < maxAvailableFee) count += 1;
    if (sortBy !== "default") count += 1;
    if (showModalityFilter && modality !== "todas") count += 1;
    if (showDateFilter && date) count += 1;
    return count;
  }, [maxFee, maxAvailableFee, sortBy, showModalityFilter, modality, showDateFilter, date]);

  const hasAnyFilterActive = useMemo(() => {
    return (
      (specialty !== "all" && specialty !== "todas") ||
      (city !== "all" && city !== "todas") ||
      Boolean(searchTerm.trim()) ||
      (maxFee !== undefined && maxFee < maxAvailableFee) ||
      sortBy !== "default" ||
      (showModalityFilter && modality !== "todas") ||
      (showDateFilter && Boolean(date))
    );
  }, [
    specialty,
    city,
    searchTerm,
    maxFee,
    maxAvailableFee,
    sortBy,
    showModalityFilter,
    modality,
    showDateFilter,
    date,
  ]);

  const sliderUpperLimit = Math.max(maxAvailableFee, 100000);

  return (
    <div className="mb-8 space-y-4">
      {/* Primary search bar, specialty select & city select */}
      <Card className="border-border shadow-sm">
        <CardContent className="p-4 sm:p-5">
          <div className="grid gap-3 md:grid-cols-[1.4fr_1.1fr_1fr_auto_auto]">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Buscar por nombre, especialidad, ciudad o biografía…"
                className="h-11 pl-10 pr-9 bg-background"
                aria-label="Buscar profesionales"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => onSearchChange("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Borrar búsqueda"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            {/* Specialty Select */}
            <div>
              <Select value={specialty} onValueChange={onSpecialtyChange}>
                <SelectTrigger className="h-11 bg-background" aria-label="Filtrar por especialidad">
                  <SelectValue placeholder="Todas las especialidades" />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="all">Todas las especialidades ({totalDoctors})</SelectItem>
                  {availableSpecialties.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s} {specialtyCounts[s] ? `(${specialtyCounts[s]})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* City / Comuna Select (Req #4) */}
            <div>
              <Select
                value={city}
                onValueChange={(val) => {
                  if (onCityChange) onCityChange(val);
                }}
              >
                <SelectTrigger
                  className="h-11 bg-background flex flex-row items-center justify-between gap-2"
                  aria-label="Filtrar por ciudad o comuna"
                >
                  <div className="flex flex-row items-center gap-2 truncate">
                    <MapPin className="size-4 shrink-0 text-primary" />
                    <SelectValue placeholder="Todas las ciudades" />
                  </div>
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="all">Todas las ciudades</SelectItem>
                  {availableCities.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c} {cityCounts[c] ? `(${cityCounts[c]})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Toggle Advanced Filters Button */}
            <Button
              type="button"
              variant={showAdvanced || activeAdvancedCount > 0 ? "secondary" : "outline"}
              className="h-11 gap-2"
              onClick={() => setShowAdvanced((prev) => !prev)}
              aria-expanded={showAdvanced}
              aria-label="Filtros avanzados"
            >
              <SlidersHorizontal className="size-4" />
              <span>Filtros</span>
              {activeAdvancedCount > 0 && (
                <Badge variant="default" className="ml-1 size-5 p-0 justify-center text-xs">
                  {activeAdvancedCount}
                </Badge>
              )}
              {showAdvanced ? (
                <ChevronUp className="size-3.5 opacity-70" />
              ) : (
                <ChevronDown className="size-3.5 opacity-70" />
              )}
            </Button>

            {/* Reset Button */}
            {hasAnyFilterActive && (
              <Button
                type="button"
                variant="ghost"
                className="h-11 text-muted-foreground hover:text-foreground gap-1.5"
                onClick={onReset}
                title="Limpiar todos los filtros"
              >
                <RotateCcw className="size-4" />
                <span className="hidden sm:inline">Limpiar</span>
              </Button>
            )}
          </div>

          {/* Quick Specialty Pills */}
          <div className="mt-4 pt-4 border-t border-border/60">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-sm scrollbar-none">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mr-1 shrink-0">
                Especialidad:
              </span>
              <button
                type="button"
                onClick={() => onSpecialtyChange("all")}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  specialty === "all" || specialty === "todas"
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                Todas
                <span className="opacity-80">({totalDoctors})</span>
              </button>

              {availableSpecialties.map((s) => {
                const isSelected = specialty.toLowerCase() === s.toLowerCase();
                const count = specialtyCounts[s] ?? 0;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onSpecialtyChange(isSelected ? "all" : s)}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      isSelected
                        ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    }`}
                  >
                    {s}
                    {count > 0 && <span className="opacity-80">({count})</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Advanced Filters Collapsible Section */}
      {showAdvanced && (
        <Card className="border-primary/20 bg-card/60 shadow-xs animate-in fade-in-50 duration-200">
          <CardContent className="p-5 sm:p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <Filter className="size-4 text-primary" />
                <span>Opciones avanzadas de búsqueda y orden</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onMaxFeeChange(undefined);
                  onSortByChange("default");
                  if (onModalityChange) onModalityChange("todas");
                  if (onDateChange) onDateChange("");
                }}
                className="text-xs text-muted-foreground hover:text-foreground h-8"
              >
                Restablecer opciones avanzadas
              </Button>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {/* Order / Sort Selector */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <ArrowUpDown className="size-3.5 text-primary" />
                  Ordenar resultados
                </Label>
                <Select
                  value={sortBy}
                  onValueChange={(val) => onSortByChange(val as DoctorSortOption)}
                >
                  <SelectTrigger className="h-10 bg-background">
                    <SelectValue placeholder="Ordenar por…" />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectItem value="default">Relevancia clínica (por defecto)</SelectItem>
                    <SelectItem value="name-asc">Nombre: A → Z</SelectItem>
                    <SelectItem value="name-desc">Nombre: Z → A</SelectItem>
                    <SelectItem value="fee-asc">Tarifa: Menor a Mayor</SelectItem>
                    <SelectItem value="fee-desc">Tarifa: Mayor a Menor</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Modality Filter (if enabled) */}
              {showModalityFilter && onModalityChange && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <Video className="size-3.5 text-primary" />
                    Modalidad de atención
                  </Label>
                  <Select value={modality} onValueChange={onModalityChange}>
                    <SelectTrigger className="h-10 bg-background">
                      <SelectValue placeholder="Todas las modalidades" />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectItem value="todas">Todas las modalidades</SelectItem>
                      <SelectItem value="presencial">Solo Presencial</SelectItem>
                      <SelectItem value="telemedicina">Solo Telemedicina</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Date Filter (if enabled) */}
              {showDateFilter && onDateChange && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <Calendar className="size-3.5 text-primary" />
                    Fecha preferida
                  </Label>
                  <Input
                    type="date"
                    value={date}
                    onChange={(e) => onDateChange(e.target.value)}
                    className="h-10 bg-background"
                  />
                </div>
              )}

              {/* Consultation Fee Filter */}
              <div className="space-y-3 sm:col-span-2 lg:col-span-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <Coins className="size-3.5 text-primary" />
                    Tarifa máxima de consulta
                  </Label>
                  <span className="text-sm font-bold text-primary">
                    {maxFee !== undefined && maxFee < sliderUpperLimit
                      ? `Hasta ${formatFeeCLP(maxFee)}`
                      : "Sin límite de tarifa"}
                  </span>
                </div>

                {/* Slider */}
                <div className="pt-2 pb-1">
                  <Slider
                    value={[maxFee ?? sliderUpperLimit]}
                    min={minAvailableFee}
                    max={sliderUpperLimit}
                    step={5000}
                    onValueChange={([val]) => {
                      if (val && val < sliderUpperLimit) {
                        onMaxFeeChange(val);
                      } else {
                        onMaxFeeChange(undefined);
                      }
                    }}
                    className="py-2"
                  />
                </div>

                {/* Preset Chips */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {feePresets.map((preset) => {
                    const isSelected =
                      (preset.value === undefined &&
                        (maxFee === undefined || maxFee >= sliderUpperLimit)) ||
                      preset.value === maxFee;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => onMaxFeeChange(preset.value)}
                        className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs transition-colors ${
                          isSelected
                            ? "bg-primary/15 text-primary border border-primary/30 font-medium"
                            : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent"
                        }`}
                      >
                        {isSelected && <Check className="size-3" />}
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Filters Badges & Result Summary */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-foreground">
            {totalResults}{" "}
            {totalResults === 1 ? "profesional encontrado" : "profesionales encontrados"}
          </p>
          {totalResults < totalDoctors && (
            <span className="text-xs text-muted-foreground">(de un total de {totalDoctors})</span>
          )}
        </div>

        {/* Active badges */}
        {hasAnyFilterActive && (
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Search query badge */}
            {searchTerm.trim() && (
              <Badge variant="secondary" className="gap-1 pl-2.5 pr-1.5 py-1 font-normal">
                Texto: <strong className="font-semibold">"{searchTerm.trim()}"</strong>
                <button
                  type="button"
                  onClick={() => onSearchChange("")}
                  className="rounded-full hover:bg-muted p-0.5"
                  aria-label="Quitar filtro de búsqueda"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            )}

            {/* Specialty badge */}
            {specialty !== "all" && specialty !== "todas" && (
              <Badge variant="secondary" className="gap-1 pl-2.5 pr-1.5 py-1 font-normal">
                Especialidad: <strong className="font-semibold">{specialty}</strong>
                <button
                  type="button"
                  onClick={() => onSpecialtyChange("all")}
                  className="rounded-full hover:bg-muted p-0.5"
                  aria-label="Quitar filtro de especialidad"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            )}

            {/* City badge */}
            {city !== "all" && city !== "todas" && onCityChange && (
              <Badge variant="secondary" className="gap-1 pl-2.5 pr-1.5 py-1 font-normal">
                Ciudad: <strong className="font-semibold">{city}</strong>
                <button
                  type="button"
                  onClick={() => onCityChange("all")}
                  className="rounded-full hover:bg-muted p-0.5"
                  aria-label="Quitar filtro de ciudad"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            )}

            {/* Max fee badge */}
            {maxFee !== undefined && maxFee < sliderUpperLimit && (
              <Badge variant="secondary" className="gap-1 pl-2.5 pr-1.5 py-1 font-normal">
                Tarifa: <strong className="font-semibold">≤ {formatFeeCLP(maxFee)}</strong>
                <button
                  type="button"
                  onClick={() => onMaxFeeChange(undefined)}
                  className="rounded-full hover:bg-muted p-0.5"
                  aria-label="Quitar filtro de tarifa"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            )}

            {/* Sort badge */}
            {sortBy !== "default" && (
              <Badge variant="secondary" className="gap-1 pl-2.5 pr-1.5 py-1 font-normal">
                Orden:{" "}
                <strong className="font-semibold">
                  {sortBy === "name-asc"
                    ? "Nombre A-Z"
                    : sortBy === "name-desc"
                      ? "Nombre Z-A"
                      : sortBy === "fee-asc"
                        ? "Menor precio"
                        : "Mayor precio"}
                </strong>
                <button
                  type="button"
                  onClick={() => onSortByChange("default")}
                  className="rounded-full hover:bg-muted p-0.5"
                  aria-label="Restablecer orden"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            )}

            {/* Modality badge */}
            {showModalityFilter && onModalityChange && modality !== "todas" && (
              <Badge variant="secondary" className="gap-1 pl-2.5 pr-1.5 py-1 font-normal">
                Modalidad:{" "}
                <strong className="font-semibold">
                  {modality === "presencial" ? "Presencial" : "Telemedicina"}
                </strong>
                <button
                  type="button"
                  onClick={() => onModalityChange("todas")}
                  className="rounded-full hover:bg-muted p-0.5"
                  aria-label="Quitar filtro de modalidad"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            )}

            {/* Date badge */}
            {showDateFilter && onDateChange && date && (
              <Badge variant="secondary" className="gap-1 pl-2.5 pr-1.5 py-1 font-normal">
                Fecha: <strong className="font-semibold">{date}</strong>
                <button
                  type="button"
                  onClick={() => onDateChange("")}
                  className="rounded-full hover:bg-muted p-0.5"
                  aria-label="Quitar filtro de fecha"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            )}

            {/* Clear all link */}
            <Button
              variant="link"
              size="sm"
              onClick={onReset}
              className="h-7 text-xs text-muted-foreground hover:text-destructive px-1"
            >
              Limpiar todo
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
