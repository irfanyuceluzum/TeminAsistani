import { damgaVergisi, type DamgaSonucu } from "./kurallar";
import type { EvrakDurumu } from "./dosya";
import type { Kontrol } from "./sihirbaz";
import type { Alim, Ayarlar } from "./tipler";

export interface TevkifatTuru {
  kod: string;
  ad: string;
  pay: number;
  payda: number;
}

// Oranlar KDV Genel Uygulama Tebliği'nden doğrulanmalı; ileride Parametreler'den yönetilecek.
export const TEVKIFAT_TURLERI: TevkifatTuru[] = [
  { kod: "yok", ad: "Tevkifat yok", pay: 0, payda: 10 },
  { kod: "bakim-onarim", ad: "Makine, teçhizat, demirbaş ve taşıt bakım onarımı", pay: 7, payda: 10 },
  { kod: "temizlik", ad: "Temizlik, çevre ve bahçe bakım hizmetleri", pay: 9, payda: 10 },
  { kod: "yemek", ad: "Yemek servis ve organizasyon hizmetleri", pay: 5, payda: 10 },
  { kod: "personel", ad: "İşgücü temin hizmetleri", pay: 9, payda: 10 },
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

const bosSorgu = (): BorcSorgusu => ({ durum: "yapilmadi", tarih: "", belgeNo: "", borc: 0 });

export function odemeOlustur(alim: Alim): Odeme {
  return {
    alimId: alim.id,
    kdvOrani: 20,
    tevkifatTuru: alim.ekonomikKod.startsWith("03.7") ? "bakim-onarim" : "yok",
    sozlesmeVar: false,
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

// Ödeme emrine eklenecek belgeler: önceki aşamaların evrakları ve borç sorgusu. Ödeme emri ve KİK bildirimi ödemeden sonra gelir.
export function ekListesi(evraklar: EvrakDurumu[], o: Odeme): { ad: string; tamam: boolean; not: string }[] {
  const liste = evraklar
    .filter((e) => e.asama !== "odeme")
    .map((e) => ({ ad: e.ad, tamam: e.tamam, not: e.tamam ? (e.tarih ? e.tarih.split("-").reverse().join(".") : e.not) : "Eksik" }));
  const sorguTamam = (s: BorcSorgusu) => s.durum !== "yapilmadi";
  liste.push({
    ad: "Vergi ve SGK borç sorgusu",
    tamam: sorguTamam(o.vergiSorgusu) && sorguTamam(o.sgkSorgusu),
    not: sorguTamam(o.vergiSorgusu) && sorguTamam(o.sgkSorgusu) ? "Bu ekrandan" : "Sorgular işaretlenmeli",
  });
  return liste;
}

function tl(kurus: number): string {
  return "₺" + (kurus / 100).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function odemeKontrolleri(o: Odeme, h: OdemeHesabi, ekler: { ad: string; tamam: boolean }[], ayarlar: Ayarlar): Kontrol[] {
  const k: Kontrol[] = [];
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
