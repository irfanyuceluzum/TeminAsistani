import type { Ayarlar } from "../domain/tipler";
import type { Depo } from "./depo";

// Denetim izine kayıt düşer; zaman yerel saatle "YYYY-AA-GGTSS:DD:ss" biçimindedir.
export async function olayKaydet(depo: Depo, ayarlar: Ayarlar, alimId: string, tur: string, aciklama: string): Promise<void> {
  const d = new Date();
  const iki = (n: number) => String(n).padStart(2, "0");
  const zaman = `${d.getFullYear()}-${iki(d.getMonth() + 1)}-${iki(d.getDate())}T${iki(d.getHours())}:${iki(d.getMinutes())}:${iki(d.getSeconds())}`;
  await depo.olayEkle({ alimId, zaman, kim: ayarlar.kullanici?.trim() || "Satın alma birimi", tur, aciklama });
}
