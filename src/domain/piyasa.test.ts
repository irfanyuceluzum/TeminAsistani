import { describe, expect, it } from "vitest";
import { ornekAlimlar, ornekAyarlar, ornekLimitDonemleri, ornekPiyasa, ornekTedarikciler } from "../data/ornekVeri";
import { degerlendir, firmaToplami, piyasaKontrolleri, yaziEksikleri, type PiyasaArastirmasi } from "./piyasa";

const TL = 100;
const alim = ornekAlimlar.find((a) => a.id === "DT-2026-041")!;

function arastirma(p: Partial<PiyasaArastirmasi> = {}): PiyasaArastirmasi {
  return {
    alimId: alim.id,
    kalemler: [
      { id: "k1", ad: "Çamaşır suyu, 4 L", miktar: 120, birim: "adet" },
      { id: "k2", ad: "Sıvı el sabunu, 5 L", miktar: 60, birim: "adet" },
      { id: "k3", ad: "Çöp poşeti", miktar: 300, birim: "rulo" },
    ],
    teklifler: [
      { tedarikciId: "ece", teklifTarihi: "2026-10-14", yasaklilikSorgusu: "2026-10-16", fiyatlar: { k1: 86 * TL, k2: 142 * TL, k3: 24 * TL }, belgeAlindi: true },
      { tedarikciId: "toros", teklifTarihi: "2026-10-15", yasaklilikSorgusu: "2026-10-16", fiyatlar: { k1: 79 * TL, k2: 150 * TL, k3: 23 * TL }, belgeAlindi: true },
      { tedarikciId: "kaya", teklifTarihi: "2026-10-15", yasaklilikSorgusu: "2026-10-16", fiyatlar: { k1: 91 * TL, k2: 149 * TL, k3: 21 * TL }, belgeAlindi: true },
    ],
    degerlendirme: "toplam",
    gorevliler: "",
    tamamlandi: false,
    yazi: { sayi: "", tarih: "2026-10-09", sonTeklifTarihi: "2026-10-15", teslimYeri: "", teslimSuresi: "", aciklama: "" },
    ...p,
  };
}

function kontroller(p: PiyasaArastirmasi) {
  return piyasaKontrolleri(p, degerlendir(p), alim, ornekAyarlar, ornekLimitDonemleri, ornekTedarikciler);
}

describe("değerlendirme", () => {
  it("toplam bazlıda en düşük toplamı veren firmayı seçer", () => {
    const p = arastirma();
    expect(firmaToplami(p, "ece")).toBe(26_040 * TL);
    const s = degerlendir(p)!;
    expect(s.kazananlar).toEqual(["toros"]);
    expect(s.toplam).toBe(25_380 * TL);
  });

  it("kalem bazlıda her kalemi en düşük fiyata atar", () => {
    const s = degerlendir(arastirma({ degerlendirme: "kalem" }))!;
    expect(s.atamalar.map((a) => a.tedarikciId)).toEqual(["toros", "ece", "kaya"]);
    expect(s.toplam).toBe(24_300 * TL);
  });

  it("eksik fiyat veren firmayı toplam bazlıda dışarıda bırakır", () => {
    const p = arastirma();
    p.teklifler[1].fiyatlar.k2 = null;
    expect(firmaToplami(p, "toros")).toBeNull();
    expect(degerlendir(p)!.kazananlar).toEqual(["ece"]);
  });

  it("ondalık miktarda kuruşa yuvarlar", () => {
    const p = arastirma({ kalemler: [{ id: "k1", ad: "Deterjan", miktar: 2.5, birim: "kg" }] });
    p.teklifler = [{ tedarikciId: "ece", teklifTarihi: null, yasaklilikSorgusu: "2026-10-16", fiyatlar: { k1: 3_333 } }];
    expect(degerlendir(p)!.toplam).toBe(8_333);
  });

  it("eşitliği bildirir ve ilk girileni seçer", () => {
    const p = arastirma();
    p.teklifler[0].fiyatlar = { k1: 79 * TL, k2: 150 * TL, k3: 23 * TL };
    const s = degerlendir(p)!;
    expect(s.kazananlar).toEqual(["ece"]);
    expect(s.esitlikler).toHaveLength(1);
  });
});

describe("kontroller", () => {
  it("tam araştırmada engel çıkarmaz", () => {
    const k = kontroller(arastirma());
    expect(k.filter((x) => x.durum === "engel")).toEqual([]);
    expect(k.map((x) => x.baslik)).toContain("3 teklif alındı");
    expect(k[0]).toMatchObject({ durum: "tamam", baslik: "Teklif isteme yazısı" });
  });

  it("kazananın yasaklılık sorgusu yoksa engeller", () => {
    const p = arastirma();
    p.teklifler[1].yasaklilikSorgusu = null;
    expect(kontroller(p).find((x) => x.durum === "engel")?.detay).toContain("Toros AŞ");
  });

  it("az teklifte uyarır, onay tutarını aşınca uyarır", () => {
    const p = arastirma();
    p.teklifler = p.teklifler.slice(0, 2);
    p.teklifler[0].fiyatlar = { k1: 200 * TL, k2: 200 * TL, k3: 50 * TL };
    p.teklifler[1].fiyatlar = { k1: 200 * TL, k2: 210 * TL, k3: 50 * TL };
    const basliklar = kontroller(p).map((x) => `${x.durum}:${x.baslik}`);
    expect(basliklar).toContain("uyari:2 teklif alındı");
    expect(basliklar).toContain("uyari:Onay tutarı aşılıyor");
  });

  it("kalem bazlı çok firmalı sonuçta ayrı sipariş hatırlatır", () => {
    const k = kontroller(arastirma({ degerlendirme: "kalem" }));
    expect(k[k.length - 1].baslik).toBe("3 ayrı sipariş");
  });

  it("kalem yoksa tek engel döner", () => {
    expect(kontroller(arastirma({ kalemler: [] }))).toHaveLength(1);
  });

  it("kazananın kaşeli teklif belgesi yoksa engeller", () => {
    const p = arastirma();
    p.teklifler[1].belgeAlindi = false;
    expect(kontroller(p).find((x) => x.durum === "engel")).toMatchObject({ baslik: "Kaşeli teklif belgesi yok" });
  });
});

describe("teklif isteme yazısı", () => {
  it("eksik kalem bilgisini ve son teklif tarihini ister", () => {
    const p = arastirma({ yazi: undefined });
    p.kalemler[0].miktar = 0;
    expect(yaziEksikleri(p)).toEqual(["1 kalemin adı ya da miktarı eksik.", "Yazı tarihi girilmedi.", "Son teklif tarihi girilmedi."]);
    expect(kontroller(p)[0]).toMatchObject({ durum: "yapilacak", baslik: "Teklif isteme yazısı" });
  });

  it("son teklif tarihinin yazıdan önce olmasını reddeder", () => {
    const p = arastirma({ yazi: { sayi: "", tarih: "2026-10-09", sonTeklifTarihi: "2026-10-01", teslimYeri: "", teslimSuresi: "", aciklama: "" } });
    expect(yaziEksikleri(p)).toEqual(["Son teklif tarihi yazı tarihinden önce olamaz."]);
  });
});

describe("tutanaktaki seçilen fiyat sütunu", () => {
  it("toplam esasında kazananın fiyatlarını verir; toplamı sonuç toplamına eşittir", () => {
    const s = degerlendir(structuredClone(ornekPiyasa[0]))!;
    expect(new Set(s.atamalar.map((a) => a.tedarikciId)).size).toBe(1);
    expect(s.atamalar.reduce((t, a) => t + a.tutar, 0)).toBe(s.toplam);
  });

  it("kalem esasında her kalemin en düşük fiyatını verir; toplamı yine sonuç toplamıdır", () => {
    const p: PiyasaArastirmasi = { ...structuredClone(ornekPiyasa[0]), degerlendirme: "kalem" };
    const s = degerlendir(p)!;
    for (const a of s.atamalar) {
      const fiyatlar = p.teklifler.map((t) => t.fiyatlar[a.kalemId]).filter((x): x is number => typeof x === "number");
      expect(a.birimFiyat).toBe(Math.min(...fiyatlar));
    }
    expect(s.atamalar.reduce((t, a) => t + a.tutar, 0)).toBe(s.toplam);
  });
});
