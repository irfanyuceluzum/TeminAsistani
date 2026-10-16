import { isTauri } from "@tauri-apps/api/core";
import type { Alim, Ayarlar, LimitDonemi, Tedarikci } from "../domain/tipler";
import { ornekAlimlar, ornekAyarlar, ornekLimitDonemleri, ornekTedarikciler } from "./ornekVeri";

export interface Depo {
  tur: "sqlite" | "bellek";
  alimlar(): Promise<Alim[]>;
  tedarikciler(): Promise<Tedarikci[]>;
  limitDonemleri(): Promise<LimitDonemi[]>;
  ayarlar(): Promise<Ayarlar>;
  alimEkle(alim: Alim): Promise<void>;
}

// Tarayıcıda (vite dev, testler) veritabanı yoktur; örnek verilerle bellekte çalışır, kayıtlar sayfa yenilenince kaybolur.
export function bellekDepo(): Depo {
  const alimlar = [...ornekAlimlar];
  return {
    tur: "bellek",
    alimlar: async () => [...alimlar],
    alimEkle: async (alim) => {
      if (alimlar.some((a) => a.id === alim.id)) throw new Error(`${alim.id} numaralı dosya zaten var`);
      alimlar.push(alim);
    },
    tedarikciler: async () => ornekTedarikciler,
    limitDonemleri: async () => ornekLimitDonemleri,
    ayarlar: async () => ornekAyarlar,
  };
}

let acik: Promise<Depo> | null = null;

export function depoAc(): Promise<Depo> {
  if (!acik) {
    acik = isTauri() ? import("./sqliteDepo").then((m) => m.sqliteDepo()) : Promise.resolve(bellekDepo());
  }
  return acik;
}
