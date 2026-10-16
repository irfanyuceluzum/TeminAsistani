import { HashRouter, Route, Routes } from "react-router-dom";
import { Kabuk } from "./ui/Kabuk";
import { AnaPanel } from "./ui/sayfalar/AnaPanel";
import { Parametreler } from "./ui/sayfalar/Parametreler";
import { Yakinda } from "./ui/sayfalar/Yakinda";
import { useVeri } from "./ui/useVeri";

export default function App() {
  const veri = useVeri();
  return (
    <HashRouter>
      <Routes>
        <Route element={<Kabuk veri={veri} />}>
          <Route index element={<AnaPanel />} />
          <Route path="yeni" element={<Yakinda baslik="Yeni alım" aciklama="Dayanak seçimi, onay belgesi ve canlı kontroller." />} />
          <Route path="dosyalar" element={<Yakinda baslik="Alım dosyaları" aciklama="Süreç, evrak listesi ve denetim izi." />} />
          <Route path="tedarikciler" element={<Yakinda baslik="Tedarikçiler" aciklama="Firma kartları, geçmiş teklifler ve yasaklılık sorguları." />} />
          <Route path="raporlar" element={<Yakinda baslik="Raporlar" aciklama="Yıllık liste, KİK bildirimleri ve harcama dağılımı." />} />
          <Route path="parametreler" element={<Parametreler />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
