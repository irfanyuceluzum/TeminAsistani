import { damgaVergisi, malAlimiMi, type DamgaSonucu } from "./kurallar";
import type { EvrakDurumu } from "./dosya";
import { muayeneOzeti, type Muayene } from "./muayene";
import { sozlesmeZorunlu, type Kontrol } from "./sihirbaz";
import type { Alim, Ayarlar } from "./tipler";

export interface TevkifatTuru {
  kod: string;
  ad: string;
  pay: number;
  payda: number;
}

// KDV GUT I/C-2.1.3.2 hizmet oranları ve I/C-2.1.3.3.7 "diğer teslimler" (mal teslimi 2/10); doğrulama durumu docs/mevzuat-varsayimlari.md. İleride Parametreler'den yönetilecek.
export const TEVKIFAT_TURLERI: TevkifatTuru[] = [
  { kod: "yok", ad: "Tevkifat yok", pay: 0, payda: 10 },
  { kod: "bakim-onarim", ad: "Makine, teçhizat, demirbaş ve taşıt bakım onarımı", pay: 7, payda: 10 },
  { kod: "temizlik", ad: "Temizlik, çevre ve bahçe bakım hizmetleri", pay: 9, payda: 10 },
  { kod: "yemek", ad: "Yemek servis ve organizasyon hizmetleri", pay: 5, payda: 10 },
  { kod: "personel", ad: "İşgücü temin hizmetleri", pay: 9, payda: 10 },
  { kod: "mal-teslimi", ad: "Mal teslimleri (belirlenmiş alıcılara diğer teslimler)", pay: 2, payda: 10 },
];

export type SorguDurumu = "yapilmadi" | "borcsuz" | "borclu" | "gerekmiyor";

export interface BorcSorgusu {
  durum: SorguDurumu;
  tarih: string;
  belgeNo: string;
  // Borçlu ise kuruş
  borc: number;
}

export interface Odeme {
  alimId: string;
  kdvOrani: number;
  tevkifatTuru: string;
  sozlesmeVar: boolean;
  komisyonKarariVar: boolean;
  vergiSorgusu: BorcSorgusu;
  sgkSorgusu: BorcSorgusu;
  oebNo: string;
  tamamlandi: boolean;
}

export interface OdemeHesabi {
  matrah: number;
  kdv: number;
  brut: number;
  tevkifat: number;
  tevkifatUygulandi: boolean;
  damga: DamgaSonucu;
  vergiMahsubu: number;
  sgkMahsubu: number;
  yukleniciye: number;
  vergiDairesine: number;
  sgkya: number;
}

// Kuruş; tanımsızsa ₺5.000
const VARSAYILAN_VERGI_SORGU_ESIGI = 5_000 * 100;

const bosSorgu =(): BorcSorgusu => ({ durum: "yapilmadi", tarih: "", belgeNo: "", borc: 0 });

// Yeni ödeme kaydının varsayılan tevkifat türü; kullanıcı ödeme basamağında değiştirebilir.
function varsayilanTevkifat(ekonomikKod: string): string {
  if (ekonomikKod.startsWith("03.7")) return "bakim-onarim";
  if (malAlimiMi(ekonomikKod)) return "mal-teslimi";
  return "yok";
}

export function odemeOlustur(alim: Alim): Odeme {
  return {
    alimId: alim.id,
    kdvOrani: 20,
    tevkifatTuru: varsayilanTevkifat(alim.ekonomikKod),
    sozlesmeVar: sozlesmeZorunlu(alim),
    komisyonKarariVar: false,
    vergiSorgusu: bosSorgu(),
    sgkSorgusu: bosSorgu(),
    oebNo: "",
    tamamlandi: false,
  };
}

export function tevkifatTuru(kod: string): TevkifatTuru {
  return TEVKIFAT_TURLERI.find((t) => t.kod === kod) ?? TEVKIFAT_TURLERI[0];
}

// Matrah kabul edilen KDV hariç tutardır. Borçlar, kesintilerden sonra kalan tutarı aşmayacak kadar mahsup edilir.
export function odemeHesabi(matrah: number, o: Odeme, ayarlar: Ayarlar): OdemeHesabi {
  const kdv = Math.round((matrah * o.kdvOrani) / 100);
  const brut = matrah + kdv;
  const t = tevkifatTuru(o.tevkifatTuru);
  const sinir = ayarlar.tevkifatSiniri ?? 0;
  const tevkifatUygulandi = t.pay > 0 && brut > sinir;
  const tevkifat = tevkifatUygulandi ? Math.round((kdv * t.pay) / t.payda) : 0;
  const damga = damgaVergisi(matrah, ayarlar.damga, { sozlesmeVar: o.sozlesmeVar, komisyonKarariVar: o.komisyonKarariVar });
  let kalan = brut - tevkifat - damga.toplam;
  const vergiMahsubu = o.vergiSorgusu.durum === "borclu" ? Math.min(o.vergiSorgusu.borc, Math.max(0, kalan)) : 0;
  kalan -= vergiMahsubu;
  const sgkMahsubu = o.sgkSorgusu.durum === "borclu" ? Math.min(o.sgkSorgusu.borc, Math.max(0, kalan)) : 0;
  kalan -= sgkMahsubu;
  return {
    matrah,
    kdv,
    brut,
    tevkifat,
    tevkifatUygulandi,
    damga,
    vergiMahsubu,
    sgkMahsubu,
    yukleniciye: kalan,
    vergiDairesine: tevkifat + damga.toplam + vergiMahsubu,
    sgkya: sgkMahsubu,
  };
}

// Ödemenin matrahı: muayenede kabul edilen KDV hariç tutar; muayene tamamlanmadıysa dosyadaki sözleşme/sipariş tutarı.
export function odemeMatrahi(alim: Alim, muayene: Muayene | null): number {
  return muayene?.tamamlandi ? muayeneOzeti(muayene).kabulToplami : alim.tutar;
}

export interface OebSatiri {
  aciklama: string;
  // Kuruş; olmayan taraf null
  borc: number | null;
  alacak: number | null;
}

function binde(yuzBinde: number): string {
  return (yuzBinde / 100).toLocaleString("tr-TR", { maximumFractionDigits: 2 });
}

// Ödeme emri belgesinin hesap satırları. Borç: KDV dahil fatura bedeli; alacak: kesintiler ve yükleniciye net ödeme.
export function oebSatirlari(h: OdemeHesabi, o: Odeme, ayarlar: Ayarlar): OebSatiri[] {
  const s: OebSatiri[] = [
    { aciklama: "Mal / hizmet bedeli (KDV hariç)", borc: h.matrah, alacak: null },
    { aciklama: `Katma değer vergisi (%${o.kdvOrani})`, borc: h.kdv, alacak: null },
  ];
  if (h.tevkifat) s.push({ aciklama: `KDV tevkifatı (${tevkifatTuru(o.tevkifatTuru).pay}/${tevkifatTuru(o.tevkifatTuru).payda})`, borc: null, alacak: h.tevkifat });
  if (h.damga.makbuz) s.push({ aciklama: `Damga vergisi, makbuz (binde ${binde(ayarlar.damga.makbuzOrani)})`, borc: null, alacak: h.damga.makbuz });
  if (h.damga.sozlesme) s.push({ aciklama: `Damga vergisi, sözleşme (binde ${binde(ayarlar.damga.sozlesmeOrani)})`, borc: null, alacak: h.damga.sozlesme });
  if (h.damga.karar) s.push({ aciklama: `Damga vergisi, karar (binde ${binde(ayarlar.damga.kararOrani)})`, borc: null, alacak: h.damga.karar });
  if (h.vergiMahsubu) s.push({ aciklama: "Vergi borcu mahsubu", borc: null, alacak: h.vergiMahsubu });
  if (h.sgkMahsubu) s.push({ aciklama: "SGK borcu mahsubu", borc: null, alacak: h.sgkMahsubu });
  s.push({ aciklama: "Yükleniciye net ödenecek", borc: null, alacak: h.yukleniciye });
  return s;
}

// Vergi borcu sorgusu yalnızca eşiği aşan ödemelerde gerekir; odemeTutari KDV dahil brüt, kuruş.
// SGK sorgusunda tutar sınırı yoktur.
export function vergiSorguEsigi(ayarlar: Ayarlar): number {
  return ayarlar.vergiBorcuSorguEsigi ?? VARSAYILAN_VERGI_SORGU_ESIGI;
}

export function borcSorgusuGerekli(odemeTutari: number, ayarlar: Ayarlar): { vergi: boolean; sgk: boolean } {
  const esik = vergiSorguEsigi(ayarlar);
  // 5510 md. 90 ve SGK hakediş mahsup yönetmeliği (RG 29.09.2008) tutar sınırı koymuyor
  return { vergi: odemeTutari > esik, sgk: true };
}

// Gerekmeyen sorgu tamam sayılır; gerekli olan sorgu "yapilmadi" kalmamalıdır.
export function borcSorgulariTamam(o: Odeme, brut: number, ayarlar: Ayarlar): boolean {
  const g = borcSorgusuGerekli(brut, ayarlar);
  return (!g.vergi || o.vergiSorgusu.durum !== "yapilmadi") && (!g.sgk || o.sgkSorgusu.durum !== "yapilmadi");
}

// Ödeme emrine eklenecek belgeler: önceki aşamaların evrakları ve borç sorgusu. Ödeme emri ve KİK bildirimi ödemeden sonra gelir.
export function ekListesi(evraklar: EvrakDurumu[], o: Odeme, brut: number, ayarlar: Ayarlar): { ad: string; tamam: boolean; not: string }[] {
  const liste = evraklar
    .filter((e) => e.asama !== "odeme")
    .map((e) => ({ ad: e.ad, tamam: e.tamam, not: e.tamam ? (e.tarih ? e.tarih.split("-").reverse().join(".") : e.not) : "Eksik" }));
  const tamam = borcSorgulariTamam(o, brut, ayarlar);
  liste.push({
    ad: "Vergi ve SGK borç sorgusu",
    tamam,
    not: tamam ? "Bu ekrandan" : "Sorgular işaretlenmeli",
  });
  return liste;
}

function tl(kurus: number): string {
  return "₺" + (kurus / 100).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function tutarMetni(kurus: number): string {
  return (kurus / 100).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export interface KbsAlani {
  ad: string;
  deger: string;
}

// KBS'de ödeme emri belgesi oluşturulurken kopyalanacak alanlar. Tutarlar "1.234,56" biçiminde, TL işaretsizdir.
export function kbsAlanlari(alim: Alim, h: OdemeHesabi, yukleniciAdi: string, iban: string): KbsAlani[] {
  const mahsup = h.vergiMahsubu + h.sgkMahsubu > 0 ? " Kamu borcu ödemeden mahsup edilmiştir." : "";
  return [
    { ad: "Ekonomik kod", deger: alim.ekonomikKod },
    { ad: "Alacaklı", deger: yukleniciAdi },
    { ad: "IBAN", deger: iban.trim() || "—" },
    { ad: "Brüt tutar, KDV dahil", deger: tutarMetni(h.brut) },
    { ad: "KDV tevkifatı", deger: tutarMetni(h.tevkifat) },
    { ad: "Damga vergisi", deger: tutarMetni(h.damga.toplam) },
    { ad: "Net ödeme", deger: tutarMetni(h.yukleniciye) },
    {
      ad: "Ödeme emri açıklaması",
      deger: `${alim.id} dosyası, 4734 sayılı Kanun ${alim.bent} kapsamında doğrudan teminle alınan ${alim.konu.toLocaleLowerCase("tr-TR")} bedeli. ${yukleniciAdi}.${mahsup}`,
    },
  ];
}

export function odemeKontrolleri(o: Odeme, h: OdemeHesabi, ekler: { ad: string; tamam: boolean }[], ayarlar: Ayarlar, sozlesmeGerekli = false): Kontrol[] {
  const k: Kontrol[] = [];
  if (sozlesmeGerekli && !o.sozlesmeVar) {
    k.push({ durum: "uyari", baslik: "Sözleşme zorunlu", detay: "22/c alımlarında ve süreye yayılan işlerde sözleşme imzalanması zorunludur (Doğrudan Temin Tebliği m.4/5)." });
  }
  const eksik = ekler.filter((e) => !e.tamam).map((e) => e.ad);
  k.push(
    eksik.length
      ? { durum: "engel", baslik: "Ek listesi eksik", detay: `${eksik.join(", ")} tamamlanmadan ödeme emri düzenlenemez.` }
      : { durum: "tamam", baslik: "Ek listesi tamam", detay: `${ekler.length} belge eklenecek.` },
  );
  for (const [ad, s] of [
    ["Vergi", o.vergiSorgusu],
    ["SGK", o.sgkSorgusu],
  ] as const) {
    if (s.durum === "borclu" && s.borc <= 0) k.push({ durum: "engel", baslik: `${ad} borcu tutarı`, detay: "Borçlu işaretlenen sorgunun tutarını girin." });
    if ((s.durum === "borcsuz" || s.durum === "borclu") && !s.tarih) k.push({ durum: "uyari", baslik: `${ad} sorgu tarihi`, detay: "Sorgunun yapıldığı tarihi girin." });
  }
  const gerekli = borcSorgusuGerekli(h.brut, ayarlar);
  if (gerekli.vergi && o.vergiSorgusu.durum === "gerekmiyor") {
    const esik = vergiSorguEsigi(ayarlar);
    k.push({ durum: "engel", baslik: "Vergi borcu sorgusu gerekli", detay: `Ödeme ${tl(h.brut)}; ${tl(esik)} eşiğini aştığı için vergi borcu sorgulanmalı.` });
  }
  if (o.sgkSorgusu.durum === "gerekmiyor") {
    k.push({ durum: "uyari", baslik: "SGK borç sorgusunda tutar sınırı yok", detay: "SGK borç sorgusu ödeme tutarına bakılmadan yapılır; \"gerekmiyor\" yerine sonucu işaretleyin." });
  }
  const borcToplami = (o.vergiSorgusu.durum === "borclu" ? o.vergiSorgusu.borc : 0) + (o.sgkSorgusu.durum === "borclu" ? o.sgkSorgusu.borc : 0);
  if (borcToplami > h.vergiMahsubu + h.sgkMahsubu) {
    k.push({ durum: "uyari", baslik: "Borç ödemeyi aşıyor", detay: `Borcun ${tl(borcToplami - h.vergiMahsubu - h.sgkMahsubu)} kadarı bu ödemeden karşılanamıyor.` });
  } else if (borcToplami > 0) {
    k.push({ durum: "uyari", baslik: "Borç mahsubu", detay: `${tl(borcToplami)} ödemeden kesilip ilgili kuruma aktarılacak.` });
  }
  const t = tevkifatTuru(o.tevkifatTuru);
  if (t.pay > 0 && !ayarlar.tevkifatSiniri) {
    k.push({ durum: "uyari", baslik: "Tevkifat sınırı tanımlı değil", detay: "Sınır Parametreler'de girilmediği için tevkifat tutara bakılmadan uygulandı." });
  } else if (t.pay > 0 && !h.tevkifatUygulandi) {
    k.push({ durum: "tamam", baslik: "Tevkifat uygulanmadı", detay: "KDV dahil bedel tevkifat sınırının altında." });
  }
  if (!o.oebNo.trim()) k.push({ durum: "yapilacak", baslik: "Ödeme emri numarası", detay: "KBS'de oluşturulan ödeme emri belgesinin numarasını girin." });
  return k;
}
