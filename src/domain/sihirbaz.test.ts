import { describe, expect, it } from "vitest";
import { ornekAlimlar, ornekAyarlar, ornekLimitDonemleri } from "../data/ornekVeri";
import { BENTLER, bentBilgisi, dayanakKontrolleri, engelVarMi, sozlesmeZorunlu, tutarCoz, yeniDosyaNo, type Aday } from "./sihirbaz";

const TL = 100;
const aday: Aday = { onayTarihi: "2026-10-16", tutar: 38_500 * TL, ekonomikKod: "03.2.1.01", kalemKodu: "KRT" };

function kontrol(a: Aday) {
  return dayanakKontrolleri(a, ornekAlimlar, ornekAyarlar, ornekLimitDonemleri);
}

describe("dayanak kontrolleri", () => {
  it("limit içindeki 22/d alımında benzer alımları uyarır ama engellemez", () => {
    const k = kontrol(aday);
    expect(k.map((x) => [x.durum, x.baslik])).toEqual([
      ["tamam", "22/d limiti içinde"],
      ["tamam", "Yıllık %10 sınırı"],
      ["uyari", "1 benzer alım var"],
      ["yapilacak", "KİK bildirimi"],
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

  it("her zaman KİK bildirimini hatırlatır", () => {
    const k = kontrol(aday);
    expect(k[k.length - 1].baslik).toBe("KİK bildirimi");
  });
});

describe("dosya numarası", () => {
  it("o yılın en büyük numarasının bir fazlasını verir", () => {
    expect(yeniDosyaNo(ornekAlimlar, 2026)).toBe("DT-2026-043");
    expect(yeniDosyaNo(ornekAlimlar, 2027)).toBe("DT-2027-001");
  });

  it("en büyük numara gizli (22/d dışı) bir kayıttaysa onun üstünde numara üretir", () => {
    const gizli = { ...ornekAlimlar[0], id: "DT-2026-050", bent: "22/b" as const };
    expect(yeniDosyaNo([...ornekAlimlar, gizli], 2026)).toBe("DT-2026-051");
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
    expect(tutarCoz("12abc")).toBeNull();
    expect(tutarCoz("1.2345")).toBeNull();
    expect(tutarCoz("-5")).toBeNull();
  });

  it("noktayı ondalık ya da binlik olarak doğru okur", () => {
    expect(tutarCoz("2.5")).toBe(250);
    expect(tutarCoz("2.50")).toBe(250);
    expect(tutarCoz("1.250")).toBe(125_000);
    expect(tutarCoz("1.250,50")).toBe(125_050);
    expect(tutarCoz("38.500")).toBe(3_850_000);
    expect(tutarCoz("12 TL")).toBe(1200);
    expect(tutarCoz("12 tl")).toBe(1200);
    expect(tutarCoz("1,234.5")).toBe(123_450);
    expect(tutarCoz("0")).toBe(0);
  });
});

describe("bentler ve sözleşme", () => {
  it("yalnız 22/d bendini içerir", () => {
    expect(BENTLER.map((b) => b.kod)).toEqual(["22/d"]);
  });

  it("bentBilgisi her kod için 22/d bilgisini döner (gizli eski kayıtlar çökmez)", () => {
    expect(bentBilgisi("22/c").kod).toBe("22/d");
    expect(bentBilgisi("22/ı").kod).toBe("22/d");
  });

  it("süreye yayılan işte sözleşme ister, 22/c bentli süresiz alımda istemez", () => {
    expect(kontrol({ ...aday, sureliIs: true }).some((x) => x.baslik === "Sözleşme zorunlu")).toBe(true);
    expect(kontrol(aday).some((x) => x.baslik === "Sözleşme zorunlu")).toBe(false);
    expect(sozlesmeZorunlu({ bent: "22/c" })).toBe(false);
    expect(sozlesmeZorunlu({ bent: "22/c", sureliIs: true })).toBe(true);
  });
});
