import { describe, expect, it } from "vitest";
import { gorunurAlimlar, UYGULAMA_BENDI } from "./gorunurluk";
import type { Alim } from "./tipler";

const alim = (id: string, d: Partial<Alim> = {}): Alim => ({
  id,
  onayTarihi: "2026-10-01",
  konu: "Deneme",
  bent: "22/d",
  tutar: 10_000,
  ekonomikKod: "03.2.1.01",
  kalemKodu: "X",
  tedarikciId: null,
  asama: "onay",
  sonIslem: "2026-10-01",
  ...d,
});

describe("görünürlük", () => {
  it("uygulama bendi 22/d'dir", () => {
    expect(UYGULAMA_BENDI).toBe("22/d");
  });

  it("22/d dışındaki kayıtları dışarıda bırakır", () => {
    const sonuc = gorunurAlimlar([alim("a", { bent: "22/c" }), alim("b"), alim("c", { bent: "22/b" })]);
    expect(sonuc.map((x) => x.id)).toEqual(["b"]);
  });

  it("iptal edilmiş 22/d'yi içeride tutar ve sırayı korur", () => {
    const sonuc = gorunurAlimlar([alim("1"), alim("2", { bent: "22/b" }), alim("3", { asama: "iptal" }), alim("4", { asama: "tamamlandi" })]);
    expect(sonuc.map((x) => x.id)).toEqual(["1", "3", "4"]);
  });
});
