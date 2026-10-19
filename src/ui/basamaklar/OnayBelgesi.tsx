import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { makamBasligi, onayBelgesiKontrolleri } from "../../domain/basamaklar";
import { butceTertibi } from "../../domain/parametreler";
import { engelVarMi } from "../../domain/sihirbaz";
import { bugun, tl } from "../bicim";
import { BelgeOnizleme } from "../BelgeOnizleme";
import { KontrolSatiri } from "../KontrolSatiri";
import type { BasamakBaglami } from "../sayfalar/DosyaCalismaAlani";
import { dogrudanTeminOnaySayfalari } from "./belgeler";
import { KucukA4 } from "./KucukA4";

export function OnayBelgesiBasamagi({ b }: { b: BasamakBaglami }) {
  const { alim, piyasa, dosya, dosyaDegistir, evraklar } = b;
  const { ayarlar } = b.veri;
  const navigate = useNavigate();

  const kod = "onay-belgesi";
  const evrak = evraklar[kod];
  const tamam = !!evrak?.tamam;

  const [tarih, setTarih] = useState(evrak?.tarih || alim.onayTarihi || bugun());
  const [sayi, setSayi] = useState(evrak?.not ?? "");
  const [ekapNo, setEkapNo] = useState(alim.ekapKayitNo ?? "");
  const varsayilanMakam = makamBasligi(ayarlar.idare?.birim ?? "");
  const [makam, setMakam] = useState(dosya.onayBelgesi?.makam || varsayilanMakam);
  const [onizle, setOnizle] = useState(false);
  const [onaylaniyor, setOnaylaniyor] = useState(false);
  const [mesaj, setMesaj] = useState("");

  const kontroller = useMemo(
    // Yazılmakta olan EKAP numarası da kontrollerde hesaba katılır
    () => onayBelgesiKontrolleri({ ...alim, ekapKayitNo: ekapNo.trim() || undefined }, dosya, ayarlar, piyasa),
    [alim, ekapNo, dosya, ayarlar, piyasa],
  );
  const engelVar = engelVarMi(kontroller);

  const belge = useMemo(() => ({ alim: { ...alim, ekapKayitNo: ekapNo.trim() || undefined }, ayarlar, dosya, kalemler: piyasa.kalemler }), [alim, ekapNo, ayarlar, dosya, piyasa.kalemler]);
  const sayfalar = useMemo(
    () => dogrudanTeminOnaySayfalari(belge, { makam, sayi, tarih }),
    [belge, makam, sayi, tarih],
  );

  async function onayla() {
    setMesaj("");
    if (engelVar) {
      setMesaj("Kırmızı işaretli engeller çözülmeden onay belgesi onaylanamaz.");
      return;
    }
    setOnaylaniyor(true);
    try {
      // EKAP numarası güncellendiyse alım kaydına yaz
      if (ekapNo.trim() !== (alim.ekapKayitNo ?? "")) {
        await b.alimDegistir({ ekapKayitNo: ekapNo.trim() || undefined }, "EKAP kayıt numarası güncellendi");
      }
      // Makam başlığı güncellendiyse dosya basamaklarına yaz
      if (makam !== (dosya.onayBelgesi?.makam || varsayilanMakam)) {
        dosyaDegistir((d) => ({
          ...d,
          onayBelgesi: { ...d.onayBelgesi, makam },
        }));
      }

      // Onay belgesi evrakını tamamla
      await b.evrakDegistir(kod, "Doğrudan temin onay belgesi", {
        tamam: true,
        tarih,
        not: sayi.trim(),
      });

      // Aşamayı piyasa araştırmasına geçir
      if (alim.asama === "onay" || alim.asama === "ihtiyac") {
        await b.alimDegistir({ asama: "piyasa", sonIslem: bugun() }, "Doğrudan temin onay belgesi onaylandı");
      }

      // Sonraki basamağa yönlendir (6. basamak)
      const sonrakiNo = b.basamak.no + 1;
      navigate(`/dosyalar/${alim.id}/basamak/${sonrakiNo}`);
    } catch (e) {
      setMesaj(`Onay kaydedilemedi: ${String(e)}`);
    } finally {
      setOnaylaniyor(false);
    }
  }

  async function onayiGeriAl() {
    setMesaj("");
    setOnaylaniyor(true);
    try {
      await b.evrakDegistir(kod, "Doğrudan temin onay belgesi", {
        tamam: false,
        tarih,
        not: sayi.trim(),
      });
    } catch (e) {
      setMesaj(`İşlem geri alınamadı: ${String(e)}`);
    } finally {
      setOnaylaniyor(false);
    }
  }

  return (
    <>
      <div className="iki-sutun">
        <section className="panel genis-form" aria-labelledby="onay-belge-baslik">
          <div className="panel-baslik-satiri">
            <div>
              <h2 id="onay-belge-baslik">5. Doğrudan temin onay belgesi</h2>
              <p className="soluk kucuk">
                Şimdiye kadar girilen tüm verilerle (idare, işin adı, yaklaşık maliyet, ödenek, bütçe tertibi ve görevliler) otomatik olarak oluşturulur.
              </p>
            </div>
            <span className={`durum-rozeti ${tamam ? "durum-tamam" : ""}`}>
              {tamam ? "Onaylandı" : "Onay bekliyor"}
            </span>
          </div>

          {mesaj && (
            <div className="bant bant-hata" role="alert">
              {mesaj}
            </div>
          )}

          <div className="form-izgara">
            <div className="alan">
              <label htmlFor="onay-tarihi">Belge tarihi</label>
              <input
                id="onay-tarihi"
                type="date"
                value={tarih}
                onChange={(e) => setTarih(e.target.value)}
              />
            </div>
            <div className="alan">
              <label htmlFor="onay-sayisi">Onay belgesi sayısı</label>
              <input
                id="onay-sayisi"
                className="mono"
                value={sayi}
                onChange={(e) => setSayi(e.target.value)}
                placeholder="E-12345678-934-55"
              />
            </div>
            <div className="alan">
              <label htmlFor="ekap-no">EKAP doğrudan temin kayıt no</label>
              <input
                id="ekap-no"
                className="mono"
                value={ekapNo}
                onChange={(e) => setEkapNo(e.target.value)}
                placeholder="26DT123456"
              />
            </div>
            <div className="alan">
              <label htmlFor="makam-adi">Makam başlığı</label>
              <input
                id="makam-adi"
                value={makam}
                onChange={(e) => setMakam(e.target.value)}
                placeholder={varsayilanMakam}
              />
            </div>
          </div>

          <div className="kutu">
            <div className="anahtar-deger">
              <span>Yaklaşık maliyet tutarı</span>
              <span className="kalin">{dosya.yaklasik.hesaplanmayacak ? "Hesaplanmayacak" : `${tl(alim.tutar)} (KDV Hariç)`}</span>
            </div>
            <div className="anahtar-deger">
              <span>Kullanılabilir ödenek</span>
              <span className="kalin">{dosya.odenek > 0 ? tl(dosya.odenek) : "Girilmemiş"}</span>
            </div>
            <div className="anahtar-deger">
              <span>Bütçe tertibi</span>
              <span>{alim.ekonomikKod ? butceTertibi(ayarlar, alim.ekonomikKod) : "Seçilmemiş"}</span>
            </div>
            <div className="anahtar-deger">
              <span>Alım usulü ve dayanak</span>
              <span>4734 Sayılı Kanun Madde {alim.bent}</span>
            </div>
          </div>

          <div className="dugme-grubu" style={{ marginTop: "12px" }}>
            {tamam ? (
              <>
                <button
                  type="button"
                  className="dugme dugme-ana"
                  onClick={() => navigate(`/dosyalar/${alim.id}/basamak/${b.basamak.no + 1}`)}
                >
                  Sonraki basamağa geç ›
                </button>
                <button
                  type="button"
                  className="dugme"
                  disabled={onaylaniyor}
                  onClick={onayiGeriAl}
                >
                  Onayı geri al
                </button>
              </>
            ) : (
              <button
                type="button"
                className="dugme dugme-ana"
                disabled={onaylaniyor || engelVar}
                onClick={onayla}
                title={engelVar ? "Engelleri giderdikten sonra onaylayabilirsiniz" : undefined}
              >
                Onay belgesini onayla ve sonraki basamağa geç ›
              </button>
            )}
            <button
              type="button"
              className="dugme"
              onClick={() => setOnizle(true)}
            >
              Tam ekran önizle ve yazdır
            </button>
          </div>
        </section>

        <section className="panel kucuk-onizleme" aria-labelledby="onay-a4-baslik">
          <div className="panel-baslik-satiri">
            <h2 id="onay-a4-baslik">A4 görünüşü</h2>
            <span className="soluk kucuk">{sayfalar.length} sayfa</span>
          </div>
          <KucukA4>{sayfalar[0]}</KucukA4>
          <button
            type="button"
            className="dugme dugme-ana"
            onClick={() => setOnizle(true)}
            style={{ marginTop: "12px", width: "100%" }}
          >
            Yazdır / PDF görüntüle
          </button>
          <p className="soluk kucuk" style={{ textAlign: "center", marginTop: "6px" }}>
            Resmî standart Doğrudan Temin Onay Belgesi formatı
          </p>
        </section>
      </div>

      <section className="panel" aria-labelledby="kontrol-baslik" aria-live="polite">
        <div className="panel-baslik-satiri">
          <h2 id="kontrol-baslik">Eksik veri uyarıları ve kontroller</h2>
          <span className="soluk kucuk">
            {kontroller.filter((k) => k.durum === "tamam").length} / {kontroller.length} tamam
          </span>
        </div>
        <p className="soluk kucuk" style={{ margin: "0 0 10px 0" }}>
          Onay belgesinde yer alacak verilerin eksikliği aşağıda listelenir. Kırmızı işaretli engeller giderilmeden belge onaylanamaz.
        </p>
        <div className="sutun" style={{ gap: "8px" }}>
          {kontroller.map((k) => (
            <KontrolSatiri key={k.baslik} k={k} />
          ))}
        </div>
      </section>

      {onizle && (
        <BelgeOnizleme
          baslik={`Doğrudan temin onay belgesi · ${alim.id}`}
          sayfalar={sayfalar}
          kapat={() => setOnizle(false)}
        />
      )}
    </>
  );
}
