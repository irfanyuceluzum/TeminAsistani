import { describe, expect, it } from "vitest";
import { ornekAlimlar, ornekBasamaklar, ornekEvraklar, ornekMuayeneler, ornekPiyasa } from "../data/ornekVeri";
import { basamaklar } from "./basamaklar";
import type { EvrakKaydi } from "./dosya";
import { dizinSatirlari, kontrolOzeti, type KapanisGirdisi } from "./kapanis";

const ID = "DT-2026-037";
const tamGirdi = (bugun = "2026-10-06"): KapanisGirdisi => ({
  alim: ornekAlimlar.find((a) => a.id === ID)!,
  piyasa: ornekPiyasa.find((p) => p.alimId === ID)!,
  dosya: structuredClone(ornekBasamaklar.find((d) => d.alimId === ID)!),
  evraklar: structuredClone(ornekEvraklar[ID]) as Record<string, EvrakKaydi>,
  muayene: ornekMuayeneler.find((m) => m.alimId === ID)!,
  bugun,
});

describe("12 basamak ve kapanış koşulu", () => {
  it("12. basamak dosya tamamlandıysa tamamdır", () => {
    const g = tamGirdi();
    const b = basamaklar(g);
    expect(b).toHaveLength(12);
    expect(b[11]).toMatchObject({ no: 12, ad: "Kontrol ve kapanış", grup: "Kapanış", durum: "tamam" });
    const acik = basamaklar({ ...g, alim: { ...g.alim, asama: "odeme" } });
    expect(acik[10].durum).toBe("tamam");
    expect(acik[11].durum).toBe("suruyor");
  });
});

describe("kontrolOzeti", () => {
  it("örnek tamamlanmış dosyada engel yoktur ve hazırdır", () => {
    const o = kontrolOzeti(tamGirdi());
    expect(o.engeller).toEqual([]);
    expect(o.hazir).toBe(true);
    expect(o.uyarilar.map((u) => u.durum)).toEqual(["tamam"]); // KİK bildirimi yapıldı
  });

  it("tamamlanmamış basamak ve zorunlu evrak eksiği engeldir", () => {
    const g = tamGirdi();
    g.alim = { ...g.alim, sureliIs: true };
    delete g.evraklar["siparis-yazisi"];
    const o = kontrolOzeti(g);
    expect(o.hazir).toBe(false);
    expect(o.engeller.every((e) => e.durum === "engel")).toBe(true);
    expect(o.engeller.some((e) => e.baslik.includes("8. basamak") && e.baslik.includes("Sözleşme"))).toBe(true);
    expect(o.engeller.some((e) => e.baslik === "Eksik evrak: Sözleşme")).toBe(true);
  });

  it("sipariş yazısı ve muayene talebi isteğe bağlıdır; eksikken kapanış engellenmez", () => {
    const g = tamGirdi();
    delete g.evraklar["siparis-yazisi"];
    delete g.evraklar["muayene-talebi"];
    const o = kontrolOzeti(g);
    expect(o.engeller).toEqual([]);
    expect(o.hazir).toBe(true);
  });

  it("TİF, ödeme emri ve KİK eksikken engel yoktur; yapılacak bilgisi verilir", () => {
    const g = tamGirdi();
    delete g.evraklar["tasinir-fisi"];
    delete g.evraklar["odeme-emri"];
    delete g.evraklar["kik-bildirimi"];
    const o = kontrolOzeti(g);
    expect(o.engeller).toEqual([]);
    expect(o.hazir).toBe(true);
    expect(o.uyarilar.filter((u) => u.durum === "yapilacak").map((u) => u.baslik)).toEqual([
      "KİK bildirimi 10.10.2026 tarihine kadar yapılmalı",
      "Taşınır işlem fişi sayı ve tarihi girilmedi",
      "Ödeme emri belgesi sayı ve tarihi girilmedi",
    ]);
    const tif = o.uyarilar.find((u) => u.baslik.startsWith("Taşınır"))!;
    expect(tif.detay).toBe("TKYS'de düzenlenen taşınır işlem fişinin sayı ve tarihini dizin için girebilirsiniz.");
  });

  it("KİK son günü geçmişse gecikti uyarısı verir, kapanışı engellemez", () => {
    const g = tamGirdi("2026-10-11");
    delete g.evraklar["kik-bildirimi"];
    const o = kontrolOzeti(g);
    const kik = o.uyarilar.find((u) => u.baslik === "KİK bildirimi gecikti")!;
    expect(kik.durum).toBe("uyari");
    expect(kik.detay).toContain("10.10.2026");
    expect(o.hazir).toBe(true);
  });

  it("sayı girilmemiş (yalnız tarih) TİF yine yapılacak sayılır", () => {
    const g = tamGirdi();
    g.evraklar["tasinir-fisi"] = { tamam: true, tarih: "2026-09-25", not: "" };
    expect(kontrolOzeti(g).uyarilar.some((u) => u.baslik === "Taşınır işlem fişi sayı ve tarihi girilmedi")).toBe(true);
  });

  it("tarih sırası uyarıları uyarılara katılır", () => {
    const g = tamGirdi();
    g.evraklar["tasinir-fisi"] = { tamam: true, tarih: "2026-09-01", not: "TİF 1" };
    const o = kontrolOzeti(g);
    expect(o.uyarilar.some((u) => u.durum === "uyari" && u.baslik.includes("Taşınır işlem fişi (12. basamak)"))).toBe(true);
    expect(o.hazir).toBe(true);
  });
});

describe("dizinSatirlari", () => {
  it("evrakları düzenlenme sırasıyla listeler", () => {
    const s = dizinSatirlari(tamGirdi());
    expect(s.map((x) => x.sira)).toEqual(s.map((_, i) => i + 1));
    expect(s.map((x) => x.ad)).toEqual([
      "İhtiyaç talep yazısı",
      "Fiyat isteme yazısı",
      "Yaklaşık maliyet cetveli",
      "Doğrudan temin onay belgesi",
      "Teklif mektupları",
      "Piyasa fiyat araştırma tutanağı",
      "Yasaklılık sorgusu çıktıları",
      "Sipariş yazısı veya sözleşme",
      "Muayene talep yazısı",
      "Fatura",
      "Muayene raporu",
      "Muayene ve kabul tutanağı",
      "Taşınır işlem fişi",
      "Ödeme emri belgesi",
      "KİK bildirimi",
    ]);
  });

  it("DT-2026-037: TİF 2026/118 ve ÖEB 2026/0412 sayıları dizinde görünür", () => {
    const s = dizinSatirlari(tamGirdi());
    expect(s.find((x) => x.ad === "Taşınır işlem fişi")).toMatchObject({ tarih: "2026-09-25", sayi: "TİF 2026/118", not: "TKYS'de düzenlendi" });
    expect(s.find((x) => x.ad === "Ödeme emri belgesi")).toMatchObject({ tarih: "2026-09-29", sayi: "2026/0412", not: "MYS'de düzenlendi" });
    expect(s.find((x) => x.ad === "Doğrudan temin onay belgesi")).toMatchObject({ tarih: "2026-09-08", sayi: "2026/37-OB", not: "Tamam" });
  });

  it("kaydı olmayan evrak null tarih/sayı ile Eksik, dış sistemde TKYS/MYS notu taşır", () => {
    const g = tamGirdi();
    delete g.evraklar["tasinir-fisi"];
    delete g.evraklar["odeme-emri"];
    delete g.evraklar["fatura"];
    const s = dizinSatirlari(g);
    expect(s.find((x) => x.ad === "Taşınır işlem fişi")).toMatchObject({ tarih: null, sayi: null, not: "TKYS'de düzenlenir" });
    expect(s.find((x) => x.ad === "Ödeme emri belgesi")).toMatchObject({ tarih: null, sayi: null, not: "MYS'de düzenlenir" });
    expect(s.find((x) => x.ad === "Fatura")).toMatchObject({ tarih: null, sayi: null, not: "Eksik" });
  });

  it("tarih ISO zaman damgalıysa güne indirgenir", () => {
    const g = tamGirdi();
    g.evraklar["fatura"] = { tamam: true, tarih: "2026-09-24T21:30:00.000Z", not: "F1" };
    expect(dizinSatirlari(g).find((x) => x.ad === "Fatura")).toMatchObject({ tarih: "2026-09-24", sayi: "F1" });
  });
});
