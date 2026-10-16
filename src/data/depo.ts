import { isTauri } from "@tauri-apps/api/core";
import type { PiyasaArastirmasi } from "../domain/piyasa";
import type { Alim, Ayarlar, LimitDonemi, Tedarikci } from "../domain/tipler";
import { ornekAlimlar, ornekAyarlar, ornekLimitDonemleri, ornekPiyasa, ornekTedarikciler } from "./ornekVeri";

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
}

// Tarayıcıda (vite dev, testler) veritabanı yoktur; örnek verilerle bellekte çalışır, kayıtlar sayfa yenilenince kaybolur.
export function bellekDepo(): Depo {
  const alimlar = ornekAlimlar.map((a) => ({ ...a }));
  const tedarikciler = [...ornekTedarikciler];
  const piyasa = new Map(ornekPiyasa.map((p) => [p.alimId, structuredClone(p)]));
  return {
    tur: "bellek",
    alimlar: async () => alimlar.map((a) => ({ ...a })),
    tedarikciler: async () => [...tedarikciler].sort((x, y) => x.ad.localeCompare(y.ad, "tr")),
    limitDonemleri: async () => ornekLimitDonemleri,
    ayarlar: async () => ornekAyarlar,
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
  };
}

let acik: Promise<Depo> | null = null;

export function depoAc(): Promise<Depo> {
  if (!acik) {
    acik = isTauri() ? import("./sqliteDepo").then((m) => m.sqliteDepo()) : Promise.resolve(bellekDepo());
  }
  return acik;
}
