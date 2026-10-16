import type { Kontrol } from "../domain/sihirbaz";

const ISARET = { tamam: "✓", uyari: "!", engel: "×", yapilacak: "·" } as const;

export function KontrolSatiri({ k }: { k: Kontrol }) {
  return (
    <div className={`kontrol kontrol-${k.durum}`}>
      <span className="kontrol-isaret" aria-hidden="true">
        {ISARET[k.durum]}
      </span>
      <div>
        <div className="kontrol-baslik">{k.baslik}</div>
        <div className="kontrol-detay">{k.detay}</div>
      </div>
    </div>
  );
}
