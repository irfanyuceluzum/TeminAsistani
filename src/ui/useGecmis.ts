import { useEffect, useState } from "react";
import { gecmisKalemler, type GecmisKalem } from "../domain/gecmis";
import type { Veri } from "./useVeri";

// Önceki dosyaların kalemleri; açık dosyanın kendi kalemleri öneri olmaz. Yüklenemezse liste boş kalır.
export function useGecmisKalemler(veri: Pick<Veri, "depo" | "alimlar">, haricAlimId?: string): GecmisKalem[] {
  const { depo, alimlar } = veri;
  const [liste, setListe] = useState<GecmisKalem[]>([]);
  useEffect(() => {
    let iptal = false;
    depo
      .tumPiyasa()
      .then((p) => {
        if (!iptal) setListe(gecmisKalemler(p, alimlar, haricAlimId));
      })
      .catch(() => undefined);
    return () => {
      iptal = true;
    };
  }, [depo, alimlar, haricAlimId]);
  return liste;
}
