import { degerlendir, firmaToplami, type PiyasaArastirmasi } from "./piyasa";
import type { Alim, Tedarikci } from "./tipler";

// Bu süreden eski yasaklılık sorgusu, yeni alımda yenilenmesi gereken sorgu olarak işaretlenir.
export const SORGU_ESKIME_GUNU = 90;

export type TeklifSonucu = "kazandi" | "kaybetti" | "suruyor";

export interface GecmisTeklif {
  alimId: string;
  konu: string;
  tarih: string;
  toplam: number | null;
  sonuc: TeklifSonucu;
  // En düşük toplam teklife göre fark, oran (0,026 = %2,6). Kazanan ya da karşılaştırılamayan teklifte null.
  fark: number | null;
}

export interface YasaklilikKaydi {
  tarih: string;
  alimId: string;
}

export interface FirmaGecmisi {
  teklifler: GecmisTeklif[];
  sorgular: YasaklilikKaydi[];
  teklifSayisi: number;
  kazanilan: number;
  siparisToplami: number;
  sonSorgu: string | null;
}

export function firmaGecmisi(tedarikciId: string, piyasalar: PiyasaArastirmasi[], alimlar: Alim[]): FirmaGecmisi {
  const teklifler: GecmisTeklif[] = [];
  const sorgular: YasaklilikKaydi[] = [];
  let siparisToplami = 0;
  for (const p of piyasalar) {
    const t = p.teklifler.find((x) => x.tedarikciId === tedarikciId);
    if (!t) continue;
    const alim = alimlar.find((a) => a.id === p.alimId);
    if (t.yasaklilikSorgusu) sorgular.push({ tarih: t.yasaklilikSorgusu, alimId: p.alimId });
    const fiyatVerdi = p.kalemler.some((k) => t.fiyatlar[k.id] !== null && t.fiyatlar[k.id] !== undefined);
    if (!fiyatVerdi) continue;
    const sonuc = degerlendir(p);
    const toplam = firmaToplami(p, tedarikciId);
    const kazandi = p.tamamlandi && !!sonuc?.kazananlar.includes(tedarikciId);
    if (kazandi && sonuc) siparisToplami += sonuc.atamalar.filter((a) => a.tedarikciId === tedarikciId).reduce((s, a) => s + a.tutar, 0);
    const tamToplamlar = p.teklifler.map((x) => firmaToplami(p, x.tedarikciId)).filter((x): x is number => x !== null);
    const enDusuk = tamToplamlar.length ? Math.min(...tamToplamlar) : null;
    teklifler.push({
      alimId: p.alimId,
      konu: alim?.konu ?? p.alimId,
      tarih: t.teklifTarihi ?? alim?.onayTarihi ?? "",
      toplam,
      sonuc: !p.tamamlandi ? "suruyor" : kazandi ? "kazandi" : "kaybetti",
      fark: toplam !== null && enDusuk !== null && toplam > enDusuk ? (toplam - enDusuk) / enDusuk : null,
    });
  }
  teklifler.sort((x, y) => y.tarih.localeCompare(x.tarih));
  sorgular.sort((x, y) => y.tarih.localeCompare(x.tarih));
  return {
    teklifler,
    sorgular,
    teklifSayisi: teklifler.length,
    kazanilan: teklifler.filter((t) => t.sonuc === "kazandi").length,
    siparisToplami,
    sonSorgu: sorgular[0]?.tarih ?? null,
  };
}

export function sorguYasi(sonSorgu: string | null, bugun: string): number | null {
  if (!sonSorgu) return null;
  return Math.round((Date.parse(bugun + "T00:00:00Z") - Date.parse(sonSorgu + "T00:00:00Z")) / 86_400_000);
}

export function bilgiEksik(t: Tedarikci): boolean {
  return !t.vkn?.trim() || !t.iban?.trim();
}

// ISO 13616: ilk dört karakter sona alınır, harfler sayıya çevrilir, 97'ye bölümden kalan 1 olmalı.
export function ibanGecerli(iban: string): boolean {
  const s = iban.replace(/\s/g, "").toUpperCase();
  if (!/^TR\d{24}$/.test(s)) return false;
  const duzen = (s.slice(4) + s.slice(0, 4)).replace(/[A-Z]/g, (h) => String(h.charCodeAt(0) - 55));
  let kalan = 0;
  for (const c of duzen) kalan = (kalan * 10 + Number(c)) % 97;
  return kalan === 1;
}

export function tedarikciHatalari(t: Tedarikci, mevcut: Tedarikci[]): string[] {
  const h: string[] = [];
  if (!t.ad.trim()) h.push("Firma adını yazın.");
  else if (mevcut.some((x) => x.id !== t.id && x.ad.trim().toLocaleLowerCase("tr-TR") === t.ad.trim().toLocaleLowerCase("tr-TR"))) h.push("Bu adla kayıtlı bir firma var.");
  const vkn = t.vkn?.trim() ?? "";
  if (vkn && !/^\d{10,11}$/.test(vkn)) h.push("Vergi kimlik numarası 10, TC kimlik numarası 11 haneli olmalı.");
  else if (vkn && mevcut.some((x) => x.id !== t.id && x.vkn?.trim() === vkn)) h.push("Bu vergi numarasıyla kayıtlı bir firma var.");
  if (t.iban?.trim() && !ibanGecerli(t.iban)) h.push("IBAN geçersiz. TR ile başlayan 26 karakteri kontrol edin.");
  if (t.eposta?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t.eposta.trim())) h.push("E-posta adresi geçersiz.");
  return h;
}

export function ibanBicimle(iban: string): string {
  return iban.replace(/\s/g, "").toUpperCase().replace(/(.{4})/g, "$1 ").trim();
}

// Firma adından kalıcı kimlik üretir: Türkçe harfler sadeleşir, çakışmada sona sayı eklenir.
export function firmaKimligi(ad: string, mevcut: string[]): string {
  const kok =
    ad
      .toLocaleLowerCase("tr-TR")
      .replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i").replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "firma";
  let id = kok;
  for (let i = 2; mevcut.includes(id); i++) id = `${kok}-${i}`;
  return id;
}
