import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, CalendarDays, CheckCircle2, CreditCard, Loader2, ShieldCheck, Video, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatFeeCLP } from "@/lib/doctor-filter";
import {
  cardBrand,
  formatCardNumber,
  formatExpiry,
  simulatePayment,
  validateCard,
  type CardErrors,
  type CardForm,
  type PaymentReceipt,
} from "@/lib/payment-demo";

export type CheckoutSummary = { doctorName: string; specialty: string; dateLabel: string; timeLabel: string; modality: string; amount: number };

function SummaryRows({ summary }: { summary: CheckoutSummary }) {
  return (
    <dl className="grid gap-2 rounded-lg border border-border bg-surface-subtle p-4 text-sm">
      <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Profesional</dt><dd className="text-right font-medium">{summary.doctorName} · {summary.specialty}</dd></div>
      <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Fecha y hora</dt><dd className="text-right font-medium capitalize">{summary.dateLabel}, {summary.timeLabel}</dd></div>
      <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Modalidad</dt><dd className="text-right font-medium">{summary.modality === "telemedicina" ? "Telemedicina" : "Presencial"}</dd></div>
      <div className="flex justify-between gap-4 border-t border-border pt-2 text-base font-bold"><dt>Total a pagar</dt><dd>{formatFeeCLP(summary.amount)}</dd></div>
    </dl>
  );
}

/** Paso 2 de la reserva: pago con tarjeta (simulado). */
export function PaymentStep({
  summary,
  onBack,
  onApproved,
  busy = false,
  onProcessingChange,
}: {
  summary: CheckoutSummary;
  onBack: () => void;
  onApproved: (receipt: PaymentReceipt) => void;
  /** El padre está guardando la cita tras el pago: mantiene bloqueados los botones. */
  busy?: boolean;
  /** Avisa al padre mientras se procesa el pago (para impedir cerrar el diálogo a mitad de cobro). */
  onProcessingChange?: (processing: boolean) => void;
}) {
  const [form, setForm] = useState<CardForm>({ name: "", number: "", expiry: "", cvv: "" });
  const [errors, setErrors] = useState<CardErrors>({});
  const [processing, setProcessing] = useState(false);
  const [declined, setDeclined] = useState<string | null>(null);
  const brand = cardBrand(form.number);

  const set = (key: keyof CardForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
    setDeclined(null);
  };

  async function pay() {
    if (processing || busy) return;
    const found = validateCard(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setProcessing(true);
    onProcessingChange?.(true);
    setDeclined(null);
    try {
      const result = await simulatePayment(form, summary.amount);
      setProcessing(false);
      if (result.approved) onApproved(result.receipt);
      else setDeclined(result.reason);
    } finally {
      setProcessing(false);
      onProcessingChange?.(false);
    }
  }

  return (
    <div className="grid gap-4">
      <SummaryRows summary={summary} />

      <fieldset className="grid gap-3 border-0 p-0">
        <legend className="sr-only">Datos de la tarjeta para pago de la consulta</legend>
        <div className="grid gap-1.5">
          <Label htmlFor="card-name">Nombre en la tarjeta</Label>
          <Input
            id="card-name"
            autoComplete="cc-name"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "card-name-error" : undefined}
          />
          {errors.name && (
            <p id="card-name-error" role="alert" className="text-xs font-medium text-destructive">
              {errors.name}
            </p>
          )}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="card-number">Número de tarjeta</Label>
          <div className="relative">
            <Input
              id="card-number"
              inputMode="numeric"
              autoComplete="cc-number"
              placeholder="0000 0000 0000 0000"
              value={form.number}
              onChange={(e) => set("number", formatCardNumber(e.target.value))}
              aria-invalid={!!errors.number}
              aria-describedby={errors.number ? "card-number-error" : undefined}
            />
            {brand && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                {brand}
              </span>
            )}
          </div>
          {errors.number && (
            <p id="card-number-error" role="alert" className="text-xs font-medium text-destructive">
              {errors.number}
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="card-expiry">Vencimiento</Label>
            <Input
              id="card-expiry"
              inputMode="numeric"
              autoComplete="cc-exp"
              placeholder="MM/AA"
              value={form.expiry}
              onChange={(e) => set("expiry", formatExpiry(e.target.value))}
              aria-invalid={!!errors.expiry}
              aria-describedby={errors.expiry ? "card-expiry-error" : undefined}
            />
            {errors.expiry && (
              <p id="card-expiry-error" role="alert" className="text-xs font-medium text-destructive">
                {errors.expiry}
              </p>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="card-cvv">CVV</Label>
            <Input
              id="card-cvv"
              inputMode="numeric"
              autoComplete="cc-csc"
              placeholder="123"
              maxLength={3}
              value={form.cvv}
              onChange={(e) => set("cvv", e.target.value.replace(/\D/g, ""))}
              aria-invalid={!!errors.cvv}
              aria-describedby={errors.cvv ? "card-cvv-error" : undefined}
            />
            {errors.cvv && (
              <p id="card-cvv-error" role="alert" className="text-xs font-medium text-destructive">
                {errors.cvv}
              </p>
            )}
          </div>
        </div>
      </fieldset>

      {declined && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span><strong>Pago rechazado.</strong> {declined} Tu hora no fue reservada y no se realizó ningún cargo.</span>
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button type="button" variant="outline" className="min-h-11" disabled={processing || busy} onClick={onBack}><ArrowLeft aria-hidden="true" />Volver</Button>
        <Button type="button" className="min-h-11" disabled={processing || busy} aria-busy={processing || busy} onClick={() => void pay()}>
          {processing || busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CreditCard aria-hidden="true" />}
          {processing ? "Procesando pago…" : busy ? "Confirmando cita…" : `Pagar ${formatFeeCLP(summary.amount)}`}
        </Button>
      </div>
      <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck className="size-3.5" aria-hidden="true" />Pago seguro (simulación)</p>
    </div>
  );
}

/** Paso final: comprobante tras la reserva confirmada. */
export function PaymentReceiptView({ summary, receipt, onClose }: { summary: CheckoutSummary; receipt: PaymentReceipt | null; onClose: () => void }) {
  return (
    <div className="grid gap-4">
      <div className="text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-success-soft text-success"><CheckCircle2 className="size-8" aria-hidden="true" /></span>
        <h3 className="mt-3 text-xl font-bold">{receipt && receipt.amount > 0 ? "¡Pago aprobado y cita confirmada!" : "¡Tu cita está confirmada!"}</h3>
        <p className="mt-1 text-sm text-muted-foreground">Te esperamos. Puedes ver, reagendar o cancelar tu cita desde Mi agenda.</p>
      </div>
      <SummaryRows summary={summary} />
      {summary.modality === "telemedicina" && (
        <div
          role="note"
          className="flex items-start gap-2.5 rounded-lg border border-primary/25 bg-clinical-soft/50 p-3 text-xs text-foreground"
        >
          <Video className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <p>
            <strong>Videoconsulta habilitada:</strong> el botón para ingresar a la sala virtual estará disponible en <strong>Mi agenda</strong> el día de tu atención.
          </p>
        </div>
      )}
      {receipt && receipt.amount > 0 && (
        <dl className="grid gap-2 rounded-lg border border-border p-4 text-sm">
          <div className="flex justify-between gap-4"><dt className="text-muted-foreground">N.º de orden</dt><dd className="font-mono text-xs font-medium">{receipt.order}</dd></div>
          {receipt.last4 && <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Tarjeta</dt><dd className="font-medium">{receipt.brand ?? "Tarjeta"} •••• {receipt.last4}</dd></div>}
          <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Fecha del pago</dt><dd className="font-medium">{format(receipt.paidAt, "d MMM yyyy, HH:mm", { locale: es })}</dd></div>
        </dl>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" className="min-h-11" onClick={onClose}>Cerrar</Button>
        <Button asChild className="min-h-11" onClick={onClose}><Link to="/mi-agenda" search={{ tab: "upcoming" }}><CalendarDays aria-hidden="true" />Ver mi agenda</Link></Button>
      </div>
    </div>
  );
}
