import { describe, expect, it } from "vitest";
import {
  benzerAlimlar,
  bolmeRiskleri,
  ddLimitKontrolu,
  limitDonemiBul,
  malAlimiMi,
  odenekSiniri,
  yuzdeOnDurumu,
} from "./kurallar";
import type { Alim, BolmeKurallari, LimitDonemi } from "./tipler";

const TL = 100;

describe("odenekSiniri", () => {
  it("ödeneğin yüzde onu, kuruş tamsayıya aşağı yuvarlanır", () => {
    expect(odenekSiniri(0)).toBe(0);
    expect(odenekSiniri(1_000_000)).toBe(100_000);
    expect(odenekSiniri(1_009)).toBe(100);
  });
});

const donemler: LimitDonemi[] = [
  { baslangic: "2025-02-01", bitis: "2026-01-31", buyuksehir: 800_366 * TL, diger: 266_618 * TL, dayanak: "2025" },
  { baslangic: "2026-02-01", bitis: "2027-01-31", buyuksehir: 1_021_827 * TL, diger: 340_391 * TL, dayanak: "2026/1" },
];

function alim(p: Partial<Alim>): Alim {
  return {
    id: "DT-1",
    onayTarihi: "2026-10-01",
    konu: "Kırtasiye",
    bent: "22/d",
    tutar: 10_000 * TL,
    ekonomikKod: "03.2.1.01",
    kalemKodu: "KRT",
    tedarikciId: null,
    asama: "tamamlandi",
    sonIslem: "2026-10-01",
    ...p,
  };
}

const kurallar: BolmeKurallari = { pencereGun: 60, ayniEkonomikKod: false, ayniKalem: true, ayniTedarikci: false };

describe("mal alımı tanıma", () => {
  it("03.2 ve 06.1 kodlarını mal alımı sayar", () => {
    expect(malAlimiMi("03.2.2.01")).toBe(true);
    expect(malAlimiMi("03.2.1.01")).toBe(true);
    expect(malAlimiMi("06.1.2.01")).toBe(true);
  });

  it("hizmet ve yapım kodlarını mal alımı saymaz", () => {
    expect(malAlimiMi("03.5.5.01")).toBe(false);
    expect(malAlimiMi("03.7.1.02")).toBe(false);
    expect(malAlimiMi("06.5.1.01")).toBe(false);
  });
});

describe("limit dönemi", () => {
  it("ocak ayındaki alımda önceki dönemin limitini seçer", () => {
    expect(limitDonemiBul("2026-01-20", donemler)?.dayanak).toBe("2025");
    expect(limitDonemiBul("2026-02-01", donemler)?.dayanak).toBe("2026/1");
  });

  it("konuma göre limiti uygular", () => {
    const tutar = 500_000 * TL;
    expect(ddLimitKontrolu(tutar, "2026-10-16", "buyuksehir", donemler).durum).toBe("icinde");
    expect(ddLimitKontrolu(tutar, "2026-10-16", "diger", donemler).durum).toBe("asiyor");
  });

  it("limitin tam kendisi aşım sayılmaz", () => {
    expect(ddLimitKontrolu(340_391 * TL, "2026-10-16", "diger", donemler).durum).toBe("icinde");
  });

  it("tanımsız dönemde sonuç vermez", () => {
    expect(ddLimitKontrolu(TL, "2027-03-01", "diger", donemler).durum).toBe("donem-yok");
  });
});

describe("%10 ödenek sınırı", () => {
  const odenek = 20_000_000 * TL;
  const alimlar = [
    alim({ id: "a", tutar: 1_000_000 * TL }),
    alim({ id: "b", tutar: 284_500 * TL }),
    alim({ id: "c", tutar: 50_000 * TL, bent: "22/b" }),
    alim({ id: "d", tutar: 70_000 * TL, asama: "iptal" }),
    alim({ id: "e", tutar: 90_000 * TL, onayTarihi: "2025-12-30" }),
  ];

  it("yalnızca o mali yılın iptal edilmemiş 22/d alımlarını sayar", () => {
    const d = yuzdeOnDurumu(alimlar, 2026, odenek);
    expect(d.kullanilan).toBe(1_284_500 * TL);
    expect(d.sinir).toBe(2_000_000 * TL);
    expect(d.oran).toBeCloseTo(0.064225);
    expect(d.asiyor).toBe(false);
  });

  it("yeni alımın etkisini ve aşımı hesaplar", () => {
    expect(yuzdeOnDurumu(alimlar, 2026, odenek, 38_500 * TL).sonrakiOran).toBeCloseTo(0.0661);
    expect(yuzdeOnDurumu(alimlar, 2026, odenek, 800_000 * TL).asiyor).toBe(true);
  });
});

describe("kısımlara bölme", () => {
  const alimlar = [
    alim({ id: "1", onayTarihi: "2026-08-20", kalemKodu: "A4" }),
    alim({ id: "2", onayTarihi: "2026-09-15", kalemKodu: "A4" }),
    alim({ id: "3", onayTarihi: "2026-10-10", kalemKodu: "A4" }),
    alim({ id: "4", onayTarihi: "2026-06-01", kalemKodu: "A4" }),
    alim({ id: "5", onayTarihi: "2026-10-01", kalemKodu: "TONER" }),
    alim({ id: "6", onayTarihi: "2026-10-02", kalemKodu: "A4", asama: "iptal" }),
  ];

  it("pencere içinde en az üç alım varsa risk bildirir", () => {
    const r = bolmeRiskleri(alimlar, "2026-10-16", kurallar);
    expect(r).toHaveLength(1);
    expect(r[0].alimlar.map((a) => a.id)).toEqual(["1", "2", "3"]);
    expect(r[0].toplam).toBe(30_000 * TL);
  });

  it("aday alıma benzeyenleri seçilen ölçütlere göre bulur", () => {
    const aday = alim({ id: "yeni", onayTarihi: "2026-10-16", kalemKodu: "A4" });
    expect(benzerAlimlar(aday, alimlar, kurallar).map((a) => a.id)).toEqual(["1", "2", "3"]);
    const kodla = { ...kurallar, ayniKalem: false, ayniEkonomikKod: true };
    expect(benzerAlimlar(aday, alimlar, kodla).map((a) => a.id)).toEqual(["1", "2", "3", "5"]);
  });
});
