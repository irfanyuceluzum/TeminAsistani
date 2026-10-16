import { HashRouter, Route, Routes } from "react-router-dom";
import { Kabuk } from "./ui/Kabuk";
import { AnaPanel } from "./ui/sayfalar/AnaPanel";
import { Parametreler } from "./ui/sayfalar/Parametreler";
import { PiyasaArastirmasiSayfasi } from "./ui/sayfalar/PiyasaArastirmasi";
import { Yakinda } from "./ui/sayfalar/Yakinda";
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
          <Route path="dosyalar" element={<Yakinda baslik="Alım dosyaları" aciklama="Süreç, evrak listesi ve denetim izi." />} />
          <Route path="tedarikciler" element={<Yakinda baslik="Tedarikçiler" aciklama="Firma kartları, geçmiş teklifler ve yasaklılık sorguları." />} />
          <Route path="raporlar" element={<Yakinda baslik="Raporlar" aciklama="Yıllık liste, KİK bildirimleri ve harcama dağılımı." />} />
          <Route path="parametreler" element={<Parametreler />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
