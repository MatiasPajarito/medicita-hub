import { describe, expect, test } from "bun:test";
import {
  filterAndSortDoctors,
  filterDoctors,
  formatFeeCLP,
  getSpecialtyCounts,
  matchesFeeRange,
  matchesSearchTerm,
  matchesSpecialty,
  normalizeText,
  sortDoctors,
} from "./doctor-filter";
import type { PublicDoctor } from "./booking";

const mockDoctors: PublicDoctor[] = [
  {
    id: "doc-1",
    full_name: "Dra. Camila Rojas",
    specialty: "Cardiología",
    bio: "Especialista en prevención y tratamiento cardiovascular para adultos.",
    photo_url: "https://example.com/camila.jpg",
    consultation_fee: 35000,
  },
  {
    id: "doc-2",
    full_name: "Dr. Andrés Silva",
    specialty: "Medicina General",
    bio: "Médico cirujano con 10 años de experiencia en atención primaria de salud.",
    photo_url: null,
    consultation_fee: 25000,
  },
  {
    id: "doc-3",
    full_name: "Dra. Beatriz Morales",
    specialty: "Pediatría",
    bio: "Atención integral del recién nacido, niños y adolescentes con enfoque preventivo.",
    photo_url: "https://example.com/beatriz.jpg",
    consultation_fee: 40000,
  },
  {
    id: "doc-4",
    full_name: "Dr. Daniel Castro",
    specialty: "Salud Mental",
    bio: "Psiquiatra de adultos con enfoque en trastornos del ánimo y ansiedad.",
    photo_url: null,
    consultation_fee: 55000,
  },
  {
    id: "doc-5",
    full_name: "Dra. Elena Fuentes",
    specialty: "Cardiología",
    bio: "Cardióloga intervencionista y ecocardiografista avanzada.",
    photo_url: "https://example.com/elena.jpg",
    consultation_fee: 45000,
  },
];

describe("doctor-filter: normalizeText", () => {
  test("removes accents / diacritics and converts to lowercase", () => {
    expect(normalizeText("Cardiología")).toBe("cardiologia");
    expect(normalizeText("PEDiatRÍA")).toBe("pediatria");
    expect(normalizeText("Atención Médica")).toBe("atencion medica");
    expect(normalizeText("  Espacio   ")).toBe("espacio");
    expect(normalizeText("")).toBe("");
  });
});

describe("doctor-filter: matchesSpecialty", () => {
  const cardiologist = mockDoctors[0];

  test("returns true when specialty is 'all' or empty", () => {
    expect(matchesSpecialty(cardiologist, "all")).toBe(true);
    expect(matchesSpecialty(cardiologist, "todas")).toBe(true);
    expect(matchesSpecialty(cardiologist, "")).toBe(true);
    expect(matchesSpecialty(cardiologist, undefined)).toBe(true);
  });

  test("matches exact specialty", () => {
    expect(matchesSpecialty(cardiologist, "Cardiología")).toBe(true);
  });

  test("matches specialty accent-insensitively and case-insensitively", () => {
    expect(matchesSpecialty(cardiologist, "cardiologia")).toBe(true);
    expect(matchesSpecialty(cardiologist, "CARDIOLOGÍA")).toBe(true);
    expect(matchesSpecialty(cardiologist, "CARDIOLOGIA")).toBe(true);
  });

  test("returns false for different specialty", () => {
    expect(matchesSpecialty(cardiologist, "Pediatría")).toBe(false);
    expect(matchesSpecialty(cardiologist, "Salud Mental")).toBe(false);
  });
});

describe("doctor-filter: matchesSearchTerm", () => {
  const doctor = mockDoctors[0]; // Dra. Camila Rojas, Cardiología, prevención cardiovascular

  test("returns true when search term is empty or whitespace", () => {
    expect(matchesSearchTerm(doctor, "")).toBe(true);
    expect(matchesSearchTerm(doctor, "   ")).toBe(true);
    expect(matchesSearchTerm(doctor, undefined)).toBe(true);
  });

  test("matches by doctor name", () => {
    expect(matchesSearchTerm(doctor, "Camila")).toBe(true);
    expect(matchesSearchTerm(doctor, "rojas")).toBe(true);
    expect(matchesSearchTerm(doctor, "dra. camila")).toBe(true);
  });

  test("matches by specialty", () => {
    expect(matchesSearchTerm(doctor, "cardiologia")).toBe(true);
    expect(matchesSearchTerm(doctor, "Cardióloga")).toBe(false); // check substring
    expect(matchesSearchTerm(mockDoctors[4], "cardiologa")).toBe(true); // Elena has cardióloga in bio
  });

  test("matches by keywords inside bio", () => {
    expect(matchesSearchTerm(doctor, "cardiovascular")).toBe(true);
    expect(matchesSearchTerm(doctor, "prevencion")).toBe(true);
    expect(matchesSearchTerm(doctor, "adultos")).toBe(true);
  });

  test("matches multiple words in any order across name, specialty, bio", () => {
    expect(matchesSearchTerm(doctor, "camila cardiologia")).toBe(true);
    expect(matchesSearchTerm(doctor, "cardiovascular rojas")).toBe(true);
  });

  test("returns false when term is not found", () => {
    expect(matchesSearchTerm(doctor, "dermatologia")).toBe(false);
    expect(matchesSearchTerm(doctor, "oftalmologo")).toBe(false);
  });
});

describe("doctor-filter: matchesFeeRange", () => {
  const doc = { consultation_fee: 35000 };

  test("returns true when no bounds are specified", () => {
    expect(matchesFeeRange(doc)).toBe(true);
    expect(matchesFeeRange(doc, undefined, undefined)).toBe(true);
  });

  test("respects minFee", () => {
    expect(matchesFeeRange(doc, 30000)).toBe(true);
    expect(matchesFeeRange(doc, 35000)).toBe(true);
    expect(matchesFeeRange(doc, 40000)).toBe(false);
  });

  test("respects maxFee", () => {
    expect(matchesFeeRange(doc, undefined, 40000)).toBe(true);
    expect(matchesFeeRange(doc, undefined, 35000)).toBe(true);
    expect(matchesFeeRange(doc, undefined, 30000)).toBe(false);
  });

  test("respects both minFee and maxFee", () => {
    expect(matchesFeeRange(doc, 20000, 50000)).toBe(true);
    expect(matchesFeeRange(doc, 35000, 35000)).toBe(true);
    expect(matchesFeeRange(doc, 36000, 50000)).toBe(false);
    expect(matchesFeeRange(doc, 10000, 34000)).toBe(false);
  });
});

describe("doctor-filter: filterDoctors", () => {
  test("filters exclusively by specialty", () => {
    const results = filterDoctors(mockDoctors, { specialty: "Cardiología" });
    expect(results.length).toBe(2);
    expect(results.every((d) => d.specialty === "Cardiología")).toBe(true);
  });

  test("filters by search term", () => {
    const results = filterDoctors(mockDoctors, { searchTerm: "cirujano" });
    expect(results.length).toBe(1);
    expect(results[0]?.full_name).toBe("Dr. Andrés Silva");
  });

  test("filters by maxFee", () => {
    const results = filterDoctors(mockDoctors, { maxFee: 35000 });
    expect(results.length).toBe(2); // 25000 and 35000
    expect(results.map((d) => d.consultation_fee)).toEqual([35000, 25000]);
  });

  test("combines specialty and search term", () => {
    const results = filterDoctors(mockDoctors, {
      specialty: "Cardiología",
      searchTerm: "intervencionista",
    });
    expect(results.length).toBe(1);
    expect(results[0]?.full_name).toBe("Dra. Elena Fuentes");
  });

  test("returns empty array when no criteria match", () => {
    const results = filterDoctors(mockDoctors, {
      specialty: "Pediatría",
      maxFee: 20000,
    });
    expect(results.length).toBe(0);
  });
});

describe("doctor-filter: sortDoctors", () => {
  test("sorts by name ascending (A-Z)", () => {
    const sorted = sortDoctors(mockDoctors, "name-asc");
    expect(sorted.map((d) => d.full_name)).toEqual([
      "Dr. Andrés Silva",
      "Dra. Beatriz Morales",
      "Dra. Camila Rojas",
      "Dr. Daniel Castro",
      "Dra. Elena Fuentes",
    ]);
  });

  test("sorts by name descending (Z-A)", () => {
    const sorted = sortDoctors(mockDoctors, "name-desc");
    expect(sorted.map((d) => d.full_name)).toEqual([
      "Dra. Elena Fuentes",
      "Dr. Daniel Castro",
      "Dra. Camila Rojas",
      "Dra. Beatriz Morales",
      "Dr. Andrés Silva",
    ]);
  });

  test("sorts by fee ascending (cheapest first)", () => {
    const sorted = sortDoctors(mockDoctors, "fee-asc");
    expect(sorted.map((d) => d.consultation_fee)).toEqual([25000, 35000, 40000, 45000, 55000]);
  });

  test("sorts by fee descending (most expensive first)", () => {
    const sorted = sortDoctors(mockDoctors, "fee-desc");
    expect(sorted.map((d) => d.consultation_fee)).toEqual([55000, 45000, 40000, 35000, 25000]);
  });

  test("default sort maintains order without mutating", () => {
    const sorted = sortDoctors(mockDoctors, "default");
    expect(sorted).toEqual(mockDoctors);
    expect(sorted).not.toBe(mockDoctors); // new copy
  });
});

describe("doctor-filter: filterAndSortDoctors", () => {
  test("applies filtering and sorting simultaneously", () => {
    const results = filterAndSortDoctors(mockDoctors, {
      specialty: "Cardiología",
      sortBy: "fee-asc",
    });
    expect(results.length).toBe(2);
    expect(results[0]?.full_name).toBe("Dra. Camila Rojas"); // 35000
    expect(results[1]?.full_name).toBe("Dra. Elena Fuentes"); // 45000
  });

  test("applies search term, max fee, and sorting", () => {
    const results = filterAndSortDoctors(mockDoctors, {
      searchTerm: "dra",
      maxFee: 40000,
      sortBy: "name-asc",
    });
    expect(results.length).toBe(2);
    expect(results[0]?.full_name).toBe("Dra. Beatriz Morales");
    expect(results[1]?.full_name).toBe("Dra. Camila Rojas");
  });
});

describe("doctor-filter: getSpecialtyCounts and formatFeeCLP", () => {
  test("computes correct count per specialty", () => {
    const counts = getSpecialtyCounts(mockDoctors);
    expect(counts["Cardiología"]).toBe(2);
    expect(counts["Medicina General"]).toBe(1);
    expect(counts["Pediatría"]).toBe(1);
    expect(counts["Salud Mental"]).toBe(1);
    expect(counts["Dermatología"]).toBeUndefined();
  });

  test("formats fees as CLP string with dot thousand separators", () => {
    expect(formatFeeCLP(35000)).toBe("$35.000");
    expect(formatFeeCLP(0)).toBe("$0");
    expect(formatFeeCLP(1250000)).toBe("$1.250.000");
  });
});
