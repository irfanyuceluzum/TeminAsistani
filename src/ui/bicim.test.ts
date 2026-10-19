import { describe, expect, it } from "vitest";
import { pdfDosyaAdi } from "./bicim";

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
