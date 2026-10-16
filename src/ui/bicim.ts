import type { Asama } from "../domain/tipler";

export function tl(kurus: number): string {
  return "₺" + Math.round(kurus / 100).toLocaleString("tr-TR");
}

export function tlKurus(kurus: number): string {
  return "₺" + (kurus / 100).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function yuzde(oran: number): string {
  return "%" + (oran * 100).toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

const AYLAR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

export function kisaTarih(tarih: string): string {
  return `${Number(tarih.slice(8, 10))} ${AYLAR[Number(tarih.slice(5, 7)) - 1]}`;
}

export function uzunTarih(tarih: string): string {
  return `${tarih.slice(8, 10)}.${tarih.slice(5, 7)}.${tarih.slice(0, 4)}`;
}

export function bugun(): string {
  const d = new Date();
  const iki = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${iki(d.getMonth() + 1)}-${iki(d.getDate())}`;
}

export function gunFarki(sonra: string, once: string): number {
  return Math.round((Date.parse(sonra + "T00:00:00Z") - Date.parse(once + "T00:00:00Z")) / 86_400_000);
}

export const ASAMA_ADI: Record<Asama, string> = {
  ihtiyac: "İhtiyaç",
  dayanak: "Dayanak",
  onay: "Onay belgesi",
  piyasa: "Piyasa araştırması",
  siparis: "Sipariş verildi",
  muayene: "Muayene kabul",
  odeme: "Ödeme bekliyor",
  tamamlandi: "Tamamlandı",
  iptal: "İptal",
};

export type AsamaGrubu = "Hazırlık" | "Teslim" | "Ödeme" | "Kapalı";

export function asamaGrubu(a: Asama): AsamaGrubu {
  if (a === "siparis" || a === "muayene") return "Teslim";
  if (a === "odeme") return "Ödeme";
  if (a === "tamamlandi" || a === "iptal") return "Kapalı";
  return "Hazırlık";
}
