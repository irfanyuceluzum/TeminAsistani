import { describe, expect, it } from "vitest";
import { turkceSayi } from "./sayi";

describe("turkceSayi", () => {
  it("Türkçe ve İngilizce biçimleri okur", () => {
    expect(turkceSayi("1.250,5")).toBe(1250.5);
    expect(turkceSayi("1,250.5")).toBe(1250.5);
    expect(turkceSayi("12,5")).toBe(12.5);
    expect(turkceSayi("1.250")).toBe(1250);
    expect(turkceSayi("1.250.000")).toBe(1250000);
    expect(turkceSayi("2.5")).toBe(2.5);
    expect(turkceSayi("38500")).toBe(38500);
    expect(turkceSayi("1.25")).toBe(1.25);
    expect(turkceSayi("12,345")).toBe(12.345);
    expect(turkceSayi("  7 ")).toBe(7);
  });

  it("geçersiz girişte null verir", () => {
    expect(turkceSayi("1,2,3")).toBeNull();
    expect(turkceSayi("1.2.3")).toBeNull();
    expect(turkceSayi("12abc")).toBeNull();
    expect(turkceSayi("")).toBeNull();
    expect(turkceSayi("1.25,0")).toBeNull();
    expect(turkceSayi("-5")).toBeNull();
  });
});
