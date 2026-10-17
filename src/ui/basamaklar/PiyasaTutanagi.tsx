import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { BasamakBaglami } from "../sayfalar/DosyaCalismaAlani";
import { BelgeOnizleme } from "../BelgeOnizleme";
import { KontrolSatiri } from "../KontrolSatiri";
import { KucukA4 } from "./KucukA4";
import { piyasaTutanagiSayfalari } from "./belgeler";
import { degerlendir, type Degerlendirme } from "../../domain/piyasa";
import type { Kontrol } from "../../domain/sihirbaz";
import { yetkiliMi } from "../../domain/personel";

export function PiyasaTutanagiBasamagi({ b }: { b: BasamakBaglami }) {
  const navigate = useNavigate();
  const { alim, piyasa, dosya, veri } = b;
  const { ayarlar, tedarikciler } = veri;
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [onizle, setOnizle] = useState(false);

  const firmaAdi = (id: string) => tedarikciler.find((t) => t.id === id)?.ad || "Bilinmeyen Firma";

  const sonuc = useMemo(() => degerlendir(piyasa), [piyasa]);

  const degerlendirmeDegistir = (tur: Degerlendirme) => {
    const yeni = { ...piyasa, degerlendirme: tur };
    void veri.depo.piyasaKaydet(yeni).then(() => {
      piyasa.degerlendirme = tur;
    });
  };

  const kontroller = useMemo((): Kontrol[] => {
    const k: Kontrol[] = [];
    const g = ayarlar.gorevler;

    if (!sonuc || sonuc.kazananlar.length === 0 || !(sonuc.toplam > 0)) {
      k.push({
        durum: "engel",
        baslik: "En uygun teklif belirlenemedi",
        detay: "6. basamakta firmalardan gelen fiyat tekliflerini eksiksiz girmelisiniz.",
      });
    } else {
      const kazananAd = firmaAdi(sonuc.kazananlar[0]);
      k.push({
        durum: "tamam",
        baslik: "En avantajlı teklif tespit edildi",
        detay: `${kazananAd} tarafından verilen ${(sonuc.toplam / 100).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL + KDV tutarındaki teklif en uygundur.`,
      });
    }

    const piyasadaYetkili = [g?.harcamaYetkilisi, g?.gerceklestirme].filter(
      (id): id is string => !!id && (g?.piyasaGorevlileri ?? []).includes(id)
    );

    if (piyasadaYetkili.length > 0) {
      k.push({
        durum: "engel",
        baslik: "Yetkili piyasa araştırmasında görev alamaz",
        detay: "Harcama Yetkilisi ve Gerçekleştirme Görevlisi 5018 ve 4734 sayılı kanunlar gereği piyasa araştırma komisyonunda yer alamaz.",
      });
    } else {
      k.push({
        durum: "tamam",
        baslik: "Komisyon üyeleri mevzuata uygun",
        detay: "Görev ayrılığı ilkesine uyulmuştur; Harcama Yetkilisi ve Gerçekleştirme Görevlisi komisyonda yer almamaktadır.",
      });
    }

    const gorevliSayisi = (g?.piyasaGorevlileri ?? []).filter((id) => g ? !yetkiliMi(id, g) : true).length;
    if (gorevliSayisi < 2) {
      k.push({
        durum: "uyari",
        baslik: "Görevli sayısı az",
        detay: `Piyasa araştırması şu anda ${gorevliSayisi} görevliyle yürütülüyor. En az 2 görevli atanması önerilir.`,
      });
    }

    return k;
  }, [sonuc, ayarlar.gorevler, tedarikciler]);

  const engelVar = kontroller.some((k) => k.durum === "engel");

  const tutanakSayfalari = useMemo(() => {
    return piyasaTutanagiSayfalari(
      { alim, ayarlar, dosya, kalemler: b.kalemler },
      piyasa,
      firmaAdi
    );
  }, [alim, ayarlar, dosya, b.kalemler, piyasa, tedarikciler]);

  const onaylaVeIlerle = async () => {
    setKaydediliyor(true);
    try {
      const kazananId = sonuc?.kazananlar?.[0] || alim.tedarikciId;
      const toplamTutar = sonuc?.toplam || alim.tutar;

      await b.alimDegistir(
        {
          tedarikciId: kazananId,
          tutar: toplamTutar,
          asama: "siparis",
        },
        "Piyasa fiyat araştırma tutanağı onaylandı, alım sipariş aşamasına geçti."
      );

      await veri.depo.piyasaKaydet({
        ...piyasa,
        tamamlandi: true,
      });

      await b.evrakDegistir("piyasa-tutanagi", "Piyasa fiyat araştırma tutanağı", {
        tamam: true,
        tarih: new Date().toISOString(),
        not: "",
      });

      navigate(`/dosyalar/${alim.id}/basamak/8`);
    } finally {
      setKaydediliyor(false);
    }
  };

  return (
    <>
      <div className="iki-sutun">
        <section className="panel genis-form" aria-labelledby="tutanak-baslik">
          <div className="panel-baslik-satiri">
            <div>
              <h2 id="tutanak-baslik">7. Piyasa Fiyat Araştırması Tutanağı</h2>
              <p className="soluk kucuk">
                Gelen tekliflerin karşılaştırması ve mevzuata uygun görevlilerin kararıyla tutanak düzenlenir.
              </p>
            </div>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <select
                value={piyasa.degerlendirme}
                onChange={(e) => degerlendirmeDegistir(e.target.value as Degerlendirme)}
                className="kucuk"
                style={{ height: "36px", padding: "0 8px" }}
              >
                <option value="toplam">Toplam Tutar Esasına Göre</option>
                <option value="kalem">Kısmi Teklif (Kalem Bazında)</option>
              </select>
            </div>
          </div>

          {sonuc && (
            <div
              style={{
                padding: "12px 16px",
                background: "var(--zemin)",
                borderRadius: "8px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "12px",
              }}
            >
              <div>
                <span className="soluk kucuk">Tespit Edilen En Uygun Teklif:</span>
                <div style={{ fontSize: "16px", fontWeight: "bold" }}>
                  {sonuc.kazananlar.length > 0 ? firmaAdi(sonuc.kazananlar[0]) : "—"}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <span className="soluk kucuk">Teklif Bedeli (KDV Hariç):</span>
                <div className="mono kalin" style={{ fontSize: "18px", color: "var(--vurgu)" }}>
                  {(sonuc.toplam / 100).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL
                </div>
              </div>
            </div>
          )}

          <div style={{ marginTop: "16px" }}>
            <h3 style={{ fontSize: "14px", marginBottom: "8px" }}>Eksik Veri ve Görev Ayrılığı Kontrolleri</h3>
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
              disabled={kaydediliyor || engelVar}
              onClick={() => void onaylaVeIlerle()}
              style={{ fontSize: "14px", padding: "10px 20px" }}
            >
              {kaydediliyor ? "Kaydediliyor…" : "Tutanağı Onayla ve Sonraki Adıma Geç (8. Sipariş Yazısı) ›"}
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

        <section className="panel kucuk-onizleme" aria-labelledby="tutanak-a4-baslik">
          <div className="panel-baslik-satiri">
            <h2 id="tutanak-a4-baslik">A4 görünüşü</h2>
            <span className="soluk kucuk">{tutanakSayfalari.length} sayfa</span>
          </div>
          <KucukA4>{tutanakSayfalari[0]}</KucukA4>
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
          baslik="Piyasa Fiyat Araştırması Tutanağı"
          sayfalar={tutanakSayfalari}
          kapat={() => setOnizle(false)}
        />
      )}
    </>
  );
}
