import type { Asama } from "../domain/tipler";

export { tl, tlKurus, yuzde, tutarMetni, belgeTutari, tutarGirdisi, bosIse, BOS_DEGER, binde } from "../domain/bicim";

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

// Yedek geri yükleme onayında gösterilen dosya adı; hem / hem \ ayracını tanır.
export function yolDosyaAdi(yol: string): string {
  const parcalar = yol.split(/[\\/]/);
  return parcalar[parcalar.length - 1] || yol;
}

export function yedekOzeti(alimSayisi: number, tedarikciSayisi: number): string {
  return `${alimSayisi.toLocaleString("tr-TR")} alım dosyası, ${tedarikciSayisi.toLocaleString("tr-TR")} tedarikçi`;
}

// Yazdırma penceresinin önerdiği PDF adı: "DT-2026-041 Onay belgesi". Başlıktaki dosya numarası öne alınır;
// Windows'ta dosya adında geçemeyen karakterler (\ / : * ? " < > |) tireye döner, sondaki nokta ve boşluk atılır.
export function pdfDosyaAdi(baslik: string, dosyaNo?: string): string {
  let ad = baslik;
  if (dosyaNo) ad = ad.split(` · ${dosyaNo}`).join("").split(dosyaNo).join("");
  ad = ad
    .replace(/\s*[\\/:*?"<>|][\\/:*?"<>|\s]*/g, " - ")
    .replace(/\s+/g, " ")
    .replace(/^[\s·-]+|[\s·.-]+$/g, "");
  const tam = [dosyaNo, ad].filter(Boolean).join(" ");
  return tam || "Belge";
}
