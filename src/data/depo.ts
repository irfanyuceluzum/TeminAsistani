import { isTauri } from "@tauri-apps/api/core";
import type { EvrakKaydi, Olay } from "../domain/dosya";
import type { Muayene } from "../domain/muayene";
import type { PiyasaArastirmasi } from "../domain/piyasa";
import type { Alim, Ayarlar, LimitDonemi, Tedarikci } from "../domain/tipler";
import { ornekAlimlar, ornekAyarlar, ornekEvraklar, ornekLimitDonemleri, ornekOlaylar, ornekPiyasa, ornekTedarikciler } from "./ornekVeri";

export type AlimDegisikligi = Partial<Pick<Alim, "asama" | "tutar" | "tedarikciId" | "sonIslem">>;

export interface Depo {
  tur: "sqlite" | "bellek";
  alimlar(): Promise<Alim[]>;
  tedarikciler(): Promise<Tedarikci[]>;
  limitDonemleri(): Promise<LimitDonemi[]>;
  ayarlar(): Promise<Ayarlar>;
  alimEkle(alim: Alim): Promise<void>;
  alimGuncelle(id: string, degisiklik: AlimDegisikligi): Promise<void>;
  tedarikciEkle(t: Tedarikci): Promise<void>;
  piyasaGetir(alimId: string): Promise<PiyasaArastirmasi | null>;
  piyasaKaydet(p: PiyasaArastirmasi): Promise<void>;
  ayarlarKaydet(a: Ayarlar): Promise<void>;
  limitDonemiEkle(d: LimitDonemi): Promise<void>;
  limitDonemiSil(baslangic: string): Promise<void>;
  olaylar(alimId: string): Promise<Olay[]>;
  olayEkle(o: Olay): Promise<void>;
  evraklar(alimId: string): Promise<Record<string, EvrakKaydi>>;
  evrakKaydet(alimId: string, kod: string, kayit: EvrakKaydi): Promise<void>;
  muayeneGetir(alimId: string): Promise<Muayene | null>;
  muayeneKaydet(m: Muayene): Promise<void>;
}

// Tarayıcıda (vite dev, testler) veritabanı yoktur; örnek verilerle bellekte çalışır, kayıtlar sayfa yenilenince kaybolur.
export function bellekDepo(): Depo {
  const alimlar = ornekAlimlar.map((a) => ({ ...a }));
  const tedarikciler = [...ornekTedarikciler];
  const piyasa = new Map(ornekPiyasa.map((p) => [p.alimId, structuredClone(p)]));
  let donemler = ornekLimitDonemleri.map((d) => ({ ...d }));
  let ayarlar = structuredClone(ornekAyarlar);
  const olaylar: Olay[] = ornekOlaylar.map((o, i) => ({ ...o, id: i + 1 }));
  const evraklar: Record<string, Record<string, EvrakKaydi>> = structuredClone(ornekEvraklar);
  const muayeneler = new Map<string, Muayene>();
  return {
    tur: "bellek",
    alimlar: async () => alimlar.map((a) => ({ ...a })),
    tedarikciler: async () => [...tedarikciler].sort((x, y) => x.ad.localeCompare(y.ad, "tr")),
    limitDonemleri: async () => [...donemler].sort((x, y) => x.baslangic.localeCompare(y.baslangic)),
    ayarlar: async () => structuredClone(ayarlar),
    alimEkle: async (alim) => {
      if (alimlar.some((a) => a.id === alim.id)) throw new Error(`${alim.id} numaralı dosya zaten var`);
      alimlar.push(alim);
    },
    alimGuncelle: async (id, d) => {
      const a = alimlar.find((x) => x.id === id);
      if (!a) throw new Error(`${id} numaralı dosya bulunamadı`);
      Object.assign(a, d);
    },
    tedarikciEkle: async (t) => {
      if (tedarikciler.some((x) => x.id === t.id)) throw new Error(`${t.ad} zaten kayıtlı`);
      tedarikciler.push(t);
    },
    piyasaGetir: async (alimId) => {
      const p = piyasa.get(alimId);
      return p ? structuredClone(p) : null;
    },
    piyasaKaydet: async (p) => {
      piyasa.set(p.alimId, structuredClone(p));
    },
    ayarlarKaydet: async (a) => {
      ayarlar = structuredClone(a);
    },
    limitDonemiEkle: async (d) => {
      donemler = [...donemler, { ...d }];
    },
    limitDonemiSil: async (baslangic) => {
      donemler = donemler.filter((d) => d.baslangic !== baslangic);
    },
    olaylar: async (alimId) =>
      olaylar.filter((o) => o.alimId === alimId).sort((x, y) => y.zaman.localeCompare(x.zaman) || (y.id ?? 0) - (x.id ?? 0)),
    olayEkle: async (o) => {
      olaylar.push({ ...o, id: olaylar.length + 1 });
    },
    evraklar: async (alimId) => structuredClone(evraklar[alimId] ?? {}),
    evrakKaydet: async (alimId, kod, kayit) => {
      evraklar[alimId] = { ...(evraklar[alimId] ?? {}), [kod]: { ...kayit } };
    },
    muayeneGetir: async (alimId) => {
      const m = muayeneler.get(alimId);
      return m ? structuredClone(m) : null;
    },
    muayeneKaydet: async (m) => {
      muayeneler.set(m.alimId, structuredClone(m));
    },
  };
}

let acik: Promise<Depo> | null = null;

export function depoAc(): Promise<Depo> {
  if (!acik) {
    acik = isTauri() ? import("./sqliteDepo").then((m) => m.sqliteDepo()) : Promise.resolve(bellekDepo());
  }
  return acik;
}
