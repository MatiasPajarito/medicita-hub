export type BookingStepId = "select" | "payment" | "done";

export interface BookingStepDescriptor {
  id: BookingStepId;
  number: number;
  label: string;
  shortLabel: string;
  description: string;
}

export interface BookingStepProgress {
  steps: BookingStepDescriptor[];
  currentIndex: number;
  totalSteps: number;
  currentStep: BookingStepDescriptor;
  announcement: string;
}

/**
 * Returns the ordered booking steps guaranteeing a maximum of 3 steps:
 * - Paid consultations (`fee > 0`): 3 steps (Horario -> Pago -> Confirmación)
 * - Zero-fee consultations (`fee === 0`): 2 steps (Horario -> Confirmación)
 */
export function getBookingSteps(consultationFee: number): BookingStepDescriptor[] {
  const requiresPayment = Number(consultationFee) > 0;

  if (!requiresPayment) {
    return [
      {
        id: "select",
        number: 1,
        label: "Horario y modalidad",
        shortLabel: "1. Horario",
        description: "Elige fecha, hora y modalidad de atención.",
      },
      {
        id: "done",
        number: 2,
        label: "Reserva confirmada",
        shortLabel: "2. Confirmación",
        description: "Revisa tu comprobante y detalles de la cita.",
      },
    ];
  }

  return [
    {
      id: "select",
      number: 1,
      label: "Horario y modalidad",
      shortLabel: "1. Horario",
      description: "Elige fecha, hora y modalidad de atención.",
    },
    {
      id: "payment",
      number: 2,
      label: "Pago seguro",
      shortLabel: "2. Pago",
      description: "Confirma y realiza el pago de tu consulta.",
    },
    {
      id: "done",
      number: 3,
      label: "Reserva confirmada",
      shortLabel: "3. Confirmación",
      description: "Revisa tu comprobante y detalles de la cita.",
    },
  ];
}

/**
 * Resolves the active step metadata and an accessible screen-reader announcement
 * string for the current booking step.
 */
export function getBookingStepProgress(
  stepId: BookingStepId,
  consultationFee: number,
): BookingStepProgress {
  const steps = getBookingSteps(consultationFee);
  const foundIndex = steps.findIndex((s) => s.id === stepId);
  const currentIndex = foundIndex >= 0 ? foundIndex : 0;
  const currentStep = steps[currentIndex] ?? steps[0]!;
  const totalSteps = steps.length;

  return {
    steps,
    currentIndex,
    totalSteps,
    currentStep,
    announcement: `Paso ${currentStep.number} de ${totalSteps}: ${currentStep.label}. ${currentStep.description}`,
  };
}
