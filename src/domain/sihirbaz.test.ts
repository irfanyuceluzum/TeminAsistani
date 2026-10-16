import { describe, expect, it } from "vitest";
import { ornekAlimlar, ornekAyarlar, ornekLimitDonemleri } from "../data/ornekVeri";
import { dayanakKontrolleri, engelVarMi, tutarCoz, yeniDosyaNo, type Aday } from "./sihirbaz";

const TL = 100;
const aday: Aday = { onayTarihi: "2026-10-16", tutar: 38_500 * TL, ekonomikKod: "03.2.1.01", kalemKodu: "KRT" };

function kontrol(a: Aday, bent: Parameters<typeof dayanakKontrolleri>[1] = "22/d") {
  return dayanakKontrolleri(a, bent, ornekAlimlar, ornekAyarlar, ornekLimitDonemleri);
}

describe("dayanak kontrolleri", () => {
  it("limit içindeki 22/d alımında benzer alımları uyarır ama engellemez", () => {
    const k = kontrol(aday);
    expect(k.map((x) => [x.durum, x.baslik])).toEqual([
      ["tamam", "22/d limiti içinde"],
      ["tamam", "Yıllık %10 sınırı"],
      ["uyari", "1 benzer alım var"],
    ]);
    expect(k[2].detay).toContain("DT-2026-042");
    expect(engelVarMi(k)).toBe(false);
  });

  it("limiti aşan tutarda onaya geçişi engeller", () => {
    const k = kontrol({ ...aday, tutar: 1_100_000 * TL });
    expect(k[0]).toMatchObject({ durum: "engel", baslik: "22/d limiti aşılıyor" });
    expect(engelVarMi(k)).toBe(true);
  });

  it("limit dönemi olmayan tarihte engeller", () => {
    expect(kontrol({ ...aday, onayTarihi: "2027-03-01" })[0].durum).toBe("engel");
  });

  it("22/d dışındaki bentlerde belge ve KİK bildirimi ister", () => {
    const k = kontrol(aday, "22/b");
    expect(k.map((x) => x.durum)).toEqual(["yapilacak", "yapilacak"]);
    expect(k[1].baslik).toBe("KİK bildirimi");
  });
});

describe("dosya numarası", () => {
  it("o yılın en büyük numarasının bir fazlasını verir", () => {
    expect(yeniDosyaNo(ornekAlimlar, 2026)).toBe("DT-2026-043");
    expect(yeniDosyaNo(ornekAlimlar, 2027)).toBe("DT-2027-001");
  });
});

describe("tutar girişi", () => {
  it("Türkçe sayı biçimini kuruşa çevirir", () => {
    expect(tutarCoz("38.500,00")).toBe(3_850_000);
    expect(tutarCoz("₺ 38.500")).toBe(3_850_000);
    expect(tutarCoz("1250,5")).toBe(125_050);
  });

  it("geçersiz girişi reddeder", () => {
    expect(tutarCoz("")).toBeNull();
    expect(tutarCoz("abc")).toBeNull();
    expect(tutarCoz("12,345")).toBeNull();
  });
});
