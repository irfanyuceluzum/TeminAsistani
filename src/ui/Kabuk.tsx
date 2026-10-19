import { useState, type ReactNode } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { NavLink, Outlet } from "react-router-dom";
import { sonYedegeDon } from "../data/yedek";
import type { VeriDurumu } from "./useVeri";

function Ikon({ d }: { d: ReactNode }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d}
    </svg>
  );
}

const MENU: { yol: string; ad: string; ikon: ReactNode }[] = [
  { yol: "/", ad: "Ana panel", ikon: <path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z" /> },
  { yol: "/yeni", ad: "Yeni alım", ikon: <><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></> },
  { yol: "/dosyalar", ad: "Alım dosyaları", ikon: <path d="M3 6h6l2 2h10v11H3z" /> },
  { yol: "/tedarikciler", ad: "Tedarikçiler", ikon: <path d="M4 9h16l-1-5H5zM5 9v11h14V9M9 20v-6h6v6" /> },
  { yol: "/raporlar", ad: "Raporlar", ikon: <path d="M4 20V10M10 20V4M16 20v-8M21 20H3" /> },
  {
    yol: "/personel",
    ad: "Personel ve görevler",
    ikon: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14.8c1.9.7 3.1 2.4 3.5 5.2" /></>,
  },
  {
    yol: "/parametreler",
    ad: "Parametreler",
    ikon: <><path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" /><circle cx="15" cy="6" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="17" cy="18" r="2" /></>,
  },
];

function SonYedegeDonDugmesi() {
  const [calisiyor, setCalisiyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  async function don() {
    setCalisiyor(true);
    setHata(null);
    try {
      await sonYedegeDon();
    } catch (e) {
      setHata(String(e instanceof Error ? e.message : e));
    } finally {
      setCalisiyor(false);
    }
  }

  return (
    <div>
      <p className="kucuk">Veritabanı az önce bir yedekten geri yüklendiyse, geri yüklemeden önceki hâline döndürür; uygulama yeniden başlar.</p>
      <button type="button" className="dugme" disabled={calisiyor} onClick={don}>
        Geri yükleme öncesi verilere dön
      </button>
      {hata && <p>{hata}</p>}
    </div>
  );
}

export function Kabuk({ veri }: { veri: VeriDurumu }) {
  const hazir = veri.durum === "hazir" ? veri.veri : null;
  return (
    <div className="kabuk">
      <nav className="menu" aria-label="Ana menü">
        {/* Arka plan sayfa boyunca uzar; içerik ekrana yapışık kalır (bkz. .menu-ic) */}
        <div className="menu-ic">
          <div className="marka">
            <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
              <rect x="1" y="1" width="26" height="26" rx="7" fill="var(--vurgu)" />
              <path d="M8 14.5l4 4 8-9" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div>
              <div className="marka-ad">Temin Asistanı</div>
              <div className="marka-alt">4734 · Madde 22/d</div>
            </div>
          </div>
          {MENU.map((m) => (
            <NavLink key={m.yol} to={m.yol} end={m.yol === "/"} className="menu-ogesi">
              <Ikon d={m.ikon} />
              {m.ad}
            </NavLink>
          ))}
          <div className="menu-alt">
            <span className="menu-alt-vurgu">{hazir?.ayarlar.idare?.birim || "İdare adı girilmedi"}</span>
            {hazir?.ayarlar.idare?.ustIdare && <span>{hazir.ayarlar.idare.ustIdare}</span>}
            <span>{hazir?.ayarlar.konum === "diger" ? "Büyükşehir dışında" : "Büyükşehir sınırları içinde"}</span>
            {hazir?.depo.tur === "bellek" && <span className="menu-uyari">Örnek veri, tarayıcı önizlemesi</span>}
          </div>
        </div>
      </nav>
      <main className="icerik">
        {veri.durum === "yukleniyor" && <p className="soluk">Veriler yükleniyor…</p>}
        {veri.durum === "hata" && (
          <div className="bant bant-hata" role="alert">
            Veritabanı açılamadı. Uygulamayı yeniden başlatın. Ayrıntı: {veri.mesaj}
            {isTauri() && <SonYedegeDonDugmesi />}
          </div>
        )}
        {hazir && <Outlet context={hazir} />}
      </main>
    </div>
  );
}
