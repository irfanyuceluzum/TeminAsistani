import type { Alim, Asama, Ayarlar, Bent, LimitDonemi, Tedarikci } from "../domain/tipler";

// İlk açılışta boş veritabanına yazılan örnek kayıtlar. Gerçek kullanıma geçmeden kaldırılmalı.

const TL = 100;

export const ornekLimitDonemleri: LimitDonemi[] = [
  {
    baslangic: "2025-02-01",
    bitis: "2026-01-31",
    buyuksehir: 800_366 * TL,
    diger: 266_618 * TL,
    dayanak: "2025 yılı Kamu İhale Tebliği",
  },
  {
    baslangic: "2026-02-01",
    bitis: "2027-01-31",
    buyuksehir: 1_021_827 * TL,
    diger: 340_391 * TL,
    dayanak: "2026/1 Kamu İhale Tebliği, RG 22.01.2026",
  },
];

export const ornekTedarikciler: Tedarikci[] = [
  { id: "toros", ad: "Toros AŞ", kategori: "Temizlik malzemesi" },
  { id: "ece", ad: "Ece Ltd. Şti.", kategori: "Temizlik, kâğıt ürünleri" },
  { id: "kaya", ad: "Kaya Ticaret", kategori: "Temizlik, ambalaj" },
  { id: "serin", ad: "Serin Teknik Ltd.", kategori: "İklimlendirme bakım" },
  { id: "anka", ad: "Anka Kırtasiye", kategori: "Kırtasiye, sarf" },
];

type Satir = [string, string, string, Bent, number, string, string, string | null, Asama, string];

const satirlar: Satir[] = [
  ["DT-2026-012", "2026-02-05", "Hizmet binası kirası", "22/e", 360_000, "03.5.5.01", "KIRA", null, "tamamlandi", "2026-02-18"],
  ["DT-2026-017", "2026-03-16", "Kırtasiye malzemesi", "22/d", 22_400, "03.2.1.01", "KRT", "anka", "tamamlandi", "2026-03-30"],
  ["DT-2026-019", "2026-03-20", "Yazılım bakım desteği", "22/b", 38_200, "03.5.9.90", "YZL", null, "tamamlandi", "2026-04-02"],
  ["DT-2026-022", "2026-05-12", "Temizlik malzemesi", "22/d", 18_200, "03.2.2.01", "TMZ", "toros", "tamamlandi", "2026-05-28"],
  ["DT-2026-024", "2026-06-05", "Yazıcı toneri", "22/c", 28_900, "03.2.1.01", "TNR", null, "tamamlandi", "2026-06-19"],
  ["DT-2026-029", "2026-06-10", "Kırtasiye malzemesi", "22/d", 19_800, "03.2.1.01", "KRT", "anka", "tamamlandi", "2026-06-24"],
  ["DT-2026-030", "2026-07-23", "Çöp poşeti", "22/d", 6_100, "03.2.2.01", "POS", "kaya", "tamamlandi", "2026-08-03"],
  ["DT-2026-031", "2026-07-28", "Yazıcı toneri", "22/c", 27_700, "03.2.1.01", "TNR", null, "tamamlandi", "2026-08-04"],
  ["DT-2026-033", "2026-08-17", "Kâğıt havlu", "22/d", 8_400, "03.2.2.01", "HVL", "ece", "tamamlandi", "2026-08-28"],
  ["DT-2026-032", "2026-08-20", "Fotokopi kâğıdı A4", "22/d", 21_600, "03.2.1.01", "A4", "anka", "tamamlandi", "2026-09-01"],
  ["DT-2026-035", "2026-09-01", "Lisans yenileme", "22/b", 58_300, "03.5.9.90", "LIS", null, "odeme", "2026-10-03"],
  ["DT-2026-034", "2026-09-15", "Fotokopi kâğıdı A4", "22/d", 19_800, "03.2.1.01", "A4", "anka", "tamamlandi", "2026-09-26"],
  ["DT-2026-038", "2026-09-18", "Yazıcı toneri", "22/c", 31_640, "03.2.1.01", "TNR", null, "odeme", "2026-10-09"],
  ["DT-2026-039", "2026-09-24", "Hizmet aracı kiralama", "22/d", 84_000, "03.5.5.02", "ARC", null, "siparis", "2026-10-11"],
  ["DT-2026-040", "2026-09-30", "Klima bakım hizmeti", "22/d", 46_900, "03.7.1.02", "KLM", "serin", "muayene", "2026-10-14"],
  ["DT-2026-036", "2026-10-06", "Fotokopi kâğıdı A4", "22/d", 19_800, "03.2.1.01", "A4", "anka", "odeme", "2026-10-13"],
  ["DT-2026-041", "2026-10-08", "Temizlik malzemesi", "22/d", 25_380, "03.2.2.01", "TMZ", "toros", "piyasa", "2026-10-15"],
  ["DT-2026-042", "2026-10-16", "Kırtasiye malzemesi", "22/d", 38_500, "03.2.1.01", "KRT", null, "dayanak", "2026-10-16"],
];

export const ornekAlimlar: Alim[] = satirlar.map(
  ([id, onayTarihi, konu, bent, tutar, ekonomikKod, kalemKodu, tedarikciId, asama, sonIslem]) => ({
    id,
    onayTarihi,
    konu,
    bent,
    tutar: tutar * TL,
    ekonomikKod,
    kalemKodu,
    tedarikciId,
    asama,
    sonIslem,
  }),
);

export const ornekAyarlar: Ayarlar = {
  konum: "buyuksehir",
  odenekler: { 2026: 20_000_000 * TL },
  bolme: { pencereGun: 60, ayniEkonomikKod: false, ayniKalem: true, ayniTedarikci: false },
  damga: { makbuzOrani: 948, sozlesmeOrani: 948, kararOrani: 569, kararPulu: "uygulanmaz" },
};
