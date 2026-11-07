import type { PublicDoctor } from "@/lib/booking";

export type DoctorSortOption = "default" | "name-asc" | "name-desc" | "fee-asc" | "fee-desc";

export interface DoctorFilterOptions {
  searchTerm?: string;
  specialty?: string;
  maxFee?: number;
  minFee?: number;
  sortBy?: DoctorSortOption;
}

/**
 * Normalizes text for search and filtering:
 * Strips diacritics / accents, converts to lowercase, and trims whitespace.
 */
export function normalizeText(text: string): string {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Removes medical prefixes (Dr., Dra., Doctor, Doctora) for clean alphabetical sorting.
 */
export function cleanNameForSorting(name: string): string {
  return name.replace(/^(dra?\.?|doctora?)\s+/i, "").trim();
}

/**
 * Checks if a doctor's specialty matches the target specialty.
 * Handles "all", "todas", case-insensitivity, and accent-insensitivity.
 */
export function matchesSpecialty(doctor: { specialty: string }, targetSpecialty?: string): boolean {
  if (!targetSpecialty || targetSpecialty === "all" || targetSpecialty === "todas") {
    return true;
  }
  return normalizeText(doctor.specialty) === normalizeText(targetSpecialty);
}

/**
 * Checks if a doctor matches a free-text search query.
 * Matches multi-term tokens against doctor's full_name, specialty, and bio.
 */
export function matchesSearchTerm(
  doctor: { full_name: string; specialty: string; bio?: string | null },
  searchTerm?: string,
): boolean {
  if (!searchTerm || !searchTerm.trim()) {
    return true;
  }

  const terms = normalizeText(searchTerm).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;

  const searchableText = `${normalizeText(doctor.full_name)} ${normalizeText(doctor.specialty)} ${normalizeText(doctor.bio ?? "")}`;

  return terms.every((term) => searchableText.includes(term));
}

/**
 * Checks if a doctor's consultation fee is within specified bounds.
 */
export function matchesFeeRange(
  doctor: { consultation_fee: number },
  minFee?: number,
  maxFee?: number,
): boolean {
  if (minFee !== undefined && !Number.isNaN(minFee) && doctor.consultation_fee < minFee) {
    return false;
  }
  if (maxFee !== undefined && !Number.isNaN(maxFee) && doctor.consultation_fee > maxFee) {
    return false;
  }
  return true;
}

/**
 * Filters a list of doctors according to search term, specialty, and fee range.
 */
export function filterDoctors<T extends PublicDoctor>(
  doctors: T[],
  options: DoctorFilterOptions,
): T[] {
  const { searchTerm, specialty, minFee, maxFee } = options;

  return doctors.filter(
    (doc) =>
      matchesSpecialty(doc, specialty) &&
      matchesSearchTerm(doc, searchTerm) &&
      matchesFeeRange(doc, minFee, maxFee),
  );
}

/**
 * Sorts doctors according to the specified sort option.
 */
export function sortDoctors<T extends PublicDoctor>(
  doctors: T[],
  sortBy: DoctorSortOption = "default",
): T[] {
  const copy = [...doctors];

  switch (sortBy) {
    case "name-asc":
      return copy.sort((a, b) => {
        const nameA = cleanNameForSorting(a.full_name);
        const nameB = cleanNameForSorting(b.full_name);
        return nameA.localeCompare(nameB, "es", { sensitivity: "base" });
      });
    case "name-desc":
      return copy.sort((a, b) => {
        const nameA = cleanNameForSorting(a.full_name);
        const nameB = cleanNameForSorting(b.full_name);
        return nameB.localeCompare(nameA, "es", { sensitivity: "base" });
      });
    case "fee-asc":
      return copy.sort((a, b) => a.consultation_fee - b.consultation_fee);
    case "fee-desc":
      return copy.sort((a, b) => b.consultation_fee - a.consultation_fee);
    case "default":
    default:
      return copy;
  }
}

/**
 * Filters and sorts doctors in one pass.
 */
export function filterAndSortDoctors<T extends PublicDoctor>(
  doctors: T[],
  options: DoctorFilterOptions,
): T[] {
  const filtered = filterDoctors(doctors, options);
  return sortDoctors(filtered, options.sortBy);
}

/**
 * Counts the number of doctors in each specialty.
 */
export function getSpecialtyCounts(doctors: PublicDoctor[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const doc of doctors) {
    if (doc.specialty) {
      counts[doc.specialty] = (counts[doc.specialty] || 0) + 1;
    }
  }
  return counts;
}

/**
 * Formats a fee in Chilean Pesos (CLP).
 */
export function formatFeeCLP(fee: number): string {
  return `$${fee.toLocaleString("es-CL")}`;
}
