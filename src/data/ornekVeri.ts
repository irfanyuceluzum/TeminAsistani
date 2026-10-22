import type { DosyaBasamaklari } from "../domain/basamaklar";
import type { EvrakKaydi, Olay } from "../domain/dosya";
import type { Muayene } from "../domain/muayene";
import type { PiyasaArastirmasi } from "../domain/piyasa";
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

// Kimlik ve banka bilgileri uydurmadır (VKN 999 ile, IBAN 00999 banka koduyla başlar); IBAN sağlama basamağı geçerlidir.
// Kaya Ticaret IBAN'sız bırakıldı: teklif basamağı bu eksikliği "yapılacak" olarak gösterir.
export const ornekTedarikciler: Tedarikci[] = [
  {
    id: "toros",
    ad: "Toros AŞ",
    kategori: "Temizlik malzemesi",
    vkn: "9990011101",
    vergiDairesi: "Kızılbey",
    adres: "Örnek Mah. Deneme Cad. No: 12 Çankaya/Ankara",
    telefon: "0312 000 00 01",
    iban: "TR61 0099 9000 0000 0000 0001 01",
  },
  {
    id: "ece",
    ad: "Ece Ltd. Şti.",
    kategori: "Temizlik, kâğıt ürünleri",
    vkn: "9990011102",
    vergiDairesi: "Maltepe",
    adres: "Örnek Mah. Çınar Sok. No: 4 Yenimahalle/Ankara",
    telefon: "0312 000 00 02",
    iban: "TR34 0099 9000 0000 0000 0001 02",
  },
  {
    id: "kaya",
    ad: "Kaya Ticaret",
    kategori: "Temizlik, ambalaj",
    vkn: "9990011103",
    vergiDairesi: "Ostim",
    adres: "Sanayi Mah. 1. Cad. No: 8 Yenimahalle/Ankara",
    telefon: "0312 000 00 03",
  },
  {
    id: "serin",
    ad: "Serin Teknik Ltd.",
    kategori: "İklimlendirme bakım",
    vkn: "9990011104",
    vergiDairesi: "Kavaklıdere",
    adres: "Örnek Mah. Lale Sok. No: 21 Çankaya/Ankara",
    telefon: "0312 000 00 04",
    iban: "TR77 0099 9000 0000 0000 0001 04",
  },
  {
    id: "anka",
    ad: "Anka Kırtasiye",
    kategori: "Kırtasiye, sarf",
    vkn: "9990011105",
    vergiDairesi: "Ulus",
    adres: "Örnek Mah. Kitap Sok. No: 3 Altındağ/Ankara",
    telefon: "0312 000 00 05",
    iban: "TR50 0099 9000 0000 0000 0001 05",
  },
];

type Satir = [string, string, string, Bent, number, string, string, string | null, Asama, string];

const satirlar: Satir[] = [
  ["DT-2026-012", "2026-02-05", "Isıtma sistemi bakım hizmeti", "22/d", 38_000, "03.7.1.02", "ISI", "serin", "tamamlandi", "2026-02-18"],
  ["DT-2026-017", "2026-03-16", "Kırtasiye malzemesi", "22/d", 22_400, "03.2.1.01", "KRT", "anka", "tamamlandi", "2026-03-30"],
  ["DT-2026-019", "2026-03-20", "Ambalaj ve koli bandı", "22/d", 14_500, "03.2.2.01", "AMB", "kaya", "tamamlandi", "2026-04-02"],
  ["DT-2026-022", "2026-05-12", "Temizlik malzemesi", "22/d", 18_200, "03.2.2.01", "TMZ", "toros", "tamamlandi", "2026-05-28"],
  ["DT-2026-024", "2026-06-05", "Boya ve badana malzemesi", "22/d", 28_900, "03.2.1.01", "BOY", "kaya", "tamamlandi", "2026-06-19"],
  ["DT-2026-029", "2026-06-10", "Kırtasiye malzemesi", "22/d", 19_800, "03.2.1.01", "KRT", "anka", "tamamlandi", "2026-06-24"],
  ["DT-2026-030", "2026-07-23", "Çöp poşeti", "22/d", 6_100, "03.2.2.01", "POS", "kaya", "tamamlandi", "2026-08-03"],
  ["DT-2026-031", "2026-07-28", "Yazıcı toneri", "22/d", 27_700, "03.2.1.01", "TNR", "anka", "tamamlandi", "2026-08-04"],
  ["DT-2026-033", "2026-08-17", "Kâğıt havlu", "22/d", 8_400, "03.2.2.01", "HVL", "ece", "tamamlandi", "2026-08-28"],
  ["DT-2026-032", "2026-08-20", "Fotokopi kâğıdı A4", "22/d", 21_600, "03.2.1.01", "A4", "anka", "tamamlandi", "2026-09-01"],
  ["DT-2026-035", "2026-09-01", "Güvenlik kamerası bakım hizmeti", "22/d", 58_300, "03.7.1.02", "KMR", null, "odeme", "2026-10-03"],
  ["DT-2026-034", "2026-09-15", "Fotokopi kâğıdı A4", "22/d", 19_800, "03.2.1.01", "A4", "anka", "tamamlandi", "2026-09-26"],
  // 12 basamağın hepsi tamamlanmış örnek dosya (tutar, piyasa tutanağındaki kazanan toplamı ve muayenede kabul edilen toplamdır)
  ["DT-2026-037", "2026-09-08", "Sınıf panosu ve kırtasiye malzemesi", "22/d", 32_200, "03.2.1.01", "PNO", "anka", "tamamlandi", "2026-10-05"],
  ["DT-2026-038", "2026-09-18", "Yangın söndürme tüpü dolum ve bakımı", "22/d", 31_640, "03.7.1.02", "YNG", null, "odeme", "2026-10-09"],
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

// Tamamlanmış örnek dosyanın EKAP doğrudan temin kayıt numarası (uydurma); satır üretimi ortak kaldığı için burada atanır.
ornekAlimlar.find((a) => a.id === "DT-2026-037")!.ekapKayitNo = "2026/123037";

export const ornekAyarlar: Ayarlar = {
  konum: "buyuksehir",
  kullanici: "Satın alma birimi",
  odenekler: { 2026: 20_000_000 * TL },
  bolme: { pencereGun: 60, ayniEkonomikKod: false, ayniKalem: true, ayniTedarikci: false },
  idare: { ustIdare: "Karataş Kaymakamlığı", birim: "Kırmızıdağ İlkokulu Müdürlüğü" },
  // Uydurma ama biçime uygun kodlar; gerçek kurum kodu değil
  butce: { kurumsal: "18.01.31.00", fonksiyonel: "09.1.2.00", finansman: "1" },
  personel: [
    { id: "p1", ad: "Mehmet Arslan", unvan: "Okul Müdürü" },
    { id: "p2", ad: "Ayşe Demir", unvan: "Müdür Yardımcısı" },
    { id: "p3", ad: "Ali Yılmaz", unvan: "Öğretmen" },
    { id: "p4", ad: "Fatma Kaya", unvan: "Öğretmen" },
    { id: "p5", ad: "Hasan Çelik", unvan: "Öğretmen" },
    { id: "p6", ad: "Zeynep Aksoy", unvan: "Memur" },
    // Görevi olmayan öğretmen; tamamlanmış örnek dosyanın muayene komisyonunda yer alır
    { id: "p7", ad: "Emine Şahin", unvan: "Öğretmen" },
  ],
  gorevler: { harcamaYetkilisi: "p1", gerceklestirme: "p2", piyasaGorevlileri: ["p3", "p6"], muayeneBaskani: "p4", muayeneUyeleri: ["p5", "p3"] },
};

// DT-2026-041 için iki teklifi gelmiş, Kaya Ticaret'in sorgusu henüz işaretlenmemiş bir araştırma.
export const ornekPiyasa: PiyasaArastirmasi[] = [
  {
    alimId: "DT-2026-041",
    kalemler: [
      { id: "k1", ad: "Çamaşır suyu, 4 L", miktar: 120, birim: "adet" },
      { id: "k2", ad: "Sıvı el sabunu, 5 L", miktar: 60, birim: "adet" },
      { id: "k3", ad: "Çöp poşeti, büyük boy", miktar: 300, birim: "rulo" },
    ],
    teklifler: [
      { tedarikciId: "ece", teklifTarihi: "2026-10-14", yasaklilikSorgusu: "2026-10-16", fiyatlar: { k1: 86 * TL, k2: 142 * TL, k3: 24 * TL }, belgeAlindi: true },
      { tedarikciId: "toros", teklifTarihi: "2026-10-15", yasaklilikSorgusu: "2026-10-16", fiyatlar: { k1: 79 * TL, k2: 150 * TL, k3: 23 * TL }, belgeAlindi: true },
      { tedarikciId: "kaya", teklifTarihi: null, yasaklilikSorgusu: null, fiyatlar: {} },
    ],
    yazi: { sayi: "", tarih: "2026-10-09", sonTeklifTarihi: "2026-10-15", teslimYeri: "İdare ambarı", teslimSuresi: "Siparişten itibaren 5 iş günü", aciklama: "" },
    degerlendirme: "toplam",
    gorevliler: "A. Yılmaz (Şef), M. Kaya (Memur)",
    tamamlandi: false,
  },
  {
    alimId: "DT-2026-040",
    kalemler: [
      { id: "k1", ad: "Split klima periyodik bakımı", miktar: 24, birim: "adet" },
      { id: "k2", ad: "Salon tipi klima bakımı", miktar: 4, birim: "adet" },
      { id: "k3", ad: "Filtre değişimi", miktar: 24, birim: "adet" },
      { id: "k4", ad: "Gaz takviyesi, R410A", miktar: 3, birim: "adet" },
    ],
    teklifler: [
      { tedarikciId: "serin", teklifTarihi: "2026-10-02", yasaklilikSorgusu: "2026-10-03", fiyatlar: { k1: 1_250 * TL, k2: 2_800 * TL, k3: 150 * TL, k4: 700 * TL }, belgeAlindi: true },
    ],
    degerlendirme: "toplam",
    gorevliler: "A. Yılmaz (Şef), M. Kaya (Memur)",
    tamamlandi: true,
  },
  // DT-2026-037: üç teklif, en düşük toplam Anka Kırtasiye (₺32.200); tutanak onaylı.
  {
    alimId: "DT-2026-037",
    kalemler: [
      { id: "k1", ad: "Mantar pano, 120×180 cm", miktar: 6, birim: "adet" },
      { id: "k2", ad: "Fotokopi kâğıdı A4, 80 g (500 yaprak)", miktar: 100, birim: "paket" },
      { id: "k3", ad: "Renkli karton, 50×70 cm", miktar: 200, birim: "adet" },
      { id: "k4", ad: "Zımba teli, No. 10", miktar: 100, birim: "kutu" },
    ],
    teklifler: [
      { tedarikciId: "anka", teklifTarihi: "2026-09-10", yasaklilikSorgusu: "2026-09-15", fiyatlar: { k1: 1_850 * TL, k2: 165 * TL, k3: 14 * TL, k4: 18 * TL }, belgeAlindi: true },
      { tedarikciId: "ece", teklifTarihi: "2026-09-11", yasaklilikSorgusu: null, fiyatlar: { k1: 1_950 * TL, k2: 172 * TL, k3: 15 * TL, k4: 19 * TL }, belgeAlindi: true },
      { tedarikciId: "kaya", teklifTarihi: "2026-09-14", yasaklilikSorgusu: null, fiyatlar: { k1: 1_900 * TL, k2: 170 * TL, k3: 16 * TL, k4: 17 * TL }, belgeAlindi: true },
    ],
    yazi: { sayi: "2026/37-2", tarih: "2026-09-09", sonTeklifTarihi: "2026-09-15", teslimYeri: "Okul deposu", teslimSuresi: "Siparişten itibaren 7 takvim günü", aciklama: "" },
    degerlendirme: "toplam",
    gorevliler: "A. Yılmaz (Şef), Z. Aksoy (Memur)",
    tamamlandi: true,
  },
];

// Her örnek dosya için açılış kaydı; DT-2026-040 için ayrıntılı geçmiş.
export const ornekOlaylar: Olay[] = [
  ...ornekAlimlar.map((a) => ({
    alimId: a.id,
    zaman: `${a.onayTarihi}T09:00:00`,
    kim: "Örnek veri",
    tur: "olusturuldu",
    aciklama: `Dosya açıldı, dayanak ${a.bent}`,
  })),
  { alimId: "DT-2026-040", zaman: "2026-09-30T14:48:00", kim: "M. Kaya", tur: "evrak", aciklama: "Doğrudan temin onay belgesi, imzalı: tamamlandı" },
  { alimId: "DT-2026-040", zaman: "2026-10-03T11:20:00", kim: "A. Yılmaz", tur: "piyasa-tamamlandi", aciklama: "Piyasa araştırması tamamlandı: Serin Teknik Ltd., ₺46.900" },
  { alimId: "DT-2026-040", zaman: "2026-10-06T11:02:00", kim: "A. Yılmaz", tur: "evrak", aciklama: "Sipariş yazısı veya sözleşme: tamamlandı" },
  { alimId: "DT-2026-040", zaman: "2026-10-14T17:30:00", kim: "S. Demir", tur: "asama:muayene", aciklama: "Aşama: Muayene kabul" },
  { alimId: "DT-2026-040", zaman: "2026-10-15T16:05:00", kim: "M. Kaya", tur: "evrak", aciklama: "Fatura: tamamlandı" },
  { alimId: "DT-2026-037", zaman: "2026-09-08T14:10:00", kim: "M. Kaya", tur: "evrak", aciklama: "Doğrudan temin onay belgesi, imzalı: tamamlandı" },
  { alimId: "DT-2026-037", zaman: "2026-09-16T11:30:00", kim: "A. Yılmaz", tur: "piyasa-tamamlandi", aciklama: "Piyasa araştırması tamamlandı: Anka Kırtasiye, ₺32.200" },
  { alimId: "DT-2026-037", zaman: "2026-09-17T10:15:00", kim: "A. Yılmaz", tur: "evrak", aciklama: "Sipariş yazısı veya sözleşme: tamamlandı" },
  { alimId: "DT-2026-037", zaman: "2026-09-25T15:40:00", kim: "F. Kaya", tur: "asama:muayene", aciklama: "Muayene ve kabul tamamlandı: eksiksiz kabul, ₺32.200 + KDV" },
  { alimId: "DT-2026-037", zaman: "2026-09-29T16:20:00", kim: "M. Kaya", tur: "evrak", aciklama: "Ödeme emri belgesi: tamamlandı" },
  { alimId: "DT-2026-037", zaman: "2026-10-05T09:45:00", kim: "M. Kaya", tur: "evrak", aciklama: "KİK bildirimi: tamamlandı" },
  { alimId: "DT-2026-037", zaman: "2026-10-05T09:50:00", kim: "M. Kaya", tur: "asama:tamamlandi", aciklama: "Aşama: Tamamlandı" },
];

// Tamamlanmış örnek dosyaların KİK bildirimi, alım ayını izleyen ayın 5'inde yapılmış sayılır.
const kikBildirildi = Object.fromEntries(
  ornekAlimlar
    .filter((a) => a.asama === "tamamlandi")
    .map((a) => {
      const yil = Number(a.onayTarihi.slice(0, 4));
      const ay = Number(a.onayTarihi.slice(5, 7));
      const tarih = ay === 12 ? `${yil + 1}-01-05` : `${yil}-${String(ay + 1).padStart(2, "0")}-05`;
      return [a.id, { "kik-bildirimi": { tamam: true, tarih, not: "EKAP" } }];
    }),
);

export const ornekEvraklar: Record<string, Record<string, EvrakKaydi>> = {
  ...kikBildirildi,
  "DT-2026-040": {
    "ihtiyac-yazisi": { tamam: true, tarih: "2026-09-29", not: "" },
    "onay-belgesi": { tamam: true, tarih: "2026-09-30", not: "" },
    "siparis-yazisi": { tamam: true, tarih: "2026-10-06", not: "Sözleşme düzenlenmedi" },
    fatura: { tamam: true, tarih: "2026-10-15", not: "e-Fatura" },
  },
  // DT-2026-037: evrak listesi ve 12 basamağın evrakları eksiksiz; "not" alanı belge sayısını taşır.
  "DT-2026-037": {
    "ihtiyac-yazisi": { tamam: true, tarih: "2026-09-02", not: "2026/37-1" },
    "onay-belgesi": { tamam: true, tarih: "2026-09-08", not: "2026/37-OB" },
    "fiyat-teklifi": { tamam: true, tarih: "2026-09-14", not: "3 firma, kaşeli teklif belgeleri" },
    "piyasa-tutanagi": { tamam: true, tarih: "2026-09-16", not: "2026/37-PT" },
    "siparis-yazisi": { tamam: true, tarih: "2026-09-17", not: "2026/37-3" },
    "muayene-talebi": { tamam: true, tarih: "2026-09-24", not: "2026/37-4" },
    "muayene-raporu": { tamam: true, tarih: "2026-09-25", not: "2026/37-MR" },
    fatura: { tamam: true, tarih: "2026-09-24", not: "e-Fatura ANK-2026-000418" },
    "muayene-tutanagi": { tamam: true, tarih: "2026-09-25", not: "2026/37-MK" },
    "tasinir-fisi": { tamam: true, tarih: "2026-09-25", not: "TİF 2026/118" },
    "odeme-emri": { tamam: true, tarih: "2026-09-29", not: "2026/0412" },
    "kik-bildirimi": { tamam: true, tarih: "2026-10-05", not: "EKAP" },
  },
};

// DT-2026-041: ihtiyaç onayı imzalı, fiyat isteme yazısı gitmiş, üç firmanın ikisinden fiyat gelmiş.
export const ornekBasamaklar: DosyaBasamaklari[] = [
  {
    alimId: "DT-2026-041",
    talepEden: "Okul aile birliği ve hizmetliler",
    nitelik: "",
    bolmeGerekcesi: "",
    teslimYeri: "Okul deposu",
    odenek: 85_000 * TL,
    sartlar: {
      teslimSuresi: "Sipariş yazısının tebliğinden itibaren 10 takvim günü.",
      parti: "Tamamı tek partide, okul deposuna teslim edilir.",
      nakliye: "Nakliye, yükleme ve boşaltma yükleniciye aittir.",
      ozel: "Ürünler orijinal ambalajında, son kullanma tarihi en az 12 ay olmalıdır.",
      standart: "TSE veya eşdeğer kalite belgesi bulunmalıdır.",
      teknik: "",
      diger: "",
    },
    ihtiyacOnayi: { tarih: "2026-10-06", sayi: "", gerekce: "Okulumuzun ikinci dönem temizlik ihtiyacının karşılanması gerekmektedir.", imzali: true },
    fiyatIsteme: { tarih: "2026-10-07", sayi: "", sonTarih: "2026-10-09" },
    yaklasik: {
      hesaplanmayacak: false,
      yontem: "ortalama",
      kdvOrani: 20,
      firmalar: [
        { tedarikciId: "toros", belgeAlindi: true, fiyatlar: { k1: 82 * TL, k2: 148 * TL, k3: 24 * TL } },
        { tedarikciId: "ece", belgeAlindi: true, fiyatlar: { k1: 88 * TL, k2: 140 * TL, k3: 25 * TL } },
        { tedarikciId: "kaya", belgeAlindi: false, fiyatlar: {} },
      ],
    },
  },
  // DT-2026-037: bütün basamaklar tamam; yaklaşık maliyet onaylı, ödenek KDV dahil tutarı (₺38.640) karşılıyor.
  {
    alimId: "DT-2026-037",
    talepEden: "Sınıf öğretmenleri ve okul aile birliği",
    nitelik: "",
    bolmeGerekcesi: "",
    teslimYeri: "Okul deposu",
    odenek: 45_000 * TL,
    sartlar: {
      teslimSuresi: "Sipariş yazısının tebliğinden itibaren 7 takvim günü.",
      parti: "Tamamı tek partide, okul deposuna teslim edilir.",
      nakliye: "Nakliye, yükleme ve boşaltma yükleniciye aittir.",
      ozel: "Ürünler orijinal ambalajında teslim edilir.",
      standart: "TSE veya eşdeğer kalite belgesi bulunmalıdır.",
      teknik: "Gerek görülmedi; özellikler ihtiyaç listesinde yazılıdır.",
      diger: "Muayenede uygun bulunmayan ürünler değiştirilir.",
    },
    ihtiyacOnayi: { tarih: "2026-09-02", sayi: "2026/37-1", gerekce: "Yeni eğitim yılı için sınıf panolarının ve kırtasiye ihtiyacının karşılanması gerekmektedir.", imzali: true },
    fiyatIsteme: { tarih: "2026-09-04", sayi: "2026/37-FI", sonTarih: "2026-09-07" },
    yaklasik: {
      hesaplanmayacak: false,
      yontem: "ortalama",
      kdvOrani: 20,
      firmalar: [
        { tedarikciId: "anka", belgeAlindi: true, fiyatlar: { k1: 1_900 * TL, k2: 168 * TL, k3: 15 * TL, k4: 18 * TL } },
        { tedarikciId: "ece", belgeAlindi: true, fiyatlar: { k1: 1_980 * TL, k2: 175 * TL, k3: 16 * TL, k4: 20 * TL } },
        { tedarikciId: "kaya", belgeAlindi: true, fiyatlar: { k1: 1_920 * TL, k2: 170 * TL, k3: 15 * TL, k4: 19 * TL } },
      ],
      onaylandi: true,
    },
    onayBelgesi: { fiyatFarki: "Verilmeyecektir.", avans: "Verilmeyecektir.", dokuman: "Hazırlanmayacaktır." },
  },
];

// DT-2026-037: dört kalemin tamamı sipariş, fatura ve kabulde aynı; komisyonda yetkili ve piyasa görevlisi yok.
export const ornekMuayeneler: Muayene[] = [
  {
    alimId: "DT-2026-037",
    muayeneTarihi: "2026-09-25",
    teslimTarihi: "2026-09-24",
    yer: "Okul deposu",
    faturaNo: "ANK-2026-000418",
    faturaTarihi: "2026-09-24",
    kalemler: [
      { kalemId: "k1", ad: "Mantar pano, 120×180 cm", birim: "adet", siparisMiktari: 6, faturaMiktari: 6, kabulMiktari: 6, birimFiyat: 1_850 * TL },
      { kalemId: "k2", ad: "Fotokopi kâğıdı A4, 80 g (500 yaprak)", birim: "paket", siparisMiktari: 100, faturaMiktari: 100, kabulMiktari: 100, birimFiyat: 165 * TL },
      { kalemId: "k3", ad: "Renkli karton, 50×70 cm", birim: "adet", siparisMiktari: 200, faturaMiktari: 200, kabulMiktari: 200, birimFiyat: 14 * TL },
      { kalemId: "k4", ad: "Zımba teli, No. 10", birim: "kutu", siparisMiktari: 100, faturaMiktari: 100, kabulMiktari: 100, birimFiyat: 18 * TL },
    ],
    uyeler: [
      { ad: "Fatma Kaya", unvan: "Öğretmen", rol: "baskan" },
      { ad: "Hasan Çelik", unvan: "Öğretmen", rol: "uye" },
      { ad: "Emine Şahin", unvan: "Öğretmen", rol: "uye" },
    ],
    tamamlandi: true,
  },
];
