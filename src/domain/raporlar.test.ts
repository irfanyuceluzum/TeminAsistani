import { describe, expect, it } from "vitest";
import { ornekAlimlar, ornekAyarlar, ornekEvraklar, ornekPiyasa } from "../data/ornekVeri";
import { csvOlustur, kikBildirimleri, kikSonGunu, yillar, yillikOzet } from "./raporlar";

const TL = 100;

describe("yıllık özet", () => {
  const o = yillikOzet(ornekAlimlar, 2026, ornekAyarlar, ornekPiyasa);

  it("tüm bentlerin ve 22/d'nin toplamını verir", () => {
    // 19 alım: DT-2026-037 (tamamlanmış örnek dosya, ₺32.200) eklendi; önceki değerler 18, 12 ve ₺330.880
    expect(o.adet).toBe(19);
    // örnek veride 22/d dışı kalmadı: altı kayıt 22/d'ye çevrildi (₺199.040)
    expect(o.ddAdet).toBe(19);
    expect(o.ddToplam).toBe((330_880 + 32_200 + 199_040) * TL);
  });

  it("22/d toplamı görünen bütün alımların toplamına eşittir", () => {
    const iptalsiz = ornekAlimlar.filter((a) => a.asama !== "iptal" && a.onayTarihi.startsWith("2026"));
    expect(o.ddToplam).toBe(iptalsiz.reduce((s, a) => s + a.tutar, 0));
    expect(o.ddToplam).toBe(o.toplam);
    expect(o.ddAdet).toBe(o.adet);
  });

  it("22/d'yi aylara dağıtır", () => {
    expect(o.aylik).toHaveLength(12);
    expect(o.aylik[8].adet).toBeGreaterThanOrEqual(1);
    expect(o.aylik[9]).toEqual({ ay: 10, adet: 3, tutar: (19_800 + 25_380 + 38_500) * TL });
    expect(o.aylik.reduce((s, a) => s + a.tutar, 0)).toBe(o.ddToplam);
  });

  it("tamamlanan araştırmalardan ortalama teklif sayısını çıkarır", () => {
    // DT-2026-040 (1 teklif) ve DT-2026-037 (3 teklif) tamamlandı; önceki değer 1
    expect(o.ortalamaTeklif).toBe(2);
  });

  it("ödeneği olmayan yılda %10 durumu vermez", () => {
    expect(yillikOzet(ornekAlimlar, 2025, ornekAyarlar, []).yuzdeOn).toBeNull();
  });

  it("verideki yılları ve içinde bulunulan yılı listeler", () => {
    expect(yillar(ornekAlimlar, 2027)).toEqual([2027, 2026]);
  });
});

describe("KİK bildirimleri", () => {
  const evraklar = { ...ornekEvraklar, "DT-2026-019": { "kik-bildirimi": { tamam: true, tarih: "2026-04-02", not: "" } } };
  const k = kikBildirimleri(ornekAlimlar, 2026, evraklar, "2026-10-17");

  it("siparişi verilmiş tüm alımları bentten bağımsız listeler", () => {
    // DT-2026-037 eklendi; önceki değer 16
    expect(k).toHaveLength(17);
    expect(k.some((x) => x.alim.id === "DT-2026-019")).toBe(true);
    expect(k.some((x) => x.alim.id === "DT-2026-041")).toBe(false);
  });

  it("son günü sipariş ayını izleyen ayın 10'u olarak hesaplar", () => {
    expect(k.find((x) => x.alim.id === "DT-2026-040")!.sonGun).toBe("2026-11-10");
    expect(k.find((x) => x.alim.id === "DT-2026-039")).toMatchObject({ sonGun: "2026-10-10", gecikti: true });
    expect(kikSonGunu({ ...ornekAlimlar[0], onayTarihi: "2026-12-20" }, undefined)).toBe("2027-01-10");
  });

  it("bekleyenleri öne, bildirilenleri sona koyar", () => {
    const ilkBildirilen = k.findIndex((x) => x.bildirildi);
    expect(ilkBildirilen).toBeGreaterThan(0);
    expect(k.slice(ilkBildirilen).every((x) => x.bildirildi && !x.gecikti)).toBe(true);
    expect(k.find((x) => x.alim.id === "DT-2026-019")).toMatchObject({ bildirildi: true, tarih: "2026-04-02" });
  });
});

describe("CSV", () => {
  it("Türkçe Excel'in okuyacağı biçimde yazar", () => {
    const csv = csvOlustur(["Dosya", "Konu", "Tutar"], [["DT-1", 'Kâğıt; "A4"', 1234.5]]);
    expect(csv).toBe('﻿Dosya;Konu;Tutar\r\nDT-1;"Kâğıt; ""A4""";1234,5\r\n');
  });
});
