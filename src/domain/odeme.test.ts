import { describe, expect, it } from "vitest";
import { ornekAlimlar, ornekAyarlar } from "../data/ornekVeri";
import { evrakDurumlari, evrakListesi } from "./dosya";
import { ekListesi, odemeHesabi, odemeKontrolleri, odemeOlustur, type Odeme } from "./odeme";

const TL = 100;
const klima = ornekAlimlar.find((a) => a.id === "DT-2026-040")!;
const matrah = 46_900 * TL;

function odeme(d: Partial<Odeme> = {}): Odeme {
  return {
    ...odemeOlustur(klima),
    vergiSorgusu: { durum: "borcsuz", tarih: "2026-10-16", belgeNo: "V1", borc: 0 },
    sgkSorgusu: { durum: "borcsuz", tarih: "2026-10-16", belgeNo: "S1", borc: 0 },
    ...d,
  };
}

describe("ödeme hesabı", () => {
  it("bakım onarımda 7/10 tevkifat ve makbuz damga vergisi keser", () => {
    const h = odemeHesabi(matrah, odeme(), ornekAyarlar);
    expect(h.kdv).toBe(9_380 * TL);
    expect(h.tevkifat).toBe(6_566 * TL);
    expect(h.damga.toplam).toBe(44_461);
    expect(h.yukleniciye).toBe(56_280 * TL - 6_566 * TL - 44_461);
    expect(h.vergiDairesine).toBe(6_566 * TL + 44_461);
  });

  it("tevkifat sınırının altında tevkifat uygulamaz", () => {
    const h = odemeHesabi(matrah, odeme(), { ...ornekAyarlar, tevkifatSiniri: 100_000 * TL });
    expect(h.tevkifatUygulandi).toBe(false);
    expect(h.tevkifat).toBe(0);
  });

  it("SGK borcunu ödemeden mahsup eder", () => {
    const h = odemeHesabi(matrah, odeme({ sgkSorgusu: { durum: "borclu", tarih: "2026-10-16", belgeNo: "S1", borc: 4_250 * TL } }), ornekAyarlar);
    expect(h.sgkya).toBe(4_250 * TL);
    expect(h.yukleniciye).toBe(56_280 * TL - 6_566 * TL - 44_461 - 4_250 * TL);
  });

  it("borç kalan tutardan fazlaysa yalnızca kalan kadarını mahsup eder", () => {
    const h = odemeHesabi(1_000 * TL, odeme({ tevkifatTuru: "yok", vergiSorgusu: { durum: "borclu", tarih: "2026-10-16", belgeNo: "", borc: 5_000 * TL } }), ornekAyarlar);
    expect(h.yukleniciye).toBe(0);
    expect(h.vergiMahsubu).toBe(1_200 * TL - 948);
  });
});

describe("ek listesi ve kontroller", () => {
  const tumu = Object.fromEntries(evrakListesi(klima).map((e) => [e.kod, { tamam: true, tarih: "2026-10-15", not: "" }]));
  const piyasa = {
    alimId: klima.id,
    kalemler: [],
    teklifler: [{ tedarikciId: "serin", teklifTarihi: null, yasaklilikSorgusu: "2026-10-03", fiyatlar: {} }],
    degerlendirme: "toplam" as const,
    gorevliler: "",
    tamamlandi: true,
  };

  it("önceki aşamaların evrakı tamamsa engel çıkarmaz", () => {
    const o = odeme({ oebNo: "2026/1234" });
    const ekler = ekListesi(evrakDurumlari(klima, tumu, piyasa), o);
    expect(ekler.map((e) => e.ad)).not.toContain("Ödeme emri belgesi");
    const k = odemeKontrolleri(o, odemeHesabi(matrah, o, ornekAyarlar), ekler, ornekAyarlar);
    expect(k.filter((x) => x.durum === "engel")).toEqual([]);
  });

  it("sorgu yapılmadıysa ve fatura eksikse engeller", () => {
    const o = odemeOlustur(klima);
    const { fatura: _, ...faturasiz } = tumu;
    const ekler = ekListesi(evrakDurumlari(klima, faturasiz, piyasa), o);
    const engel = odemeKontrolleri(o, odemeHesabi(matrah, o, ornekAyarlar), ekler, ornekAyarlar).find((x) => x.durum === "engel");
    expect(engel?.detay).toContain("Fatura");
    expect(engel?.detay).toContain("borç sorgusu");
  });

  it("tutarsız borç girişini engeller, sınır yoksa uyarır", () => {
    const o = odeme({ vergiSorgusu: { durum: "borclu", tarih: "", belgeNo: "", borc: 0 } });
    const sinirsiz = { ...ornekAyarlar, tevkifatSiniri: undefined };
    const basliklar = odemeKontrolleri(o, odemeHesabi(matrah, o, sinirsiz), [], sinirsiz).map((x) => `${x.durum}:${x.baslik}`);
    expect(basliklar).toContain("engel:Vergi borcu tutarı");
    expect(basliklar).toContain("uyari:Tevkifat sınırı tanımlı değil");
  });

  it("22/c alımında sözleşme yoksa uyarır", () => {
    const o = odeme();
    const k = odemeKontrolleri(o, odemeHesabi(matrah, o, ornekAyarlar), [], ornekAyarlar, "22/c");
    expect(k[0]).toMatchObject({ durum: "uyari", baslik: "Sözleşme zorunlu" });
    expect(odemeKontrolleri({ ...o, sozlesmeVar: true }, odemeHesabi(matrah, o, ornekAyarlar), [], ornekAyarlar, "22/c").some((x) => x.baslik === "Sözleşme zorunlu")).toBe(false);
  });
});
