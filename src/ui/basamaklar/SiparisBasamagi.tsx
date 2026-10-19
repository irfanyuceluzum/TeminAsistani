import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { BasamakBaglami } from "../sayfalar/DosyaCalismaAlani";
import { BelgeOnizleme } from "../BelgeOnizleme";
import { KontrolSatiri } from "../KontrolSatiri";
import { KucukA4 } from "./KucukA4";
import { siparisYazisiSayfalari } from "./belgeler";
import type { Kontrol } from "../../domain/sihirbaz";
import { evrakFormu, evrakKaydiYap } from "../../domain/basamaklar";
import { bugun, tlKurus } from "../bicim";

export function SiparisBasamagi({ b }: { b: BasamakBaglami }) {
  const navigate = useNavigate();
  const { alim, dosya, veri } = b;
  const { ayarlar, tedarikciler } = veri;
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [onizle, setOnizle] = useState(false);

  // Kayıtlı sipariş yazısı varsa sayısı ve tarihi geri yüklenir
  const [ilkForm] = useState(() => evrakFormu(b.evraklar["siparis-yazisi"], bugun()));
  const [siparisSayi, setSiparisSayi] = useState(ilkForm.sayi);
  const [siparisTarih, setSiparisTarih] = useState(ilkForm.tarih);
  const [mesaj, setMesaj] = useState("");

  const yuklenici = useMemo(() => {
    return tedarikciler.find((t) => t.id === alim.tedarikciId) ?? null;
  }, [tedarikciler, alim.tedarikciId]);

  const kontroller = useMemo((): Kontrol[] => {
    const k: Kontrol[] = [];
    if (!yuklenici) {
      k.push({
        durum: "engel",
        baslik: "Yüklenici firma seçilmemiş",
        detay: "7. basamakta piyasa fiyat araştırma tutanağını onaylayarak kazanan firmayı belirleyin.",
      });
    } else {
      k.push({
        durum: "tamam",
        baslik: "Yüklenici firma belirlendi",
        detay: `Sipariş ${yuklenici.ad} adına düzenlenecektir.`,
      });
    }

    if (!dosya.teslimYeri) {
      k.push({
        durum: "uyari",
        baslik: "Teslim yeri belirtilmemiş",
        detay: "1. basamakta teslim yerini belirtebilirsiniz. Varsayılan olarak idare merkezi alınır.",
      });
    }

    if (!ayarlar.gorevler?.harcamaYetkilisi) {
      k.push({
        durum: "engel",
        baslik: "Harcama Yetkilisi seçilmemiş",
        detay: "Sipariş mektubunu Harcama Yetkilisi imzalar.",
      });
    } else {
      k.push({
        durum: "tamam",
        baslik: "Harcama Yetkilisi hazır",
        detay: "Sipariş onay yetkilisi tanımlıdır.",
      });
    }

    return k;
  }, [yuklenici, dosya.teslimYeri, ayarlar.gorevler]);

  const engelVar = kontroller.some((k) => k.durum === "engel");

  const siparisSayfalari = useMemo(() => {
    return siparisYazisiSayfalari(
      { alim, ayarlar, dosya, kalemler: b.kalemler },
      yuklenici,
      alim.tutar,
      { sayi: siparisSayi, tarih: siparisTarih }
    );
  }, [alim, ayarlar, dosya, b.kalemler, yuklenici, siparisSayi, siparisTarih]);

  const onaylaVeIlerle = async () => {
    setMesaj("");
    let kayit;
    try {
      kayit = evrakKaydiYap({ tarih: siparisTarih, sayi: siparisSayi });
    } catch (e) {
      setMesaj((e as Error).message);
      return;
    }
    setKaydediliyor(true);
    try {
      await b.evrakDegistir("siparis-yazisi", "Sipariş yazısı", kayit);
      navigate(`/dosyalar/${alim.id}/basamak/9`);
    } finally {
      setKaydediliyor(false);
    }
  };

  return (
    <>
      <div className="iki-sutun">
        <section className="panel genis-form" aria-labelledby="siparis-baslik">
          <div className="panel-baslik-satiri">
            <div>
              <h2 id="siparis-baslik">8. Sipariş Yazısı / Sipariş Mektubu</h2>
              <p className="soluk kucuk">
                Teklifi en uygun bulunan yüklenici firmaya hitaben sipariş yazısı ve teslimat şartları hazırlanır.
              </p>
            </div>
          </div>

          <div className="form-izgara" style={{ marginTop: "12px" }}>
            <div className="alan">
              <label htmlFor="siparis-sayi">Sipariş Yazısı Sayısı</label>
              <input
                id="siparis-sayi"
                type="text"
                value={siparisSayi}
                onChange={(e) => setSiparisSayi(e.target.value)}
                placeholder="Örn: E-12345678-900-123"
              />
            </div>
            <div className="alan">
              <label htmlFor="siparis-tarih">Yazı Tarihi</label>
              <input
                id="siparis-tarih"
                type="date"
                value={siparisTarih}
                onChange={(e) => setSiparisTarih(e.target.value)}
              />
            </div>
            <div className="alan">
              <span className="etiket-yazi">Yüklenici Firma</span>
              <div className="salt kalin">{yuklenici?.ad || "Belirlenmedi"}</div>
            </div>
            <div className="alan">
              <span className="etiket-yazi">Sipariş Tutarı (KDV Hariç)</span>
              <div className="salt mono kalin">
                {tlKurus(alim.tutar)}
              </div>
            </div>
          </div>

          <div style={{ marginTop: "16px" }}>
            <h3 style={{ fontSize: "14px", marginBottom: "8px" }}>Kontroller ve Uyarılar</h3>
            <div className="sutun" style={{ gap: "6px" }}>
              {kontroller.map((k, i) => (
                <KontrolSatiri key={i} k={k} />
              ))}
            </div>
          </div>

          {mesaj && (
            <div className="bant bant-hata" role="alert" style={{ marginTop: "12px" }}>
              {mesaj}
            </div>
          )}

          <div className="dugme-grubu" style={{ marginTop: "16px" }}>
            <button
              type="button"
              className="dugme dugme-ana"
              disabled={kaydediliyor || engelVar}
              onClick={() => void onaylaVeIlerle()}
              style={{ fontSize: "14px", padding: "10px 20px" }}
            >
              {kaydediliyor ? "Kaydediliyor…" : "Siparişi Onayla ve Sonraki Adıma Geç (9. Muayene Talebi) ›"}
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

        <section className="panel kucuk-onizleme" aria-labelledby="siparis-a4-baslik">
          <div className="panel-baslik-satiri">
            <h2 id="siparis-a4-baslik">A4 görünüşü</h2>
            <span className="soluk kucuk">{siparisSayfalari.length} sayfa</span>
          </div>
          <KucukA4>{siparisSayfalari[0]}</KucukA4>
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
          baslik="Sipariş Mektubu ve Şartlar"
          sayfalar={siparisSayfalari}
          kapat={() => setOnizle(false)}
        />
      )}
    </>
  );
}
