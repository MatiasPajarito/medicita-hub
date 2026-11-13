import { describe, expect, it } from "vitest";
import { getBookingStepProgress, getBookingSteps } from "./booking-steps";

describe("booking-steps accessibility & max-3-step flow", () => {
  it("never exceeds 3 steps for paid consultations", () => {
    const steps = getBookingSteps(35000);
    expect(steps).toHaveLength(3);
    expect(steps.map((s) => s.id)).toEqual(["select", "payment", "done"]);
    expect(steps.map((s) => s.number)).toEqual([1, 2, 3]);
  });

  it("collapses to 2 steps when consultation fee is 0", () => {
    const steps = getBookingSteps(0);
    expect(steps).toHaveLength(2);
    expect(steps.map((s) => s.id)).toEqual(["select", "done"]);
    expect(steps.map((s) => s.number)).toEqual([1, 2]);
  });

  it("builds accurate progress and screen-reader announcements per step", () => {
    const step1 = getBookingStepProgress("select", 25000);
    expect(step1.currentIndex).toBe(0);
    expect(step1.totalSteps).toBe(3);
    expect(step1.announcement).toBe(
      "Paso 1 de 3: Horario y modalidad. Elige fecha, hora y modalidad de atención.",
    );

    const step2 = getBookingStepProgress("payment", 25000);
    expect(step2.currentIndex).toBe(1);
    expect(step2.currentStep.label).toBe("Pago seguro");

    const stepDoneFree = getBookingStepProgress("done", 0);
    expect(stepDoneFree.currentIndex).toBe(1);
    expect(stepDoneFree.totalSteps).toBe(2);
    expect(stepDoneFree.announcement).toContain("Paso 2 de 2");
  });

  it("falls back safely to step 1 if an unrecognized step is requested for fee=0", () => {
    const fallback = getBookingStepProgress("payment", 0);
    expect(fallback.currentIndex).toBe(0);
    expect(fallback.currentStep.id).toBe("select");
  });
});
