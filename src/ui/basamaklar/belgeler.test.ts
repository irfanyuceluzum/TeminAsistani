import { describe, expect, it } from "vitest";
import type { PiyasaKalemi } from "../../domain/piyasa";
import { firmaFiyatToplami } from "./belgeler";

const kalemler: PiyasaKalemi[] = [
  { id: "k1", ad: "A", miktar: 2, birim: "adet" },
  { id: "k2", ad: "B", miktar: 3, birim: "adet" },
];

describe("firmaFiyatToplami", () => {
  it("tam fiyatlı firmada kalem tutarlarını toplar", () => {
    expect(firmaFiyatToplami(kalemler, { k1: 1050, k2: 200 })).toBe(2 * 1050 + 3 * 200);
  });

  it("eksik fiyatlı firmada null döner", () => {
    expect(firmaFiyatToplami(kalemler, { k1: 1050, k2: null })).toBeNull();
    expect(firmaFiyatToplami(kalemler, { k1: 1050 })).toBeNull();
  });

  it("0 TL kalem eksik sayılır", () => {
    expect(firmaFiyatToplami(kalemler, { k1: 1050, k2: 0 })).toBeNull();
  });

  it("kalemsiz listede null döner", () => {
    expect(firmaFiyatToplami([], {})).toBeNull();
  });
});
