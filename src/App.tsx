import { HashRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import { eskiEkranBasamagi } from "./domain/basamaklar";
import { Kabuk } from "./ui/Kabuk";
import { AlimDosyalari } from "./ui/sayfalar/AlimDosyalari";
import { AnaPanel } from "./ui/sayfalar/AnaPanel";
import { DosyaCalismaAlani } from "./ui/sayfalar/DosyaCalismaAlani";
import { DosyaDetay } from "./ui/sayfalar/DosyaDetay";
import { Parametreler } from "./ui/sayfalar/Parametreler";
import { Personel } from "./ui/sayfalar/Personel";
import { Raporlar } from "./ui/sayfalar/Raporlar";
import { Tedarikciler } from "./ui/sayfalar/Tedarikciler";
import { YeniAlim } from "./ui/sayfalar/YeniAlim";
import { useVeri } from "./ui/useVeri";

// Eski tek sayfalık ekran adresleri (yer imleri) ilgili basamağa yönlendirilir.
function EskiEkranYonlendirme({ ekran }: { ekran: "piyasa" | "muayene" | "odeme" }) {
  const { alimId } = useParams();
  return <Navigate to={`/dosyalar/${alimId}/basamak/${eskiEkranBasamagi(ekran)}`} replace />;
}

export default function App() {
  const veri = useVeri();
  return (
    <HashRouter>
      <Routes>
        <Route element={<Kabuk veri={veri} />}>
          <Route index element={<AnaPanel />} />
          <Route path="yeni" element={<YeniAlim />} />
          <Route path="piyasa/:alimId" element={<EskiEkranYonlendirme ekran="piyasa" />} />
          <Route path="muayene/:alimId" element={<EskiEkranYonlendirme ekran="muayene" />} />
          <Route path="odeme/:alimId" element={<EskiEkranYonlendirme ekran="odeme" />} />
          <Route path="dosyalar" element={<AlimDosyalari />} />
          <Route path="dosyalar/:alimId" element={<DosyaCalismaAlani />} />
          <Route path="dosyalar/:alimId/basamak/:no" element={<DosyaCalismaAlani />} />
          <Route path="dosyalar/:alimId/ozet" element={<DosyaDetay />} />
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
