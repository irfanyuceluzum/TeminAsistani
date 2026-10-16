import { isTauri } from "@tauri-apps/api/core";
import type { Alim, Ayarlar, LimitDonemi, Tedarikci } from "../domain/tipler";
import { ornekAlimlar, ornekAyarlar, ornekLimitDonemleri, ornekTedarikciler } from "./ornekVeri";

export interface Depo {
  tur: "sqlite" | "bellek";
  alimlar(): Promise<Alim[]>;
  tedarikciler(): Promise<Tedarikci[]>;
  limitDonemleri(): Promise<LimitDonemi[]>;
  ayarlar(): Promise<Ayarlar>;
}

// Tarayıcıda (vite dev, testler) veritabanı yoktur; örnek verilerle bellekte çalışır.
export function bellekDepo(): Depo {
  return {
    tur: "bellek",
    alimlar: async () => ornekAlimlar,
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
