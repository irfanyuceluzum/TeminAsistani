import { describe, expect, it } from "vitest";
import { ornekAyarlar, ornekLimitDonemleri } from "../data/ornekVeri";
import { ayarHatalari, limitDonemiHatalari, onerilenDonem } from "./parametreler";
import type { LimitDonemi } from "./tipler";

const TL = 100;
const yeni: LimitDonemi = {
  baslangic: "2027-02-01",
  bitis: "2028-01-31",
  buyuksehir: 1_200_000 * TL,
  diger: 400_000 * TL,
  dayanak: "2027/1 Kamu İhale Tebliği",
};

describe("önerilen dönem", () => {
  it("son dönemin ertesi gününden bir yıl önerir", () => {
    expect(onerilenDonem(ornekLimitDonemleri, "2026-10-16")).toEqual({ baslangic: "2027-02-01", bitis: "2028-01-31" });
  });

  it("dönem yoksa içinde bulunulan dönemi önerir", () => {
    expect(onerilenDonem([], "2026-10-16")).toEqual({ baslangic: "2026-02-01", bitis: "2027-01-31" });
    expect(onerilenDonem([], "2027-01-10")).toEqual({ baslangic: "2026-02-01", bitis: "2027-01-31" });
  });
});

describe("limit dönemi doğrulama", () => {
  it("geçerli dönemi kabul eder", () => {
    expect(limitDonemiHatalari(yeni, ornekLimitDonemleri)).toEqual([]);
  });

  it("çakışan dönemi reddeder", () => {
    const h = limitDonemiHatalari({ ...yeni, baslangic: "2027-01-15" }, ornekLimitDonemleri);
    expect(h[0]).toContain("çakışıyor");
  });

  it("ters tarihleri, sıfır limiti ve boş dayanağı bildirir", () => {
    const h = limitDonemiHatalari({ ...yeni, bitis: "2027-01-01", diger: 0, dayanak: " " }, []);
    expect(h).toHaveLength(3);
  });
});

describe("ayar doğrulama", () => {
  it("örnek ayarları kabul eder", () => {
    expect(ayarHatalari(ornekAyarlar)).toEqual([]);
  });

  it("ölçütsüz bölme kontrolünü ve geçersiz oranı reddeder", () => {
    const h = ayarHatalari({
      ...ornekAyarlar,
      bolme: { pencereGun: 0, ayniKalem: false, ayniEkonomikKod: false, ayniTedarikci: false },
      damga: { ...ornekAyarlar.damga, makbuzOrani: -1 },
    });
    expect(h).toHaveLength(3);
  });
});
