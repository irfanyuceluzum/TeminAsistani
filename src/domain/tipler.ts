// Tutarlar kuruş cinsinden tam sayı olarak tutulur, tarihler "YYYY-AA-GG" biçimindedir.

export type Bent = "22/a" | "22/b" | "22/c" | "22/d" | "22/e";

export type Asama =
  | "ihtiyac"
  | "dayanak"
  | "onay"
  | "piyasa"
  | "siparis"
  | "muayene"
  | "odeme"
  | "tamamlandi"
  | "iptal";

export type Konum = "buyuksehir" | "diger";

export interface Alim {
  id: string;
  onayTarihi: string;
  konu: string;
  bent: Bent;
  tutar: number;
  ekonomikKod: string;
  kalemKodu: string;
  tedarikciId: string | null;
  asama: Asama;
  sonIslem: string;
}

export interface Tedarikci {
  id: string;
  ad: string;
  kategori: string;
}

export interface LimitDonemi {
  baslangic: string;
  bitis: string;
  buyuksehir: number;
  diger: number;
  dayanak: string;
}

export interface BolmeKurallari {
  pencereGun: number;
  ayniEkonomikKod: boolean;
  ayniKalem: boolean;
  ayniTedarikci: boolean;
}

export type KararPulu = "uygulanmaz" | "onay-karar-sayilir" | "yalnizca-komisyon";

export interface DamgaAyarlari {
  // Oranlar yüz binde: binde 9,48 = 948
  makbuzOrani: number;
  sozlesmeOrani: number;
  kararOrani: number;
  kararPulu: KararPulu;
}

export interface Ayarlar {
  konum: Konum;
  // Mali yıla göre %10 sınırına esas ödenek
  odenekler: Record<number, number>;
  bolme: BolmeKurallari;
  damga: DamgaAyarlari;
}
