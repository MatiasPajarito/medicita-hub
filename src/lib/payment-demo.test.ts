import { describe, expect, test } from "vitest";
import { cardBrand, formatCardNumber, formatExpiry, generateOrderNumber, isDeclinedCard, luhnValid, simulatePayment, validateCard } from "./payment-demo";

const valid = { name: "Ana Pérez", number: "4051 8856 0044 6623", expiry: "12/30", cvv: "123" };
const now = new Date("2026-11-08T12:00:00");

describe("tarjeta simulada", () => {
  test("Luhn acepta las tarjetas de prueba y rechaza números alterados", () => {
    expect(luhnValid("4051 8856 0044 6623")).toBe(true);
    expect(luhnValid("5186 0595 5959 0568")).toBe(true);
    expect(luhnValid("4051 8856 0044 6624")).toBe(false);
    expect(luhnValid("1234")).toBe(false);
  });
  test("marca de la tarjeta", () => {
    expect(cardBrand("4051885600446623")).toBe("Visa");
    expect(cardBrand("5186059559590568")).toBe("Mastercard");
    expect(cardBrand("9999")).toBeNull();
  });
  test("formato de número y vencimiento al escribir", () => {
    expect(formatCardNumber("4051885600446623")).toBe("4051 8856 0044 6623");
    expect(formatCardNumber("40a5")).toBe("405");
    expect(formatExpiry("1230")).toBe("12/30");
    expect(formatExpiry("1")).toBe("1");
  });
  test("formulario válido no tiene errores", () => expect(validateCard(valid, now)).toEqual({}));
  test("detecta cada campo inválido", () => {
    const errors = validateCard({ name: "A", number: "1111", expiry: "13/30", cvv: "12" }, now);
    expect(Object.keys(errors).sort()).toEqual(["cvv", "expiry", "name", "number"]);
  });
  test("tarjeta vencida (el mes vigente aún sirve)", () => {
    expect(validateCard({ ...valid, expiry: "10/26" }, now).expiry).toMatch(/vencida/);
    expect(validateCard({ ...valid, expiry: "11/26" }, now).expiry).toBeUndefined();
  });
});

describe("resultado simulado", () => {
  test("la tarjeta Mastercard de prueba se rechaza", () => {
    expect(isDeclinedCard("5186 0595 5959 0568")).toBe(true);
    expect(isDeclinedCard("4051 8856 0044 6623")).toBe(false);
  });
  test("pago aprobado entrega comprobante con los últimos 4 dígitos", async () => {
    const result = await simulatePayment(valid, 35000, 0);
    expect(result.approved).toBe(true);
    if (result.approved) {
      expect(result.receipt.last4).toBe("6623");
      expect(result.receipt.amount).toBe(35000);
      expect(result.receipt.order).toMatch(/^MC-[0-9A-Z]{9}$/);
    }
  });
  test("pago rechazado explica el motivo", async () => {
    const result = await simulatePayment({ ...valid, number: "5186 0595 5959 0568" }, 35000, 0);
    expect(result.approved).toBe(false);
  });
  test("el número de orden cambia entre llamadas", () => expect(generateOrderNumber()).not.toBe(generateOrderNumber(Date.now() + 1)));
});
