// Tutarlar kuruş cinsinden tam sayı olarak tutulur, tarihler "YYYY-AA-GG" biçimindedir.

export type Bent = "22/a" | "22/b" | "22/c" | "22/d" | "22/e" | "22/f" | "22/g" | "22/h" | "22/ı" | "22/i";

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
  // Doğrudan Temin Tebliği m.5/1: EKAP'tan alınan doğrudan temin kayıt numarası
  ekapKayitNo?: string;
  // Teslimi veya yapımı belli bir süre gerektiren iş; sözleşme zorunludur (Tebliğ m.4/5)
  sureliIs?: boolean;
}

export interface Tedarikci {
  id: string;
  ad: string;
  kategori: string;
  vkn?: string;
  vergiDairesi?: string;
  telefon?: string;
  eposta?: string;
  iban?: string;
  adres?: string;
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
  // Denetim izinde işlemi yapan olarak görünür
  kullanici?: string;
  // Mali yıla göre %10 sınırına esas ödenek
  odenekler: Record<number, number>;
  bolme: BolmeKurallari;
  damga: DamgaAyarlari;
  // KDV dahil bedel bu tutarı aşarsa tevkifat uygulanır; kuruş. Tanımsızsa her tutara uygulanır.
  tevkifatSiniri?: number;
  // Kuruş. 6183 md. 22/A; Tahsilat Genel Tebliği Seri A No 1, değişik Seri A No 12 (RG 03.03.2020) ve No 17 (RG 05.09.2024):
  // bu tutarı aşan ödemelerde vergi borcu sorgulanır; tanımsızsa ₺5.000.
  vergiBorcuSorguEsigi?: number;
  idare?: IdareBilgisi;
  // Analitik bütçe sınıflandırmasının idareye ait kodları; belgelerde ekonomik kodun önüne yazılır.
  // Biçimler: kurumsal 18.01.31.00, fonksiyonel 09.1.2.00, finansman tipi 1 (uydurma örnekler).
  butce?: { kurumsal: string; fonksiyonel: string; finansman: string };
  personel?: Personel[];
  gorevler?: GorevAtamalari;
}

// Belge başlığında "T.C." altındaki iki satır: Karataş Kaymakamlığı / Kırmızıdağ İlkokulu Müdürlüğü
export interface IdareBilgisi {
  ustIdare: string;
  birim: string;
}

export interface Personel {
  id: string;
  ad: string;
  unvan: string;
}

// Yıllık görevlendirmeler; dosya açılırken belgelere ön değer olarak dolar.
export interface GorevAtamalari {
  harcamaYetkilisi: string | null;
  gerceklestirme: string | null;
  yaklasikMaliyetGorevlileri?: string[];
  piyasaGorevlileri: string[];
  muayeneBaskani: string | null;
  muayeneUyeleri: string[];
}

