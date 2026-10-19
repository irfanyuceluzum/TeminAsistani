import { describe, expect, it } from "vitest";
import { AY_KISA, AY_UZUN, gunFarki, gunYaz } from "./tarih";

describe("gunFarki", () => {
  it("aynı gün 0", () => expect(gunFarki("2026-03-10", "2026-03-10")).toBe(0));
  it("ay ve yıl geçişini sayar", () => {
    expect(gunFarki("2026-03-01", "2026-02-28")).toBe(1);
    expect(gunFarki("2027-01-01", "2026-12-31")).toBe(1);
    expect(gunFarki("2026-12-31", "2026-01-01")).toBe(364);
  });
  it("ters sırada negatif", () => expect(gunFarki("2026-03-01", "2026-03-11")).toBe(-10));
});

describe("gunYaz", () => {
  it("GG.AA.YYYY döner", () => expect(gunYaz("2026-03-05")).toBe("05.03.2026"));
  it("zaman damgasını atar", () => expect(gunYaz("2026-10-20T09:00:00.000Z")).toBe("20.10.2026"));
  it("boş girdide boş", () => expect(gunYaz("")).toBe(""));
});

describe("ay sabitleri", () => {
  it("12 öğe", () => {
    expect(AY_KISA).toHaveLength(12);
    expect(AY_UZUN).toHaveLength(12);
    expect(AY_KISA[0]).toBe("Oca");
    expect(AY_UZUN[11]).toBe("Aralık");
  });
});
