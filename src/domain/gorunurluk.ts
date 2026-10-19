import type { Alim, Bent } from "./tipler";

// Ürün kararı: uygulama yalnız 4734 md. 22/d (doğrudan temin) dosyaları içindir.
// Başka bentlerle açılmış eski kayıtlar veritabanında kalır, silinmez; ancak hiçbir ekranda gösterilmez.
export const UYGULAMA_BENDI: Bent = "22/d";

// Aşamaya bakmaz: iptal edilmiş 22/d dosyaları da görünür. Giriş sırası korunur.
export function gorunurAlimlar(alimlar: Alim[]): Alim[] {
  return alimlar.filter((a) => a.bent === UYGULAMA_BENDI);
}
