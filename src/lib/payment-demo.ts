// Pago SIMULADO (demostración del flujo MUST-08). No se conecta a ninguna pasarela ni cobra nada.

export type PaymentReceipt = { order: string; amount: number; last4: string | null; brand: string | null; paidAt: Date };
export type CardForm = { name: string; number: string; expiry: string; cvv: string };
export type CardErrors = Partial<Record<keyof CardForm, string>>;

/** Tarjetas de prueba que se muestran en pantalla para la demostración. */
export const DEMO_CARDS = {
  approved: "4051 8856 0044 6623",
  rejected: "5186 0595 5959 0568",
} as const;

const digits = (value: string) => value.replace(/\D/g, "");

export function luhnValid(number: string): boolean {
  const d = digits(number);
  if (d.length < 13 || d.length > 19) return false;
  let sum = 0;
  for (let i = 0; i < d.length; i += 1) {
    let n = Number(d[d.length - 1 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

export function cardBrand(number: string): string | null {
  const d = digits(number);
  if (/^4/.test(d)) return "Visa";
  if (/^(5[1-5]|2[2-7])/.test(d)) return "Mastercard";
  return null;
}

export const formatCardNumber = (value: string) => digits(value).slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ");
export function formatExpiry(value: string) {
  const d = digits(value).slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}

/** Valida el formulario de tarjeta. `now` se inyecta para poder probar el vencimiento. */
export function validateCard(form: CardForm, now = new Date()): CardErrors {
  const errors: CardErrors = {};
  if (form.name.trim().length < 3) errors.name = "Ingresa el nombre que aparece en la tarjeta";
  if (!luhnValid(form.number)) errors.number = "Número de tarjeta inválido";
  const match = /^(\d{2})\/(\d{2})$/.exec(form.expiry);
  if (!match) errors.expiry = "Usa el formato MM/AA";
  else {
    const month = Number(match[1]);
    const year = 2000 + Number(match[2]);
    const lastDay = new Date(year, month, 0, 23, 59, 59);
    if (month < 1 || month > 12) errors.expiry = "Mes inválido";
    else if (lastDay < now) errors.expiry = "La tarjeta está vencida";
  }
  if (!/^\d{3}$/.test(form.cvv)) errors.cvv = "CVV de 3 dígitos";
  return errors;
}

/** La tarjeta de prueba MasterCard (5186…) simula un rechazo; cualquier otra tarjeta válida se aprueba. */
export const isDeclinedCard = (number: string) => digits(number).startsWith("5186");

export function generateOrderNumber(now = Date.now(), random = Math.random) {
  const suffix = Array.from({ length: 4 }, () => Math.floor(random() * 36).toString(36)).join("");
  return `MC-${now.toString(36).slice(-5)}${suffix}`.toUpperCase();
}

/** Simula el procesamiento del pago (espera un momento y devuelve aprobado/rechazado). */
export async function simulatePayment(form: CardForm, amount: number, delayMs = 1800): Promise<{ approved: true; receipt: PaymentReceipt } | { approved: false; reason: string }> {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
  if (isDeclinedCard(form.number)) return { approved: false, reason: "Tu banco rechazó la transacción. Prueba con otra tarjeta." };
  const d = digits(form.number);
  return { approved: true, receipt: { order: generateOrderNumber(), amount, last4: d.slice(-4), brand: cardBrand(form.number), paidAt: new Date() } };
}
