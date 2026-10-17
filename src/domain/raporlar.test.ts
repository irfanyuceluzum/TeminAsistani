import { describe, expect, it } from "vitest";
import { ornekAlimlar, ornekAyarlar, ornekPiyasa } from "../data/ornekVeri";
import { csvOlustur, kikBildirimleri, yillar, yillikOzet } from "./raporlar";

const TL = 100;

describe("yıllık özet", () => {
  const o = yillikOzet(ornekAlimlar, 2026, ornekAyarlar, ornekPiyasa);

  it("tüm bentlerin ve 22/d'nin toplamını verir", () => {
    expect(o.adet).toBe(18);
    expect(o.ddAdet).toBe(12);
    expect(o.ddToplam).toBe(330_880 * TL);
    expect(o.toplam).toBe(o.bentler.reduce((s, b) => s + b.tutar, 0));
  });

  it("bentleri tutara göre sıralar ve payları bire tamamlar", () => {
    expect(o.bentler[0].bent).toBe("22/e");
    expect(o.bentler.reduce((s, b) => s + b.pay, 0)).toBeCloseTo(1);
  });

  it("22/d'yi aylara dağıtır", () => {
    expect(o.aylik).toHaveLength(12);
    expect(o.aylik[9]).toEqual({ ay: 10, adet: 3, tutar: (19_800 + 25_380 + 38_500) * TL });
    expect(o.aylik.reduce((s, a) => s + a.tutar, 0)).toBe(o.ddToplam);
  });

  it("tamamlanan araştırmalardan ortalama teklif sayısını çıkarır", () => {
    expect(o.ortalamaTeklif).toBe(1);
  });

  it("ödeneği olmayan yılda %10 durumu vermez", () => {
    expect(yillikOzet(ornekAlimlar, 2025, ornekAyarlar, []).yuzdeOn).toBeNull();
  });

  it("verideki yılları ve içinde bulunulan yılı listeler", () => {
    expect(yillar(ornekAlimlar, 2027)).toEqual([2027, 2026]);
  });
});

describe("KİK bildirimleri", () => {
  it("22/d dışındaki alımları, bekleyenler önce olmak üzere listeler", () => {
    const k = kikBildirimleri(ornekAlimlar, 2026, { "DT-2026-019": { "kik-bildirimi": { tamam: true, tarih: "2026-04-02", not: "" } } });
    expect(k.map((x) => x.alim.id)).toEqual(["DT-2026-038", "DT-2026-035", "DT-2026-031", "DT-2026-024", "DT-2026-012", "DT-2026-019"]);
    expect(k[k.length - 1]).toMatchObject({ bildirildi: true, tarih: "2026-04-02" });
  });
});

describe("CSV", () => {
  it("Türkçe Excel'in okuyacağı biçimde yazar", () => {
    const csv = csvOlustur(["Dosya", "Konu", "Tutar"], [["DT-1", 'Kâğıt; "A4"', 1234.5]]);
    expect(csv).toBe('﻿Dosya;Konu;Tutar\r\nDT-1;"Kâğıt; ""A4""";1234,5\r\n');
  });
});
