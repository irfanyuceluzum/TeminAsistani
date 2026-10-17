import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { BasamakBaglami } from "../sayfalar/DosyaCalismaAlani";
import { BelgeOnizleme } from "../BelgeOnizleme";
import { KontrolSatiri } from "../KontrolSatiri";
import { KucukA4 } from "./KucukA4";
import { tasinirIslemFisiSayfalari } from "./belgeler";
import type { Kontrol } from "../../domain/sihirbaz";

export function TasinirBasamagi({ b }: { b: BasamakBaglami }) {
  const navigate = useNavigate();
  const { alim, dosya, veri } = b;
  const { ayarlar } = veri;
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [onizle, setOnizle] = useState(false);

  const [tifNo, setTifNo] = useState("");
  const [tifTarih, setTifTarih] = useState(() => new Date().toISOString().slice(0, 10));

  const kontroller = useMemo((): Kontrol[] => {
    const k: Kontrol[] = [];
    if (!tifNo.trim()) {
      k.push({
        durum: "uyari",
        baslik: "TİF numarası girilmedi",
        detay: "Taşınır Kayıt ve Yönetim Sisteminden (TKYS) alınan TİF numarasını kaydedebilirsiniz.",
      });
    } else {
      k.push({
        durum: "tamam",
        baslik: "Taşınır kaydı yapıldı",
        detay: `${tifNo} numaralı TİF ile kayıt altına alınmıştır.`,
      });
    }
    return k;
  }, [tifNo]);

  const tifSayfalari = useMemo(() => {
    return tasinirIslemFisiSayfalari(
      { alim, ayarlar, dosya, kalemler: b.kalemler },
      { no: tifNo, tarih: tifTarih }
    );
  }, [alim, ayarlar, dosya, b.kalemler, tifNo, tifTarih]);

  const onaylaVeIlerle = async () => {
    setKaydediliyor(true);
    try {
      await b.evrakDegistir("tasinir-fisi", "Taşınır işlem fişi", {
        tamam: true,
        tarih: new Date().toISOString(),
        not: tifNo.trim(),
      });
      navigate(`/dosyalar/${alim.id}/basamak/13`);
    } finally {
      setKaydediliyor(false);
    }
  };

  return (
    <>
      <div className="iki-sutun">
        <section className="panel genis-form" aria-labelledby="tif-baslik">
          <div className="panel-baslik-satiri">
            <div>
              <h2 id="tif-baslik">12. Taşınır İşlem Fişi (TİF)</h2>
              <p className="soluk kucuk">
                Kabulü yapılan dayanıklı taşınır veya tüketim malzemelerinin taşınır sistemine giriş kaydı yapılır.
              </p>
            </div>
          </div>

          <div className="form-izgara" style={{ marginTop: "12px" }}>
            <div className="alan">
              <label htmlFor="tif-no">Taşınır İşlem Fişi (TİF) No</label>
              <input
                id="tif-no"
                type="text"
                value={tifNo}
                onChange={(e) => setTifNo(e.target.value)}
                placeholder="Örn: 2026/045"
              />
            </div>
            <div className="alan">
              <label htmlFor="tif-tarih">TİF Düzenleme Tarihi</label>
              <input
                id="tif-tarih"
                type="date"
                value={tifTarih}
                onChange={(e) => setTifTarih(e.target.value)}
              />
            </div>
          </div>

          <div style={{ marginTop: "16px" }}>
            <h3 style={{ fontSize: "14px", marginBottom: "8px" }}>Kontroller</h3>
            <div className="sutun" style={{ gap: "6px" }}>
              {kontroller.map((k, i) => (
                <KontrolSatiri key={i} k={k} />
              ))}
            </div>
          </div>

          <div className="dugme-grubu" style={{ marginTop: "16px" }}>
            <button
              type="button"
              className="dugme dugme-ana"
              disabled={kaydediliyor}
              onClick={() => void onaylaVeIlerle()}
              style={{ fontSize: "14px", padding: "10px 20px" }}
            >
              {kaydediliyor ? "Kaydediliyor…" : "Taşınır Fişini Onayla ve Sonraki Adıma Geç (13. Ödeme Emri) ›"}
            </button>
            <button
              type="button"
              className="dugme"
              onClick={() => setOnizle(true)}
            >
              Tam ekran önizle ve yazdır
            </button>
          </div>
        </section>

        <section className="panel kucuk-onizleme" aria-labelledby="tif-a4-baslik">
          <div className="panel-baslik-satiri">
            <h2 id="tif-a4-baslik">A4 görünüşü</h2>
            <span className="soluk kucuk">{tifSayfalari.length} sayfa</span>
          </div>
          <KucukA4>{tifSayfalari[0]}</KucukA4>
          <button
            type="button"
            className="dugme dugme-ana"
            onClick={() => setOnizle(true)}
            style={{ width: "100%", marginTop: "10px" }}
          >
            Tam ekran önizle ve yazdır
          </button>
        </section>
      </div>

      {onizle && (
        <BelgeOnizleme
          baslik="Taşınır İşlem Fişi Formu"
          sayfalar={tifSayfalari}
          kapat={() => setOnizle(false)}
        />
      )}
    </>
  );
}
