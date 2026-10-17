import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { BasamakBaglami } from "../sayfalar/DosyaCalismaAlani";
import { BelgeOnizleme } from "../BelgeOnizleme";
import { KontrolSatiri } from "../KontrolSatiri";
import { KucukA4 } from "./KucukA4";
import { odemeEmriBelgesiSayfalari } from "./belgeler";
import type { Kontrol } from "../../domain/sihirbaz";
import { odemeOlustur } from "../../domain/odeme";

export function OdemeBasamagi({ b }: { b: BasamakBaglami }) {
  const navigate = useNavigate();
  const { alim, dosya, odeme, veri } = b;
  const { ayarlar, tedarikciler } = veri;
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [onizle, setOnizle] = useState(false);

  const [oebNo, setOebNo] = useState(odeme?.oebNo || "");

  const firmaAdi = (id: string) => tedarikciler.find((t) => t.id === id)?.ad || "Bilinmeyen Firma";

  const brut = alim.tutar;
  const damga = Math.round((brut * 948) / 100000); // ‰9,48 damga vergisi
  const net = brut - damga;

  const kontroller = useMemo((): Kontrol[] => {
    const k: Kontrol[] = [];
    const g = ayarlar.gorevler;

    if (!g?.harcamaYetkilisi || !g?.gerceklestirme) {
      k.push({
        durum: "engel",
        baslik: "Harcama yetkilisi veya gerçekleştirme görevlisi eksik",
        detay: "Ödeme emri belgesini Gerçekleştirme Görevlisi düzenler, Harcama Yetkilisi onaylar.",
      });
    } else {
      k.push({
        durum: "tamam",
        baslik: "İmza yetkilileri hazır",
        detay: "ÖEB imzacıları mevzuata uygun şekilde tanımlıdır.",
      });
    }

    if (!oebNo.trim()) {
      k.push({
        durum: "uyari",
        baslik: "ÖEB numarası girilmedi",
        detay: "Muhasebe / MYS sisteminden üretilen Ödeme Emri Belgesi numarasını yazabilirsiniz.",
      });
    } else {
      k.push({
        durum: "tamam",
        baslik: "ÖEB numarası kayıtlı",
        detay: `${oebNo} numaralı ÖEB düzenlenmiştir.`,
      });
    }

    return k;
  }, [ayarlar.gorevler, oebNo]);

  const engelVar = kontroller.some((k) => k.durum === "engel");

  const aktifOdeme = useMemo(() => {
    const o = odeme ?? odemeOlustur(alim);
    return {
      ...o,
      oebNo,
    };
  }, [odeme, alim, oebNo]);

  const belgeSayfalari = useMemo(() => {
    return odemeEmriBelgesiSayfalari(
      { alim, ayarlar, dosya, kalemler: b.kalemler },
      aktifOdeme,
      firmaAdi
    );
  }, [alim, ayarlar, dosya, b.kalemler, aktifOdeme, tedarikciler]);

  const tamamla = async () => {
    setKaydediliyor(true);
    try {
      await veri.depo.odemeKaydet({
        ...aktifOdeme,
        tamamlandi: true,
      });

      await b.alimDegistir(
        {
          asama: "tamamlandi",
        },
        "Ödeme emri belgesi onaylandı, doğrudan temin dosyası başarıyla tamamlandı."
      );

      navigate(`/dosyalar/${alim.id}/ozet`);
    } finally {
      setKaydediliyor(false);
    }
  };

  return (
    <>
      <div className="iki-sutun">
        <section className="panel genis-form" aria-labelledby="odeme-baslik">
          <div className="panel-baslik-satiri">
            <div>
              <h2 id="odeme-baslik">13. Ödeme Emri Belgesi (ÖEB) ve Dosya Kapanışı</h2>
              <p className="soluk kucuk">
                Hak sahibine yapılacak ödeme, vergi kesintileri ve Muhasebe Yetkilisine verilecek Ödeme Emri Belgesi hazırlanır.
              </p>
            </div>
          </div>

          <div className="form-izgara" style={{ marginTop: "12px" }}>
            <div className="alan">
              <label htmlFor="oeb-no">Ödeme Emri Belgesi (ÖEB) No</label>
              <input
                id="oeb-no"
                type="text"
                value={oebNo}
                onChange={(e) => setOebNo(e.target.value)}
                placeholder="Örn: 2026/0129"
              />
            </div>
            <div className="alan">
              <span className="etiket-yazi">Damga Vergisi Kesintisi (‰9,48)</span>
              <div className="salt mono">{(damga / 100).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL</div>
            </div>
            <div className="alan">
              <span className="etiket-yazi">Hak Sahibine Net Ödenecek</span>
              <div className="salt mono kalin" style={{ color: "var(--vurgu)", fontSize: "15px" }}>
                {(net / 100).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL
              </div>
            </div>
          </div>

          <div style={{ marginTop: "16px" }}>
            <h3 style={{ fontSize: "14px", marginBottom: "8px" }}>Mali Kontroller ve Onay</h3>
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
              onClick={() => void tamamla()}
              style={{ fontSize: "15px", padding: "12px 24px", background: "var(--basari)", borderColor: "var(--basari)" }}
            >
              {kaydediliyor ? "Kaydediliyor…" : "Ödeme Emrini Onayla ve Doğrudan Temin Dosyasını Tamamla ✓"}
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

        <section className="panel kucuk-onizleme" aria-labelledby="odeme-a4-baslik">
          <div className="panel-baslik-satiri">
            <h2 id="odeme-a4-baslik">A4 görünüşü</h2>
            <span className="soluk kucuk">{belgeSayfalari.length} sayfa</span>
          </div>
          <KucukA4>{belgeSayfalari[0]}</KucukA4>
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
          baslik="Ödeme Emri Belgesi"
          sayfalar={belgeSayfalari}
          kapat={() => setOnizle(false)}
        />
      )}
    </>
  );
}
