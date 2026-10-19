import { describe, expect, it } from "vitest";
import { ornekAlimlar, ornekAyarlar } from "../data/ornekVeri";
import { evrakDurumlari, evrakListesi } from "./dosya";
import { muayeneOlustur } from "./muayene";
import { borcSorgusuGerekli, ekListesi, kbsAlanlari, odemeHesabi, odemeKontrolleri, odemeMatrahi, odemeOlustur, oebSatirlari, type Odeme } from "./odeme";

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
    kalemler: [{ id: "k1", ad: "Klima bakımı", miktar: 1, birim: "iş" }],
    teklifler: [{ tedarikciId: "serin", teklifTarihi: null, yasaklilikSorgusu: "2026-10-03", fiyatlar: { k1: matrah } }],
    degerlendirme: "toplam" as const,
    gorevliler: "",
    tamamlandi: true,
  };

  it("önceki aşamaların evrakı tamamsa engel çıkarmaz", () => {
    const o = odeme({ oebNo: "2026/1234" });
    const ekler = ekListesi(evrakDurumlari({ ...klima, ekapKayitNo: "2026/123456" }, tumu, piyasa), o, 56_280 * TL, ornekAyarlar);
    expect(ekler.map((e) => e.ad)).not.toContain("Ödeme emri belgesi");
    const k = odemeKontrolleri(o, odemeHesabi(matrah, o, ornekAyarlar), ekler, ornekAyarlar);
    expect(k.filter((x) => x.durum === "engel")).toEqual([]);
  });

  it("sorgu yapılmadıysa ve fatura eksikse engeller", () => {
    const o = odemeOlustur(klima);
    expect(o.sozlesmeVar).toBe(false);
    expect(odemeOlustur({ ...klima, sureliIs: true }).sozlesmeVar).toBe(true);
    const { fatura: _, ...faturasiz } = tumu;
    const ekler = ekListesi(evrakDurumlari(klima, faturasiz, piyasa), o, 56_280 * TL, ornekAyarlar);
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

  it("sözleşme zorunlu dosyada sözleşme yoksa uyarır", () => {
    const o = odeme();
    const k = odemeKontrolleri({ ...o, sozlesmeVar: false }, odemeHesabi(matrah, o, ornekAyarlar), [], ornekAyarlar, true);
    expect(k[0]).toMatchObject({ durum: "uyari", baslik: "Sözleşme zorunlu" });
    expect(odemeKontrolleri({ ...o, sozlesmeVar: true }, odemeHesabi(matrah, o, ornekAyarlar), [], ornekAyarlar, true).some((x) => x.baslik === "Sözleşme zorunlu")).toBe(false);
  });
});

describe("borç sorgusu gerekliliği", () => {
  const varsayilan = { ...ornekAyarlar, vergiBorcuSorguEsigi: undefined };
  const sorgusuz = (v: Odeme["vergiSorgusu"]["durum"], s: Odeme["sgkSorgusu"]["durum"] = "borcsuz") =>
    odeme({
      vergiSorgusu: { durum: v, tarih: "", belgeNo: "", borc: 0 },
      sgkSorgusu: { durum: s, tarih: "", belgeNo: "", borc: 0 },
    });
  const brutlu = (brut: number, o: Odeme, ayarlar = ornekAyarlar) => ({ ...odemeHesabi(brut, o, ayarlar), brut });

  it("vergi sorgusu eşiği aşınca gerekir; eşit ve altında gerekmez", () => {
    expect(borcSorgusuGerekli(5_000 * TL - 1, ornekAyarlar).vergi).toBe(false);
    expect(borcSorgusuGerekli(5_000 * TL, ornekAyarlar).vergi).toBe(false);
    expect(borcSorgusuGerekli(5_000 * TL + 1, ornekAyarlar).vergi).toBe(true);
  });

  it("eşik tanımsızsa 5.000 TL, parametreyle değişir", () => {
    expect(borcSorgusuGerekli(5_000 * TL + 1, varsayilan).vergi).toBe(true);
    expect(borcSorgusuGerekli(5_000 * TL, varsayilan).vergi).toBe(false);
    const yuksek = { ...ornekAyarlar, vergiBorcuSorguEsigi: 10_000 * TL };
    expect(borcSorgusuGerekli(8_000 * TL, yuksek).vergi).toBe(false);
    expect(borcSorgusuGerekli(10_000 * TL + 1, yuksek).vergi).toBe(true);
  });

  it("SGK sorgusu tutardan bağımsız her zaman gerekir", () => {
    expect(borcSorgusuGerekli(0, ornekAyarlar).sgk).toBe(true);
    expect(borcSorgusuGerekli(100, ornekAyarlar).sgk).toBe(true);
    expect(borcSorgusuGerekli(1_000_000 * TL, ornekAyarlar).sgk).toBe(true);
  });

  it("vergi gerekliyken 'gerekmiyor' seçilirse engeller", () => {
    const o = sorgusuz("gerekmiyor");
    const e = odemeKontrolleri(o, brutlu(56_280 * TL, o), [], ornekAyarlar).find((x) => x.baslik === "Vergi borcu sorgusu gerekli");
    expect(e?.durum).toBe("engel");
    expect(e?.detay).toContain("56.280,00");
    expect(e?.detay).toContain("5.000,00");
  });

  it("vergi gerekmiyorsa 'gerekmiyor' engel değildir", () => {
    const o = sorgusuz("gerekmiyor");
    const k = odemeKontrolleri(o, brutlu(4_000 * TL, o), [], ornekAyarlar);
    expect(k.some((x) => x.baslik === "Vergi borcu sorgusu gerekli")).toBe(false);
  });

  it("vergi gerekmiyorsa 'yapilmadi' ek listesini engellemez; gerekiyorsa engeller", () => {
    const o = sorgusuz("yapilmadi");
    const sorguSatiri = (brut: number) => ekListesi([], o, brut, ornekAyarlar).find((e) => e.ad === "Vergi ve SGK borç sorgusu")!;
    expect(sorguSatiri(4_000 * TL).tamam).toBe(true);
    expect(sorguSatiri(6_000 * TL).tamam).toBe(false);
    // SGK yapılmadıysa vergi gerekmese de eksik
    expect(ekListesi([], sorgusuz("yapilmadi", "yapilmadi"), 4_000 * TL, ornekAyarlar)[0].tamam).toBe(false);
  });

  it("SGK 'gerekmiyor' seçilirse uyarır", () => {
    const o = sorgusuz("borcsuz", "gerekmiyor");
    const u = odemeKontrolleri(o, brutlu(4_000 * TL, o), [], ornekAyarlar).find((x) => x.baslik === "SGK borç sorgusunda tutar sınırı yok");
    expect(u?.durum).toBe("uyari");
  });
});

describe("ödeme emri belgesi satırları", () => {
  const temizlik = ornekAlimlar.find((a) => a.id === "DT-2026-041")!;
  const yok = (d: Partial<Odeme> = {}) => odeme({ ...odemeOlustur(temizlik), tevkifatTuru: "yok", ...d });

  it("fatura bedeline KDV'yi ekler; net ödeme KDV dahil tutardan kesintiler düşülerek bulunur", () => {
    const h = odemeHesabi(32_700 * TL, yok(), ornekAyarlar);
    const s = oebSatirlari(h, yok(), ornekAyarlar);
    expect(s[0]).toEqual({ aciklama: "Mal / hizmet bedeli (KDV hariç)", borc: 32_700 * TL, alacak: null });
    expect(s[1]).toEqual({ aciklama: "Katma değer vergisi (%20)", borc: 6_540 * TL, alacak: null });
    const borc = s.reduce((t, x) => t + (x.borc ?? 0), 0);
    const alacak = s.reduce((t, x) => t + (x.alacak ?? 0), 0);
    expect(borc).toBe(39_240 * TL);
    // Çift taraflı kayıt: borç ve alacak toplamı eşit
    expect(alacak).toBe(borc);
    expect(s[s.length - 1]).toEqual({ aciklama: "Yükleniciye net ödenecek", borc: null, alacak: 39_240 * TL - 31_000 });
  });

  it("damga satırını oranın gerçek adıyla yazar", () => {
    const h = odemeHesabi(32_700 * TL, yok(), ornekAyarlar);
    const s = oebSatirlari(h, yok(), ornekAyarlar);
    expect(s.find((x) => x.aciklama.startsWith("Damga"))).toEqual({ aciklama: "Damga vergisi, makbuz (binde 9,48)", borc: null, alacak: 31_000 });
    expect(s.some((x) => /karar|ihale/i.test(x.aciklama))).toBe(false);
  });

  it("tevkifat ve borç mahsubunu ayrı satır yapar", () => {
    const o = odeme({ vergiSorgusu: { durum: "borclu", tarih: "2026-10-16", belgeNo: "V1", borc: 1_000 * TL } });
    const h = odemeHesabi(matrah, o, ornekAyarlar);
    const s = oebSatirlari(h, o, ornekAyarlar);
    expect(s.map((x) => x.aciklama)).toEqual([
      "Mal / hizmet bedeli (KDV hariç)",
      "Katma değer vergisi (%20)",
      "KDV tevkifatı (7/10)",
      "Damga vergisi, makbuz (binde 9,48)",
      "Vergi borcu mahsubu",
      "Yükleniciye net ödenecek",
    ]);
  });

  it("matrah olarak muayenede kabul edilen tutarı alır", () => {
    const m = muayeneOlustur(klima, null, "2026-10-16");
    expect(odemeMatrahi(klima, m)).toBe(klima.tutar);
    m.kalemler[0].kabulMiktari = 0;
    m.tamamlandi = true;
    expect(odemeMatrahi(klima, m)).toBe(0);
    expect(odemeMatrahi(klima, null)).toBe(klima.tutar);
  });
});

describe("KBS alanları", () => {
  const ad = "Serin Soğutma Ltd.";

  it("alanları eski ekrandaki sırayla ve adlarla verir", () => {
    const a = kbsAlanlari(klima, odemeHesabi(matrah, odeme(), ornekAyarlar), ad, "TR00 0000");
    expect(a.map((x) => x.ad)).toEqual([
      "Ekonomik kod",
      "Alacaklı",
      "IBAN",
      "Brüt tutar, KDV dahil",
      "KDV tevkifatı",
      "Damga vergisi",
      "Net ödeme",
      "Ödeme emri açıklaması",
    ]);
    expect(a[0].deger).toBe(klima.ekonomikKod);
    expect(a[1].deger).toBe(ad);
    expect(a[2].deger).toBe("TR00 0000");
  });

  it("brüt ve net tutarlar ödeme hesabıyla tutarlıdır", () => {
    const h = odemeHesabi(matrah, odeme(), ornekAyarlar);
    const a = kbsAlanlari(klima, h, ad, "");
    expect(a[3].deger).toBe("56.280,00");
    expect(a[4].deger).toBe("6.566,00");
    expect(a[5].deger).toBe("444,61");
    expect(a[6].deger).toBe(((56_280 * TL - 6_566 * TL - 44_461) / 100).toLocaleString("tr-TR", { minimumFractionDigits: 2 }));
    expect(a[2].deger).toBe("—");
  });

  it("tevkifat yokken tevkifat alanı 0,00 olur", () => {
    const h = odemeHesabi(matrah, odeme({ tevkifatTuru: "yok" }), ornekAyarlar);
    expect(kbsAlanlari(klima, h, ad, "x")[4].deger).toBe("0,00");
  });
});
