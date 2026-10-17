import { HashRouter, Route, Routes } from "react-router-dom";
import { Kabuk } from "./ui/Kabuk";
import { AlimDosyalari } from "./ui/sayfalar/AlimDosyalari";
import { AnaPanel } from "./ui/sayfalar/AnaPanel";
import { DosyaDetay } from "./ui/sayfalar/DosyaDetay";
import { MuayeneKabul } from "./ui/sayfalar/MuayeneKabul";
import { OdemeSayfasi } from "./ui/sayfalar/Odeme";
import { Parametreler } from "./ui/sayfalar/Parametreler";
import { Personel } from "./ui/sayfalar/Personel";
import { PiyasaArastirmasiSayfasi } from "./ui/sayfalar/PiyasaArastirmasi";
import { Raporlar } from "./ui/sayfalar/Raporlar";
import { Tedarikciler } from "./ui/sayfalar/Tedarikciler";
import { YeniAlim } from "./ui/sayfalar/YeniAlim";
import { useVeri } from "./ui/useVeri";

export default function App() {
  const veri = useVeri();
  return (
    <HashRouter>
      <Routes>
        <Route element={<Kabuk veri={veri} />}>
          <Route index element={<AnaPanel />} />
          <Route path="yeni" element={<YeniAlim />} />
          <Route path="piyasa/:alimId" element={<PiyasaArastirmasiSayfasi />} />
          <Route path="muayene/:alimId" element={<MuayeneKabul />} />
          <Route path="odeme/:alimId" element={<OdemeSayfasi />} />
          <Route path="dosyalar" element={<AlimDosyalari />} />
          <Route path="dosyalar/:alimId" element={<DosyaDetay />} />
          <Route path="tedarikciler" element={<Tedarikciler />} />
          <Route path="tedarikciler/:tedarikciId" element={<Tedarikciler />} />
          <Route path="raporlar" element={<Raporlar />} />
          <Route path="personel" element={<Personel />} />
          <Route path="parametreler" element={<Parametreler />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
