import type {
  Alim,
  BolmeKurallari,
  DamgaAyarlari,
  Konum,
  LimitDonemi,
} from "./tipler";

const SAYILMAYAN_ASAMALAR = new Set(["iptal"]);

function gunFarki(a: string, b: string): number {
  const ms = Date.parse(a + "T00:00:00Z") - Date.parse(b + "T00:00:00Z");
  return Math.round(ms / 86_400_000);
}

function maliYil(tarih: string): number {
  return Number(tarih.slice(0, 4));
}

// Limit dönemi 1 Şubat'ta başlar, mali yıl 1 Ocak'ta. Limit alımın onay tarihine göre seçilir.
export function limitDonemiBul(tarih: string, donemler: LimitDonemi[]): LimitDonemi | null {
  return donemler.find((d) => d.baslangic <= tarih && tarih <= d.bitis) ?? null;
}

export type LimitSonucu =
  | { durum: "icinde" | "asiyor"; limit: number; donem: LimitDonemi }
  | { durum: "donem-yok" };

export function ddLimitKontrolu(
  tutar: number,
  tarih: string,
  konum: Konum,
  donemler: LimitDonemi[],
): LimitSonucu {
  const donem = limitDonemiBul(tarih, donemler);
  if (!donem) return { durum: "donem-yok" };
  const limit = konum === "buyuksehir" ? donem.buyuksehir : donem.diger;
  return { durum: tutar <= limit ? "icinde" : "asiyor", limit, donem };
}

export interface YuzdeOnDurumu {
  kullanilan: number;
  sinir: number;
  oran: number;
  sonrakiOran: number;
  asiyor: boolean;
}

// 4734 md. 62/ı: parasal limitler dahilindeki doğrudan temin harcamalarının yıllık toplamı, ödeneğin %10'unu
// Kurul'un uygun görüşü olmadan aşamaz. Uygulama 21/f pazarlık alımlarını tutmadığından yalnızca 22/d sayılır.
export function yuzdeOnDurumu(
  alimlar: Alim[],
  yil: number,
  odenek: number,
  yeniTutar = 0,
): YuzdeOnDurumu {
  const kullanilan = alimlar
    .filter((a) => a.bent === "22/d" && maliYil(a.onayTarihi) === yil && !SAYILMAYAN_ASAMALAR.has(a.asama))
    .reduce((t, a) => t + a.tutar, 0);
  const sinir = Math.floor(odenek / 10);
  const oran = sinir === 0 ? 0 : kullanilan / odenek;
  const sonrakiOran = sinir === 0 ? 0 : (kullanilan + yeniTutar) / odenek;
  return { kullanilan, sinir, oran, sonrakiOran, asiyor: kullanilan + yeniTutar > sinir };
}

function benzerMi(a: Alim, b: Alim, k: BolmeKurallari): boolean {
  return (
    (k.ayniEkonomikKod && a.ekonomikKod === b.ekonomikKod) ||
    (k.ayniKalem && a.kalemKodu === b.kalemKodu) ||
    (k.ayniTedarikci && a.tedarikciId !== null && a.tedarikciId === b.tedarikciId)
  );
}

// Aday alımla aynı pencerede yapılmış, kurallara göre benzer sayılan alımlar (4734 md. 5, kısımlara bölme yasağı).
export function benzerAlimlar(
  aday: Alim,
  alimlar: Alim[],
  kurallar: BolmeKurallari,
): Alim[] {
  return alimlar.filter(
    (a) =>
      a.id !== aday.id &&
      !SAYILMAYAN_ASAMALAR.has(a.asama) &&
      Math.abs(gunFarki(aday.onayTarihi, a.onayTarihi)) <= kurallar.pencereGun &&
      benzerMi(aday, a, kurallar),
  );
}

export interface BolmeRiski {
  kalemKodu: string;
  konu: string;
  alimlar: Alim[];
  toplam: number;
}

// Panel uyarısı: bugünden geriye pencere içinde aynı kalemde en az `enAz` ayrı 22/d alımı.
export function bolmeRiskleri(
  alimlar: Alim[],
  bugun: string,
  kurallar: BolmeKurallari,
  enAz = 3,
): BolmeRiski[] {
  const pencere = alimlar.filter((a) => {
    const fark = gunFarki(bugun, a.onayTarihi);
    return a.bent === "22/d" && !SAYILMAYAN_ASAMALAR.has(a.asama) && fark >= 0 && fark <= kurallar.pencereGun;
  });
  const gruplar = new Map<string, Alim[]>();
  for (const a of pencere) {
    const g = gruplar.get(a.kalemKodu) ?? [];
    g.push(a);
    gruplar.set(a.kalemKodu, g);
  }
  return [...gruplar.entries()]
    .filter(([, g]) => g.length >= enAz)
    .map(([kalemKodu, g]) => ({
      kalemKodu,
      konu: g[0].konu,
      alimlar: g,
      toplam: g.reduce((t, a) => t + a.tutar, 0),
    }))
    .sort((x, y) => y.toplam - x.toplam);
}

export interface DamgaSonucu {
  makbuz: number;
  sozlesme: number;
  karar: number;
  toplam: number;
}

function yuzBinde(matrah: number, oran: number): number {
  return Math.round((matrah * oran) / 100_000);
}

// Matrah KDV hariç bedeldir. Karar pulu doğrudan teminde tartışmalı olduğundan idare ayarına bırakılır.
export function damgaVergisi(
  matrah: number,
  ayar: DamgaAyarlari,
  durum: { sozlesmeVar: boolean; komisyonKarariVar: boolean },
): DamgaSonucu {
  const makbuz = yuzBinde(matrah, ayar.makbuzOrani);
  const sozlesme = durum.sozlesmeVar ? yuzBinde(matrah, ayar.sozlesmeOrani) : 0;
  const kararUygulanir =
    ayar.kararPulu === "onay-karar-sayilir" ||
    (ayar.kararPulu === "yalnizca-komisyon" && durum.komisyonKarariVar);
  const karar = kararUygulanir ? yuzBinde(matrah, ayar.kararOrani) : 0;
  return { makbuz, sozlesme, karar, toplam: makbuz + sozlesme + karar };
}
