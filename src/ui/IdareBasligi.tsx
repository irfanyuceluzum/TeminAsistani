import { idareSatirlari } from "../domain/personel";
import type { Ayarlar } from "../domain/tipler";

// Tüm belgelerin üst başlığı: T.C. / ÜST İDARE / Birim
export function IdareBasligi({ ayarlar }: { ayarlar: Ayarlar }) {
  const { ust, birim } = idareSatirlari(ayarlar);
  return (
    <div className="belge-ust">
      <span>T.C.</span>
      <span>{ust}</span>
      <span className="normal">{birim}</span>
    </div>
  );
}
