import type { EvrakKaydi } from "./dosya";
import { yuzdeOnDurumu, type YuzdeOnDurumu } from "./kurallar";
import { teklifVerenler, type PiyasaArastirmasi } from "./piyasa";
import { BENTLER, bentBilgisi } from "./sihirbaz";
import type { Alim, Ayarlar, Bent } from "./tipler";

export interface BentPayi {
  bent: Bent;
  ad: string;
  adet: number;
  tutar: number;
  pay: number;
}

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
  bentler: BentPayi[];
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
  const dd = yilin.filter((a) => a.bent === "22/d");
  const toplam = yilin.reduce((s, a) => s + a.tutar, 0);
  const bentler = BENTLER.map((b) => {
    const grup = yilin.filter((a) => a.bent === b.kod);
    const tutar = grup.reduce((s, a) => s + a.tutar, 0);
    return { bent: b.kod, ad: b.ad, adet: grup.length, tutar, pay: toplam ? tutar / toplam : 0 };
  })
    .filter((b) => b.adet > 0)
    .sort((x, y) => y.tutar - x.tutar);
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
    bentler,
    aylik,
    ekonomikKodlar: [...kodlar.entries()].map(([kod, tutar]) => ({ kod, tutar })).sort((x, y) => y.tutar - x.tutar),
    ortalamaTeklif: arastirmalar.length ? arastirmalar.reduce((s, p) => s + teklifVerenler(p).length, 0) / arastirmalar.length : null,
  };
}

export interface KikSatiri {
  alim: Alim;
  bildirildi: boolean;
  tarih: string | null;
}

// 22/d dışındaki bentler Kurum'a bildirilir; bildirim, dosyadaki "KİK bildirimi" evrakı işaretlenince tamam sayılır.
export function kikBildirimleri(alimlar: Alim[], yil: number, evraklar: Record<string, Record<string, EvrakKaydi>>): KikSatiri[] {
  return yilAlimlari(alimlar, yil)
    .filter((a) => bentBilgisi(a.bent).kikBildirimi)
    .map((a) => {
      const k = evraklar[a.id]?.["kik-bildirimi"];
      return { alim: a, bildirildi: !!k?.tamam, tarih: k?.tamam ? k.tarih : null };
    })
    .sort((x, y) => Number(x.bildirildi) - Number(y.bildirildi) || y.alim.onayTarihi.localeCompare(x.alim.onayTarihi));
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
