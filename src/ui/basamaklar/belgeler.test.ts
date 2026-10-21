import { describe, expect, it } from "vitest";
import { ornekAlimlar, ornekAyarlar } from "../../data/ornekVeri";
import { muayeneOlustur } from "../../domain/muayene";
import type { PiyasaKalemi } from "../../domain/piyasa";
import type { Ayarlar } from "../../domain/tipler";
import { firmaFiyatToplami, muayeneKomisyonuImzalari } from "./belgeler";

describe("muayeneKomisyonuImzalari", () => {
  const gorevli = (d: Partial<NonNullable<Ayarlar["gorevler"]>>): Ayarlar => ({ ...ornekAyarlar, gorevler: { ...ornekAyarlar.gorevler!, ...d } });
  const adlar = (a: Ayarlar) => muayeneKomisyonuImzalari(a, null).map((u) => `${u.ad}${u.baskan ? " (başkan)" : ""}`);

  it("görevlendirmeden başkan başta, üyeler ardından gelir", () => {
    expect(adlar(ornekAyarlar)).toEqual(["Fatma Kaya (başkan)", "Hasan Çelik", "Ali Yılmaz"]);
  });

  it("üyeler arasında da yazılı başkan bir kez yazılır", () => {
    expect(adlar(gorevli({ muayeneUyeleri: ["p5", "p4", "p3"] }))).toEqual(["Fatma Kaya (başkan)", "Hasan Çelik", "Ali Yılmaz"]);
  });

  it("yetkili başkan görevlendirmedeki başkan olarak yazılır; yetkili üye de listelenir", () => {
    expect(adlar(gorevli({ muayeneBaskani: "p1", muayeneUyeleri: ["p5", "p2", "p3"] }))).toEqual([
      "Mehmet Arslan (başkan)",
      "Hasan Çelik",
      "Ayşe Demir",
      "Ali Yılmaz",
    ]);
  });

  it("görevlendirme yoksa tek boş imza yeri bırakır", () => {
    expect(adlar({ ...ornekAyarlar, gorevler: undefined })).toEqual(["… (başkan)"]);
  });

  it("dosyaya özel üyeler görevlendirmenin önüne geçer, başkan başa alınır", () => {
    const m = muayeneOlustur(ornekAlimlar[0], null, "2026-10-20", [
      { ad: "Üye Bir", unvan: "Öğretmen", rol: "uye" },
      { ad: "Başkan Kişi", unvan: "Öğretmen", rol: "baskan" },
      { ad: " ", unvan: "", rol: "uye" },
    ]);
    expect(muayeneKomisyonuImzalari(ornekAyarlar, m).map((u) => [u.ad, u.baskan])).toEqual([
      ["Başkan Kişi", true],
      ["Üye Bir", false],
    ]);
  });
});

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
