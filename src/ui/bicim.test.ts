import { describe, expect, it } from "vitest";
import { pdfDosyaAdi, yedekOzeti, yolDosyaAdi } from "./bicim";

describe("yolDosyaAdi", () => {
  it("Unix ve Windows yollarından dosya adını alır", () => {
    expect(yolDosyaAdi("/home/u/yedek/a.db")).toBe("a.db");
    expect(yolDosyaAdi("C:\\Yedek\\b.db")).toBe("b.db");
    expect(yolDosyaAdi("c.db")).toBe("c.db");
  });
});

describe("yedekOzeti", () => {
  it("alım ve tedarikçi sayısını yazar", () => {
    expect(yedekOzeti(12, 3)).toBe("12 alım dosyası, 3 tedarikçi");
  });
});

describe("pdfDosyaAdi", () => {
  it("dosya numarasını başa alır, başlıktaki tekrarını atar", () => {
    expect(pdfDosyaAdi("Doğrudan temin onay belgesi · DT-2026-041", "DT-2026-041")).toBe("DT-2026-041 Doğrudan temin onay belgesi");
  });

  it("numarasız başlığa dosya numarasını ekler", () => {
    expect(pdfDosyaAdi("Piyasa Fiyat Araştırması Tutanağı", "DT-2026-041")).toBe("DT-2026-041 Piyasa Fiyat Araştırması Tutanağı");
  });

  it("Windows'ta yasak karakterleri ve sondaki noktayı temizler", () => {
    expect(pdfDosyaAdi("Fiyat Teklif Mektubu: Ece Ltd. Şti.", "DT-2026-041")).toBe("DT-2026-041 Fiyat Teklif Mektubu - Ece Ltd. Şti");
    expect(pdfDosyaAdi('A/B "C" <D>?')).toBe("A - B - C - D");
  });

  it("dosya numarası yoksa yalnız başlığı, boşsa 'Belge' döndürür", () => {
    expect(pdfDosyaAdi("Taşınır İşlem Fişi Formu")).toBe("Taşınır İşlem Fişi Formu");
    expect(pdfDosyaAdi("", undefined)).toBe("Belge");
  });
});
