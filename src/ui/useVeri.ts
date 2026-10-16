import { useEffect, useState } from "react";
import { depoAc, type Depo } from "../data/depo";
import type { Alim, Ayarlar, LimitDonemi, Tedarikci } from "../domain/tipler";

export interface Veri {
  depoTuru: Depo["tur"];
  alimlar: Alim[];
  tedarikciler: Tedarikci[];
  limitDonemleri: LimitDonemi[];
  ayarlar: Ayarlar;
}

export type VeriDurumu = { durum: "yukleniyor" } | { durum: "hata"; mesaj: string } | { durum: "hazir"; veri: Veri };

export function useVeri(): VeriDurumu {
  const [sonuc, setSonuc] = useState<VeriDurumu>({ durum: "yukleniyor" });
  useEffect(() => {
    let iptal = false;
    (async () => {
      try {
        const depo = await depoAc();
        const [alimlar, tedarikciler, limitDonemleri, ayarlar] = await Promise.all([
          depo.alimlar(),
          depo.tedarikciler(),
          depo.limitDonemleri(),
          depo.ayarlar(),
        ]);
        if (!iptal) setSonuc({ durum: "hazir", veri: { depoTuru: depo.tur, alimlar, tedarikciler, limitDonemleri, ayarlar } });
      } catch (e) {
        if (!iptal) setSonuc({ durum: "hata", mesaj: String(e) });
      }
    })();
    return () => {
      iptal = true;
    };
  }, []);
  return sonuc;
}
