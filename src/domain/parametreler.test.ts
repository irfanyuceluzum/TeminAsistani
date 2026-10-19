import { describe, expect, it } from "vitest";
import { ornekAyarlar, ornekLimitDonemleri } from "../data/ornekVeri";
import { ayarHatalari, butceTertibi, limitDonemiHatalari, onerilenDonem } from "./parametreler";
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

describe("butceTertibi", () => {
  const butce = { kurumsal: "18.01.31.00", fonksiyonel: "09.1.2.00", finansman: "1" };
  it("tam kodu sırayla birleştirir", () => {
    expect(butceTertibi({ ...ornekAyarlar, butce }, "03.2.5.01")).toBe("18.01.31.00 · 09.1.2.00 · 1 · 03.2.5.01");
  });
  it("kısmi kodda boş parçaları atlar", () => {
    expect(butceTertibi({ ...ornekAyarlar, butce: { ...butce, fonksiyonel: "" } }, "03.2.5.01")).toBe("18.01.31.00 · 1 · 03.2.5.01");
  });
  it("idare kodu yoksa yalnız ekonomik kodu döner", () => {
    expect(butceTertibi({ ...ornekAyarlar, butce: undefined }, "03.2.5.01")).toBe("03.2.5.01");
  });
  it("hiçbir kod yoksa tire döner", () => {
    expect(butceTertibi({ ...ornekAyarlar, butce: undefined }, "")).toBe("—");
  });
});

describe("ayarHatalari bütçe biçimi", () => {
  it("geçerli ve boş kodları kabul eder", () => {
    expect(ayarHatalari({ ...ornekAyarlar, butce: { kurumsal: "18.01.31.00", fonksiyonel: "09.1.2.00", finansman: "1" } })).toEqual([]);
    expect(ayarHatalari({ ...ornekAyarlar, butce: { kurumsal: "", fonksiyonel: "", finansman: "" } })).toEqual([]);
  });
  it("bozuk kodlarda alanı söyleyen hata verir", () => {
    const h = ayarHatalari({ ...ornekAyarlar, butce: { kurumsal: "18.01", fonksiyonel: "09.12.0.00", finansman: "12" } });
    expect(h).toHaveLength(3);
    expect(h[0]).toContain("Kurumsal kod");
    expect(h[1]).toContain("Fonksiyonel kod");
    expect(h[2]).toContain("Finansman tipi");
  });
});
