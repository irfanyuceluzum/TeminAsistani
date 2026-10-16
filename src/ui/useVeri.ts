import { useCallback, useEffect, useState } from "react";
import { depoAc, type Depo } from "../data/depo";
import type { Alim, Ayarlar, LimitDonemi, Tedarikci } from "../domain/tipler";

export interface Veri {
  depo: Depo;
  alimlar: Alim[];
  tedarikciler: Tedarikci[];
  limitDonemleri: LimitDonemi[];
  ayarlar: Ayarlar;
  yenile: () => Promise<void>;
}

export type VeriDurumu = { durum: "yukleniyor" } | { durum: "hata"; mesaj: string } | { durum: "hazir"; veri: Veri };

export function useVeri(): VeriDurumu {
  const [sonuc, setSonuc] = useState<VeriDurumu>({ durum: "yukleniyor" });

  const yukle = useCallback(async (): Promise<void> => {
    try {
      const depo = await depoAc();
      const [alimlar, tedarikciler, limitDonemleri, ayarlar] = await Promise.all([
        depo.alimlar(),
        depo.tedarikciler(),
        depo.limitDonemleri(),
        depo.ayarlar(),
      ]);
      setSonuc({ durum: "hazir", veri: { depo, alimlar, tedarikciler, limitDonemleri, ayarlar, yenile: yukle } });
    } catch (e) {
      setSonuc({ durum: "hata", mesaj: String(e) });
    }
  }, []);

  useEffect(() => {
    void yukle();
  }, [yukle]);

  return sonuc;
}
