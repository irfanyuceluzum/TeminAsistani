import type { EvrakKaydi } from "./dosya";
import { ddLimitKontrolu } from "./kurallar";
import type { Muayene } from "./muayene";
import type { Odeme } from "./odeme";
import { kalemTutari, type PiyasaArastirmasi, type PiyasaKalemi } from "./piyasa";
import { sozlesmeZorunlu, type Kontrol } from "./sihirbaz";
import type { Alim, Ayarlar, LimitDonemi } from "./tipler";

// Alım dosyası örnek Excel düzeneğindeki gibi sırayla doldurulan basamaklardan oluşur.
// İhtiyaç listesi ve teklif mektupları piyasa araştırması kaydında, muayene ve ödeme kendi kayıtlarında tutulur;
// bu belge yalnızca basamaklara özgü bilgileri taşır.

export type SartKodu = "teslimSuresi" | "parti" | "nakliye" | "ozel" | "standart" | "teknik" | "diger";

export const SARTLAR: { kod: SartKodu; ad: string; ornek: string }[] = [
  { kod: "teslimSuresi", ad: "Teslim süresi", ornek: "Sipariş yazısının tebliğinden itibaren 10 takvim günü." },
  { kod: "parti", ad: "Parti miktarı ve teslim şekli", ornek: "Tamamı tek partide teslim edilir." },
  { kod: "nakliye", ad: "Nakliye, sigorta ve diğer giderler", ornek: "Nakliye, yükleme ve boşaltma yükleniciye aittir." },
  { kod: "ozel", ad: "Diğer özel şartlar", ornek: "Ürünler orijinal ambalajında teslim edilir." },
  { kod: "standart", ad: "Standartlar", ornek: "TSE veya eşdeğer kalite belgesi bulunmalıdır." },
  { kod: "teknik", ad: "Teknik şartname", ornek: "Gerek görülmedi; özellikler ihtiyaç listesinde yazılıdır." },
  { kod: "diger", ad: "Diğer hususlar", ornek: "Muayenede uygun bulunmayan ürünler değiştirilir." },
];

export interface IhtiyacOnayi {
  tarih: string;
  sayi: string;
  gerekce: string;
  imzali: boolean;
}

// Yaklaşık maliyet için gönderilen fiyat isteme yazısı (teklif mektubu isteyen yazıdan ayrıdır).
export interface FiyatIsteme {
  tarih: string;
  sayi: string;
  sonTarih: string;
}

export interface MaliyetFirmasi {
  tedarikciId: string;
  // Kaşeli ve imzalı fiyat belgesi idareye ulaştı mı
  belgeAlindi: boolean;
  // Kalem kimliğine göre KDV hariç birim fiyat, kuruş
  fiyatlar: Record<string, number | null>;
}

export type MaliyetYontemi = "ortalama" | "enDusuk";

export interface YaklasikMaliyet {
  // Doğrudan Temin Tebliği m.4/4: 22/d alımlarında yaklaşık maliyet zorunlu değildir.
  hesaplanmayacak: boolean;
  yontem: MaliyetYontemi;
  kdvOrani: number;
  firmalar: MaliyetFirmasi[];
  onaylandi?: boolean;
}

export interface OnayBelgesiAyari {
  makam?: string;
  fiyatFarki?: string;
  avans?: string;
  dokuman?: string;
}

export interface DosyaBasamaklari {
  alimId: string;
  talepEden: string;
  teslimYeri: string;
  // Bütçe tertibindeki kullanılabilir ödenek, kuruş; 0 girilmemiş demektir.
  odenek: number;
  sartlar: Record<SartKodu, string>;
  ihtiyacOnayi: IhtiyacOnayi;
  fiyatIsteme: FiyatIsteme;
  yaklasik: YaklasikMaliyet;
  onayBelgesi?: OnayBelgesiAyari;
}

export function bosBasamaklar(alimId: string, bugun: string): DosyaBasamaklari {
  return {
    alimId,
    talepEden: "",
    teslimYeri: "",
    odenek: 0,
    sartlar: { teslimSuresi: "", parti: "", nakliye: "", ozel: "", standart: "", teknik: "", diger: "" },
    ihtiyacOnayi: { tarih: bugun, sayi: "", gerekce: "", imzali: false },
    fiyatIsteme: { tarih: "", sayi: "", sonTarih: "" },
    yaklasik: { hesaplanmayacak: false, yontem: "ortalama", kdvOrani: 20, firmalar: [], onaylandi: false },
    onayBelgesi: {
      makam: "BAŞKANLIK MAKAMINA",
      fiyatFarki: "Verilmeyecektir",
      avans: "Verilmeyecektir",
      dokuman: "İhtiyaç Listesi ve Şartlar hazırlanmıştır",
    },
  };
}

// Eski kayıtlarda sonradan eklenen alanlar eksik olabilir; boş değerlerle tamamlanır.
export function basamaklariTamamla(kayit: Partial<DosyaBasamaklari> & { alimId: string }, bugun: string): DosyaBasamaklari {
  const bos = bosBasamaklar(kayit.alimId, bugun);
  return {
    ...bos,
    ...kayit,
    sartlar: { ...bos.sartlar, ...kayit.sartlar },
    ihtiyacOnayi: { ...bos.ihtiyacOnayi, ...kayit.ihtiyacOnayi },
    fiyatIsteme: { ...bos.fiyatIsteme, ...kayit.fiyatIsteme },
    yaklasik: { ...bos.yaklasik, ...kayit.yaklasik },
    onayBelgesi: { ...bos.onayBelgesi, ...(kayit.onayBelgesi ?? {}) },
  };
}


export interface MaliyetSatiri {
  kalem: PiyasaKalemi;
  // Firma sırasıyla birim fiyatlar
  fiyatlar: (number | null)[];
  enDusuk: number | null;
  birimFiyat: number | null;
  tutar: number;
  // En düşük fiyatın 1,8 katını aşan fiyatların firma sırası
  aykirilar: number[];
}

export interface MaliyetSonucu {
  satirlar: MaliyetSatiri[];
  toplam: number;
  kdv: number;
  kdvDahil: number;
  // Fiyatı hiç olmayan kalem yoksa true
  hesaplanabilir: boolean;
}

export const AYKIRI_KAT = 1.8;

export function yaklasikHesapla(kalemler: PiyasaKalemi[], y: YaklasikMaliyet): MaliyetSonucu {
  const satirlar = kalemler.map((kalem): MaliyetSatiri => {
    const fiyatlar = y.firmalar.map((f) => {
      const v = f.fiyatlar[kalem.id];
      return v === undefined || v === null || !(v > 0) ? null : v;
    });
    const gecerli = fiyatlar.filter((x): x is number => x !== null);
    const enDusuk = gecerli.length ? Math.min(...gecerli) : null;
    const birimFiyat =
      enDusuk === null ? null : y.yontem === "enDusuk" ? enDusuk : Math.round(gecerli.reduce((s, x) => s + x, 0) / gecerli.length);
    const aykirilar = gecerli.length >= 2 && enDusuk !== null ? fiyatlar.flatMap((x, i) => (x !== null && x > enDusuk * AYKIRI_KAT ? [i] : [])) : [];
    return { kalem, fiyatlar, enDusuk, birimFiyat, tutar: birimFiyat === null ? 0 : kalemTutari(kalem, birimFiyat), aykirilar };
  });
  const toplam = satirlar.reduce((s, r) => s + r.tutar, 0);
  const kdv = Math.round((toplam * y.kdvOrani) / 100);
  return { satirlar, toplam, kdv, kdvDahil: toplam + kdv, hesaplanabilir: kalemler.length > 0 && satirlar.every((r) => r.birimFiyat !== null) };
}

function tl(kurus: number): string {
  return "₺" + (kurus / 100).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function yaklasikKontrolleri(
  d: DosyaBasamaklari,
  sonuc: MaliyetSonucu,
  alim: Alim,
  ayarlar: Ayarlar,
  donemler: LimitDonemi[],
  firmaAdi: (id: string) => string,
): Kontrol[] {
  const y = d.yaklasik;
  if (y.hesaplanmayacak) {
    return [{ durum: "tamam", baslik: "Yaklaşık maliyet hesaplanmayacak", detay: "Doğrudan Temin Tebliği m.4/4 uyarınca 22/d alımlarında zorunlu değildir." }];
  }
  const k: Kontrol[] = [];
  if (sonuc.satirlar.length === 0) return [{ durum: "engel", baslik: "İhtiyaç listesi boş", detay: "Önce 1. basamakta kalemleri girin." }];
  if (y.firmalar.length === 0) return [{ durum: "yapilacak", baslik: "Firma yok", detay: "Fiyat istenen firmaları ekleyin." }];

  const fiyatsiz = sonuc.satirlar.filter((r) => r.birimFiyat === null).map((r) => r.kalem.ad);
  const eksik = sonuc.satirlar.filter((r) => r.birimFiyat !== null && r.fiyatlar.some((x) => x === null)).map((r) => r.kalem.ad);
  if (fiyatsiz.length) k.push({ durum: "engel", baslik: "Fiyatı olmayan kalem", detay: `${fiyatsiz.join(", ")} için hiç fiyat girilmedi.` });
  if (eksik.length) {
    k.push({ durum: "uyari", baslik: "Eksik fiyat", detay: `${eksik.join(", ")} için her firmadan fiyat yok. Hesap gelen fiyatlarla yapıldı.` });
  } else if (!fiyatsiz.length) {
    k.push({ durum: "tamam", baslik: `${y.firmalar.length} firmadan fiyat tam`, detay: "Bütün kalemler için her firmanın fiyatı var." });
  }
  if (y.firmalar.length < 3) k.push({ durum: "uyari", baslik: `${y.firmalar.length} firma`, detay: "Yaklaşık maliyet için genellikle en az üç firmadan fiyat alınır." });

  const aykiri = sonuc.satirlar.flatMap((r) => r.aykirilar.map((i) => `${r.kalem.ad} (${firmaAdi(y.firmalar[i].tedarikciId)})`));
  if (aykiri.length) {
    k.push({
      durum: "uyari",
      baslik: "Aykırı fiyat",
      detay: `${aykiri.join(", ")} en düşük fiyatın ${AYKIRI_KAT.toLocaleString("tr-TR")} katından yüksek.${y.yontem === "ortalama" ? " Ortalamayı yükseltir; teklifi kontrol edin." : ""}`,
    });
  }
  const belgesiz = y.firmalar.filter((f) => !f.belgeAlindi).map((f) => firmaAdi(f.tedarikciId));
  if (belgesiz.length) k.push({ durum: "uyari", baslik: "Kaşeli belge işaretlenmedi", detay: `${belgesiz.join(", ")} için kaşeli fiyat belgesinin alındığını işaretleyin.` });

  if (alim.bent === "22/d" && sonuc.toplam > 0) {
    const limit = ddLimitKontrolu(sonuc.toplam, alim.onayTarihi, ayarlar.konum, donemler);
    if (limit.durum === "asiyor") k.push({ durum: "engel", baslik: "22/d limiti aşılıyor", detay: `Yaklaşık maliyet ${tl(sonuc.toplam)}, limit ${tl(limit.limit)}.` });
    else if (limit.durum === "icinde") k.push({ durum: "tamam", baslik: "22/d limiti içinde", detay: `Limitin %${((sonuc.toplam / limit.limit) * 100).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} kullanılıyor.` });
    else k.push({ durum: "uyari", baslik: "Limit dönemi yok", detay: "Onay tarihini kapsayan limit dönemini Parametreler'den ekleyin." });
  }

  return k;
}

// ---- Basamak listesi ----

export type BasamakDurumu = "tamam" | "suruyor" | "bekliyor" | "gerekmiyor";

export interface BasamakGirdisi {
  alim: Alim;
  piyasa: PiyasaArastirmasi | null;
  dosya: DosyaBasamaklari;
  evraklar: Record<string, EvrakKaydi>;
  muayene: Muayene | null;
  odeme: Odeme | null;
}

export interface Basamak {
  no: number;
  ad: string;
  grup: string;
  durum: BasamakDurumu;
  // Durum açıklaması: "Tamamlandı", "Gerekmiyor · 22/d dışı" gibi
  not: string;
  // Elle işaretlenen evrak basamağıysa evrak kodu
  evrakKodu?: string;
}

export const GRUPLAR = ["Hazırlık", "Fiyat ve onay", "Sipariş", "Teslim ve kabul", "Ödeme"] as const;

// Evrakla tamamlanan ve evrak listesinde (DosyaDetay) bulunmayan basamakların kodları
export const BASAMAK_EVRAKLARI = { muayeneTalebi: "muayene-talebi", muayeneRaporu: "muayene-raporu", tasinirFisi: "tasinir-fisi" } as const;

export function kalemlerHazir(kalemler: PiyasaKalemi[]): boolean {
  return kalemler.length > 0 && kalemler.every((k) => k.ad.trim() && k.miktar > 0);
}

export function basamaklar(g: BasamakGirdisi): Basamak[] {
  const { alim, piyasa, dosya, evraklar } = g;
  const dd = alim.bent === "22/d";
  const evrak = (kod: string) => !!evraklar[kod]?.tamam;
  const kalemler = piyasa?.kalemler ?? [];
  const yaklasikYok = dosya.yaklasik.hesaplanmayacak;

  type Ham = { no: number; ad: string; grup: (typeof GRUPLAR)[number]; tamam: boolean; gerekmez?: string; evrakKodu?: string };
  const ham: Ham[] = [
    { no: 1, ad: "Veri girişi", grup: "Hazırlık", tamam: kalemlerHazir(kalemler) },
    { no: 2, ad: "İhtiyaç onayı", grup: "Hazırlık", tamam: dosya.ihtiyacOnayi.imzali },
    {
      no: 3,
      ad: "Fiyat isteme yazısı",
      grup: "Fiyat ve onay",
      tamam:
        !!dosya.fiyatIsteme.tarih &&
        dosya.yaklasik.firmalar.length > 0 &&
        dosya.yaklasik.firmalar.some((f) => f.belgeAlindi || Object.values(f.fiyatlar).some((v) => v !== null && v > 0)),
      gerekmez: yaklasikYok ? "yaklaşık maliyet hesaplanmıyor" : undefined,
    },
    {
      no: 4,
      ad: "Yaklaşık maliyet cetveli",
      grup: "Fiyat ve onay",
      tamam:
        dosya.yaklasik.firmalar.length > 0 &&
        yaklasikHesapla(kalemler, dosya.yaklasik).hesaplanabilir &&
        !!dosya.yaklasik.onaylandi,
      gerekmez: yaklasikYok ? "Tebliğ m.4/4" : undefined,
    },
    { no: 5, ad: "Onay belgesi", grup: "Fiyat ve onay", tamam: evrak("onay-belgesi"), evrakKodu: "onay-belgesi" },
    dd
      ? { no: 6, ad: "Teklif mektupları", grup: "Fiyat ve onay", tamam: !!piyasa?.teklifler.some((t) => t.belgeAlindi) || evrak("fiyat-teklifi"), evrakKodu: "fiyat-teklifi" }
      : { no: 6, ad: "Firmadan fiyat teklifi", grup: "Fiyat ve onay", tamam: evrak("fiyat-teklifi"), evrakKodu: "fiyat-teklifi" },
    { no: 7, ad: "Piyasa fiyat araştırma tutanağı", grup: "Fiyat ve onay", tamam: !!piyasa?.tamamlandi || evrak("piyasa-tutanagi"), evrakKodu: "piyasa-tutanagi", gerekmez: dd ? undefined : "22/d dışı" },
    {
      no: 8,
      ad: sozlesmeZorunlu(alim) ? "Sözleşme" : "Sipariş yazısı",
      grup: "Sipariş",
      tamam: evrak("siparis-yazisi"),
      evrakKodu: "siparis-yazisi",
    },
    { no: 9, ad: "Muayene talep yazısı", grup: "Teslim ve kabul", tamam: evrak(BASAMAK_EVRAKLARI.muayeneTalebi), evrakKodu: BASAMAK_EVRAKLARI.muayeneTalebi },
    { no: 10, ad: "Muayene raporu", grup: "Teslim ve kabul", tamam: evrak(BASAMAK_EVRAKLARI.muayeneRaporu), evrakKodu: BASAMAK_EVRAKLARI.muayeneRaporu },
    { no: 11, ad: "Muayene ve kabul belgesi", grup: "Teslim ve kabul", tamam: !!g.muayene?.tamamlandi },
    { no: 12, ad: "Taşınır işlem fişi", grup: "Teslim ve kabul", tamam: evrak(BASAMAK_EVRAKLARI.tasinirFisi), evrakKodu: BASAMAK_EVRAKLARI.tasinirFisi },
    { no: 13, ad: "Ödeme emri belgesi", grup: "Ödeme", tamam: !!g.odeme?.tamamlandi },
  ];

  let suruyorVar = alim.asama === "iptal";
  return ham.map((h): Basamak => {
    const ortak = { no: h.no, ad: h.ad, grup: h.grup, evrakKodu: h.evrakKodu };
    if (h.gerekmez) return { ...ortak, durum: "gerekmiyor", not: `Gerekmiyor · ${h.gerekmez}` };
    if (h.tamam) return { ...ortak, durum: "tamam", not: "Tamamlandı" };
    if (!suruyorVar) {
      suruyorVar = true;
      return { ...ortak, durum: "suruyor", not: "Sürüyor" };
    }
    return { ...ortak, durum: "bekliyor", not: "Bekliyor" };
  });
}

// Dosya açıldığında gidilecek basamak: süren basamak, hepsi bittiyse sonuncusu.
export function acilisBasamagi(liste: Basamak[]): number {
  return liste.find((b) => b.durum === "suruyor")?.no ?? liste[liste.length - 1].no;
}

export function ilerleme(liste: Basamak[]): { biten: number; gerekli: number } {
  const gerekli = liste.filter((b) => b.durum !== "gerekmiyor");
  return { biten: gerekli.filter((b) => b.durum === "tamam").length, gerekli: gerekli.length };
}

export function oncekiSonraki(liste: Basamak[], no: number): { onceki: Basamak | null; sonraki: Basamak | null } {
  const i = liste.findIndex((b) => b.no === no);
  const ileri = liste.slice(i + 1).find((b) => b.durum !== "gerekmiyor") ?? null;
  const geri = [...liste.slice(0, Math.max(i, 0))].reverse().find((b) => b.durum !== "gerekmiyor") ?? null;
  return { onceki: geri, sonraki: ileri };
}

export function veriKontrolleri(kalemler: PiyasaKalemi[], d: DosyaBasamaklari, alim: Alim): Kontrol[] {
  const k: Kontrol[] = [];
  if (kalemler.length === 0) k.push({ durum: "engel", baslik: "İhtiyaç listesi boş", detay: "En az bir kalem ekleyin; fiyat isteme yazısı bu listeyle hazırlanır." });
  else {
    const eksik = kalemler.filter((x) => !x.ad.trim() || !(x.miktar > 0));
    k.push(
      eksik.length
        ? { durum: "uyari", baslik: "Eksik kalem", detay: `${eksik.length} kalemin adı ya da miktarı eksik.` }
        : { durum: "tamam", baslik: "İhtiyaç listesi hazır", detay: `${kalemler.length} kalem, hepsinin miktarı var.` },
    );
  }
  k.push(
    sozlesmeZorunlu(alim)
      ? { durum: "uyari", baslik: "Sözleşme gerekli", detay: "Süreye yayılan işlerde ve 22/c'de sözleşme yapılır (Tebliğ m.4/5). 8. basamak sözleşme olur." }
      : { durum: "tamam", baslik: "Sözleşme gerekmiyor", detay: "Tek seferde teslim; 8. basamakta sipariş yazısı yeterlidir." },
  );
  const bosSart = SARTLAR.filter((s) => !d.sartlar[s.kod].trim()).length;
  k.push(
    bosSart
      ? { durum: "yapilacak", baslik: `${bosSart} şart boş`, detay: 'Boş maddeler belgeye "Yoktur" olarak yazılır.' }
      : { durum: "tamam", baslik: "Şartlar yazıldı", detay: "7 maddenin tamamı dolu." },
  );
  if (!d.odenek) k.push({ durum: "yapilacak", baslik: "Ödenek girilmedi", detay: "Yaklaşık maliyet basamağında ödenek kontrolü için gerekir." });
  return k;
}

export function ihtiyacOnayiKontrolleri(d: DosyaBasamaklari, imzacilarVar: boolean): Kontrol[] {
  const l = d.ihtiyacOnayi;
  const k: Kontrol[] = [];
  k.push(
    l.gerekce.trim().length < 20
      ? { durum: "uyari", baslik: "Gerekçe kısa", detay: "İhtiyacın neden doğduğunu bir iki cümleyle yazın; denetimde ilk bakılan yerdir." }
      : { durum: "tamam", baslik: "Gerekçe yazıldı", detay: "Belgeye olduğu gibi aktarılır." },
  );
  if (!l.tarih) k.push({ durum: "engel", baslik: "Tarih yok", detay: "Belge tarihini girin." });
  k.push(
    imzacilarVar
      ? { durum: "tamam", baslik: "İmzacılar atanmış", detay: "Personel ve görevler ekranındaki atamalardan geldi." }
      : { durum: "uyari", baslik: "İmzacı eksik", detay: "Gerçekleştirme görevlisi ve harcama yetkilisini Personel ve görevler ekranında atayın." },
  );
  k.push(
    l.imzali
      ? { durum: "tamam", baslik: "Belge imzalı", detay: "Basamak tamamlandı." }
      : { durum: "yapilacak", baslik: "İmza bekliyor", detay: "Yazdırıp imzalatın, ardından imzalandı olarak işaretleyin." },
  );
  return k;
}

export function isinTuruBul(ekonomikKod: string): string {
  if (ekonomikKod.startsWith("03.2")) return "Mal Alımı";
  if (ekonomikKod.startsWith("03.5") || ekonomikKod.startsWith("03.7") || ekonomikKod.startsWith("03.8")) return "Hizmet Alımı";
  if (ekonomikKod.startsWith("06")) return "Yapım İşi";
  return "Mal Alımı";
}

export function onayBelgesiKontrolleri(
  alim: Alim,
  dosya: DosyaBasamaklari,
  ayarlar: Ayarlar,
  _piyasa: PiyasaArastirmasi | null,
): Kontrol[] {
  const k: Kontrol[] = [];
  const g = ayarlar.gorevler;

  // 1. Yaklaşık Maliyet kontrolü
  if (!dosya.yaklasik.hesaplanmayacak) {
    if (!dosya.yaklasik.onaylandi) {
      k.push({
        durum: "engel",
        baslik: "Yaklaşık maliyet onaylanmamış",
        detay: "4. basamakta yaklaşık maliyet cetvelini onaylamanız gerekir.",
      });
    } else {
      k.push({
        durum: "tamam",
        baslik: "Yaklaşık maliyet hazır",
        detay: `Yaklaşık maliyet ${tl(alim.tutar)} (KDV Hariç) olarak onaylandı.`,
      });
    }
  }

  // 2. Kullanılabilir ödenek kontrolü
  if (!dosya.odenek || dosya.odenek <= 0) {
    k.push({
      durum: "uyari",
      baslik: "Kullanılabilir ödenek girilmemiş",
      detay: "Onay belgesinde ödenek tutarının görünmesi için 1. basamakta ödenek miktarını girmeniz önerilir.",
    });
  } else {
    k.push({
      durum: "tamam",
      baslik: "Kullanılabilir ödenek hazır",
      detay: `Bütçe tertibindeki kullanılabilir ödenek: ${tl(dosya.odenek)}.`,
    });
  }

  // 3. EKAP doğrudan temin kayıt numarası
  if (!alim.ekapKayitNo?.trim()) {
    k.push({
      durum: "uyari",
      baslik: "EKAP kayıt numarası boş",
      detay: "Doğrudan Temin Tebliği m.5/1 uyarınca EKAP'tan alınan doğrudan temin kayıt numarasını girmeniz önerilir.",
    });
  } else {
    k.push({
      durum: "tamam",
      baslik: "EKAP kayıt numarası girildi",
      detay: `Kayıt No: ${alim.ekapKayitNo}`,
    });
  }

  // 4. Bütçe Tertibi (Ekonomik Kod)
  if (!alim.ekonomikKod?.trim()) {
    k.push({
      durum: "uyari",
      baslik: "Bütçe tertibi seçilmemiş",
      detay: "Alımın bütçe tertibi (ekonomik kodu) boş.",
    });
  } else {
    k.push({
      durum: "tamam",
      baslik: "Bütçe tertibi hazır",
      detay: `Tertip / Kod: ${alim.ekonomikKod}`,
    });
  }

  // 5. Harcama Yetkilisi ve Gerçekleştirme Görevlisi
  if (!g?.harcamaYetkilisi || !g?.gerceklestirme) {
    k.push({
      durum: "engel",
      baslik: "Harcama görevlileri eksik",
      detay: "Onay belgesinin imzacıları olan Harcama Yetkilisi ve Gerçekleştirme Görevlisini Personel ekranından atayın.",
    });
  } else {
    k.push({
      durum: "tamam",
      baslik: "İmzacı yetkililer hazır",
      detay: "Gerçekleştirme görevlisi ve harcama yetkilisi belirlendi.",
    });
  }

  // 6. Piyasa Fiyat Araştırması Görevlileri
  const piyasaGorevlileri = g?.piyasaGorevlileri ?? [];
  if (piyasaGorevlileri.length === 0) {
    k.push({
      durum: "uyari",
      baslik: "Piyasa görevlileri seçilmemiş",
      detay: "Onay belgesinin görevlendirme maddesinde yer alacak piyasa araştırma görevlilerini seçin.",
    });
  } else {
    k.push({
      durum: "tamam",
      baslik: `${piyasaGorevlileri.length} piyasa görevlisi görevlendirildi`,
      detay: "Onay belgesinde görevlendirme kısmına yazılacak.",
    });
  }

  // 7. İhtiyaç Gerekçesi
  if (!dosya.ihtiyacOnayi.gerekce?.trim()) {
    k.push({
      durum: "uyari",
      baslik: "İhtiyaç gerekçesi boş",
      detay: "Alım gerekçesini doldurmanız önerilir.",
    });
  }

  return k;
}

// ---- Evrakla tamamlanan basamakların formu ----

export interface EvrakFormu {
  tarih: string;
  sayi: string;
}

const GUN = /^\d{4}-\d{2}-\d{2}$/;

// Sayfa açılırken kayıtlı evrakın tarihi ve sayısı geri yüklenir; kayıt yoksa bugün ve varsayılan sayı gelir.
// Eski sürümün tarih yerine zaman damgası (ISO) yazdığı kayıtlarda ilk on karakter alınır.
export function evrakFormu(kayit: EvrakKaydi | undefined, bugun: string, varsayilanSayi = ""): EvrakFormu {
  return {
    tarih: kayit?.tarih ? kayit.tarih.slice(0, 10) : bugun,
    sayi: kayit?.not ?? varsayilanSayi,
  };
}

// Kullanıcının girdiği belge tarihi olduğu gibi kaydedilir ("YYYY-AA-GG"); boş ya da başka biçimdeki tarih reddedilir.
export function evrakKaydiYap(form: EvrakFormu, tamam = true): EvrakKaydi {
  if (!GUN.test(form.tarih)) throw new Error("Belge tarihi YYYY-AA-GG biçiminde olmalı.");
  return { tamam, tarih: form.tarih, not: form.sayi.trim() };
}
