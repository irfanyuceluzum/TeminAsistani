// Tarih yardımcıları: tarihler `YYYY-AA-GG` metnidir; gün farkı UTC gece yarısına göre hesaplanır.

export const AY_KISA = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
export const AY_UZUN = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

export function gunFarki(sonra: string, once: string): number {
  return Math.round((Date.parse(sonra + "T00:00:00Z") - Date.parse(once + "T00:00:00Z")) / 86_400_000);
}

// "YYYY-AA-GG" → "GG.AA.YYYY". Eski kayıtlardaki zaman damgası (T… eki) atılır; boş girdi boş döner.
export function gunYaz(tarih: string): string {
  if (!tarih) return "";
  return tarih.slice(0, 10).split("-").reverse().join(".");
}
