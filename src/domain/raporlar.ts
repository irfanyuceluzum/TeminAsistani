import type { EvrakKaydi } from "./dosya";
import { yuzdeOnDurumu, type YuzdeOnDurumu } from "./kurallar";
import { teklifVerenler, type PiyasaArastirmasi } from "./piyasa";
import type { Alim, Ayarlar } from "./tipler";

export interface AylikTutar {
  ay: number;
  adet: number;
  tutar: number;
}

export interface YillikOzet {
  toplam: number;
  adet: number;
  ddToplam: number;
  ddAdet: number;
  yuzdeOn: YuzdeOnDurumu | null;
  aylik: AylikTutar[];
  ekonomikKodlar: { kod: string; tutar: number }[];
  ortalamaTeklif: number | null;
}

export function yilAlimlari(alimlar: Alim[], yil: number): Alim[] {
  return alimlar.filter((a) => a.asama !== "iptal" && a.onayTarihi.startsWith(String(yil)));
}

export function yillar(alimlar: Alim[], buYil: number): number[] {
  return [...new Set([buYil, ...alimlar.map((a) => Number(a.onayTarihi.slice(0, 4)))])].sort((x, y) => y - x);
}

export function yillikOzet(alimlar: Alim[], yil: number, ayarlar: Ayarlar, piyasalar: PiyasaArastirmasi[]): YillikOzet {
  const yilin = yilAlimlari(alimlar, yil);
  // Uygulamaya gelen liste yalnız 22/d alımlarıdır.
  const dd = yilin;
  const toplam = yilin.reduce((s, a) => s + a.tutar, 0);
  const aylik = Array.from({ length: 12 }, (_, i) => {
    const ay = dd.filter((a) => Number(a.onayTarihi.slice(5, 7)) === i + 1);
    return { ay: i + 1, adet: ay.length, tutar: ay.reduce((s, a) => s + a.tutar, 0) };
  });
  const kodlar = new Map<string, number>();
  for (const a of dd) kodlar.set(a.ekonomikKod.slice(0, 4), (kodlar.get(a.ekonomikKod.slice(0, 4)) ?? 0) + a.tutar);
  const ddIdleri = new Set(dd.map((a) => a.id));
  const arastirmalar = piyasalar.filter((p) => ddIdleri.has(p.alimId) && p.tamamlandi);
  const odenek = ayarlar.odenekler[yil];
  return {
    toplam,
    adet: yilin.length,
    ddToplam: dd.reduce((s, a) => s + a.tutar, 0),
    ddAdet: dd.length,
    yuzdeOn: odenek ? yuzdeOnDurumu(alimlar, yil, odenek) : null,
    aylik,
    ekonomikKodlar: [...kodlar.entries()].map(([kod, tutar]) => ({ kod, tutar })).sort((x, y) => y.tutar - x.tutar),
    ortalamaTeklif: arastirmalar.length ? arastirmalar.reduce((s, p) => s + teklifVerenler(p).length, 0) / arastirmalar.length : null,
  };
}

export interface KikSatiri {
  alim: Alim;
  bildirildi: boolean;
  tarih: string | null;
  sonGun: string;
  gecikti: boolean;
}

const ALIM_YAPILDI = new Set(["siparis", "muayene", "odeme", "tamamlandi"]);

// Doğrudan Temin Tebliği m.4/9: alım sonucu, alımın yapıldığı ayı izleyen ayın 10'una kadar bildirilir.
// Alım tarihi olarak sipariş yazısı tarihi, yoksa onay tarihi alınır.
export function kikSonGunu(alim: Alim, evraklar: Record<string, EvrakKaydi> | undefined): string {
  const esas = evraklar?.["siparis-yazisi"]?.tamam ? evraklar["siparis-yazisi"].tarih : alim.onayTarihi;
  const yil = Number(esas.slice(0, 4));
  const ay = Number(esas.slice(5, 7));
  return ay === 12 ? `${yil + 1}-01-10` : `${yil}-${String(ay + 1).padStart(2, "0")}-10`;
}

// Bildirim, siparişi verilmiş (alımı yapılmış) dosyalar için istenir; dosyadaki "KİK bildirimi" evrakı işaretlenince tamam sayılır.
export function kikBildirimleri(alimlar: Alim[], yil: number, evraklar: Record<string, Record<string, EvrakKaydi>>, bugun: string): KikSatiri[] {
  return yilAlimlari(alimlar, yil)
    .filter((a) => ALIM_YAPILDI.has(a.asama))
    .map((a) => {
      const k = evraklar[a.id]?.["kik-bildirimi"];
      const sonGun = kikSonGunu(a, evraklar[a.id]);
      const bildirildi = !!k?.tamam;
      return { alim: a, bildirildi, tarih: bildirildi ? k!.tarih : null, sonGun, gecikti: !bildirildi && bugun > sonGun };
    })
    .sort((x, y) => Number(x.bildirildi) - Number(y.bildirildi) || x.sonGun.localeCompare(y.sonGun) || y.alim.id.localeCompare(x.alim.id));
}

function hucre(deger: string | number): string {
  const metin = String(deger);
  return /[";\n]/.test(metin) ? `"${metin.replace(/"/g, '""')}"` : metin;
}

// Türkçe Excel noktalı virgülü ayraç, virgülü ondalık işareti sayar; UTF-8 için başa BOM eklenir.
export function csvOlustur(basliklar: string[], satirlar: (string | number)[][]): string {
  const sayi = (d: string | number) => (typeof d === "number" ? d.toLocaleString("tr-TR", { useGrouping: false, maximumFractionDigits: 2 }) : d);
  return "﻿" + [basliklar, ...satirlar].map((s) => s.map((d) => hucre(sayi(d))).join(";")).join("\r\n") + "\r\n";
}
