import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { BasamakBaglami } from "../sayfalar/DosyaCalismaAlani";
import { BelgeOnizleme } from "../BelgeOnizleme";
import { KontrolSatiri } from "../KontrolSatiri";
import { kapakVeDizinSayfalari } from "./belgeler";
import { dizinSatirlari, kontrolOzeti } from "../../domain/kapanis";
import { evrakFormu, evrakKaydiYap } from "../../domain/basamaklar";
import type { EvrakKaydi } from "../../domain/dosya";
import { bugun, uzunTarih } from "../bicim";

// 12. basamak: kapanış engelleri ve uyarıları, TKYS/MYS belgelerinin sayı ve tarihi, KİK işareti, kapak ve dizin, dosyayı kapatma.
export function KontrolBasamagi({ b }: { b: BasamakBaglami }) {
  const { alim, dosya, veri, evraklar } = b;
  const { ayarlar, tedarikciler } = veri;
  const [onizle, setOnizle] = useState(false);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [mesaj, setMesaj] = useState("");

  // Dış sistem belgeleri: kayıt yoksa alanlar boş başlar (bugünün tarihi dayatılmaz).
  const [tifSayi, setTifSayi] = useState(() => evrakFormu(evraklar["tasinir-fisi"], "").sayi);
  const [tifTarih, setTifTarih] = useState(() => evrakFormu(evraklar["tasinir-fisi"], "").tarih);
  const [oebSayi, setOebSayi] = useState(() => evrakFormu(evraklar["odeme-emri"], "").sayi);
  const [oebTarih, setOebTarih] = useState(() => evrakFormu(evraklar["odeme-emri"], "").tarih);
  const [kikYapildi, setKikYapildi] = useState(() => !!evraklar["kik-bildirimi"]?.tamam);
  const [kikTarih, setKikTarih] = useState(() => (evraklar["kik-bildirimi"]?.tamam ? evrakFormu(evraklar["kik-bildirimi"], "").tarih : ""));

  const kapali = alim.asama === "tamamlandi";
  const bugunTarih = bugun();

  const girdi = useMemo(
    () => ({ alim, piyasa: b.piyasa, dosya, evraklar, muayene: b.muayene, bugun: bugunTarih }),
    [alim, b.piyasa, dosya, evraklar, b.muayene, bugunTarih],
  );
  const ozet = useMemo(() => kontrolOzeti(girdi), [girdi]);
  const satirlar = useMemo(() => dizinSatirlari(girdi), [girdi]);
  const yuklenici = tedarikciler.find((t) => t.id === alim.tedarikciId) ?? null;
  const kapanisTarihi = evraklar["dosya-kapanisi"]?.tarih ? evraklar["dosya-kapanisi"].tarih.slice(0, 10) : kapali ? alim.sonIslem : null;

  const sayfalar = useMemo(
    () => kapakVeDizinSayfalari({ alim, ayarlar, dosya, kalemler: b.kalemler }, satirlar, yuklenici, kapanisTarihi),
    [alim, ayarlar, dosya, b.kalemler, satirlar, yuklenici, kapanisTarihi],
  );

  const yol = (baslik: string) => {
    const m = /^(\d+)\. basamak tamamlanmadı/.exec(baslik);
    return m ? `/dosyalar/${alim.id}/basamak/${m[1]}` : null;
  };

  // Sayı ve tarihin ikisi de boşsa kayıt yazılmaz (mevcut kayıt silinmez, yeni kayıt zorlanmaz).
  const disBelgeKaydi = (mevcut: EvrakKaydi | undefined, sayi: string, tarih: string): EvrakKaydi | null => {
    if (!sayi.trim() && !tarih) return null;
    const kayit = evrakKaydiYap({ sayi, tarih });
    if (mevcut?.tamam && mevcut.tarih.slice(0, 10) === kayit.tarih && (mevcut.not ?? "") === kayit.not) return null;
    return kayit;
  };

  const kaydet = async () => {
    setMesaj("");
    const yazilacak: [string, string, EvrakKaydi][] = [];
    try {
      const tif = disBelgeKaydi(evraklar["tasinir-fisi"], tifSayi, tifTarih);
      if (tif) yazilacak.push(["tasinir-fisi", "Taşınır işlem fişi", tif]);
      const oeb = disBelgeKaydi(evraklar["odeme-emri"], oebSayi, oebTarih);
      if (oeb) yazilacak.push(["odeme-emri", "Ödeme emri belgesi", oeb]);
      const kik = evraklar["kik-bildirimi"];
      if (kikYapildi) {
        const yeni = evrakKaydiYap({ sayi: "", tarih: kikTarih || bugunTarih });
        if (!kik?.tamam || kik.tarih.slice(0, 10) !== yeni.tarih) yazilacak.push(["kik-bildirimi", "KİK bildirimi", yeni]);
      } else if (kik?.tamam) {
        yazilacak.push(["kik-bildirimi", "KİK bildirimi", { tamam: false, tarih: kik.tarih, not: kik.not ?? "" }]);
      }
    } catch (e) {
      setMesaj((e as Error).message);
      return;
    }
    if (yazilacak.length === 0) {
      setMesaj("Kaydedilecek değişiklik yok.");
      return;
    }
    setKaydediliyor(true);
    try {
      for (const [kod, ad, kayit] of yazilacak) await b.evrakDegistir(kod, ad, kayit);
      setMesaj("Kaydedildi.");
    } finally {
      setKaydediliyor(false);
    }
  };

  const kapat = async () => {
    if (!ozet.hazir) return;
    setMesaj("");
    setKaydediliyor(true);
    try {
      await b.evrakDegistir("dosya-kapanisi", "Dosya kapanışı", { tamam: true, tarih: bugunTarih, not: "" });
      await b.alimDegistir({ asama: "tamamlandi", sonIslem: bugunTarih }, "Kontrol ve kapanış tamamlandı, dosya kapatıldı.");
    } finally {
      setKaydediliyor(false);
    }
  };

  return (
    <>
      <section className="panel genis-form" aria-labelledby="kontrol-baslik">
        <div className="panel-baslik-satiri">
          <div>
            <h2 id="kontrol-baslik">12. Kontrol ve kapanış</h2>
            <p className="soluk kucuk">Dosyanın kapanmasını engelleyenler, dış sistem belgeleri, dosya kapağı ve dizini.</p>
          </div>
        </div>

        <div style={{ marginTop: "12px" }}>
          <h3 style={{ fontSize: "14px", marginBottom: "8px" }}>Kapanışı engelleyenler</h3>
          <div className="sutun" style={{ gap: "6px" }}>
            {ozet.engeller.length === 0 && <p className="soluk kucuk">Engel yok.</p>}
            {ozet.engeller.map((k, i) => {
              const hedef = yol(k.baslik);
              return (
                <div key={i}>
                  <KontrolSatiri k={k} />
                  {hedef && (
                    <Link to={hedef} className="kucuk">
                      Basamağa git
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ marginTop: "16px" }}>
          <h3 style={{ fontSize: "14px", marginBottom: "8px" }}>Uyarılar</h3>
          <div className="sutun" style={{ gap: "6px" }}>
            {ozet.uyarilar.length === 0 && <p className="soluk kucuk">Uyarı yok.</p>}
            {ozet.uyarilar.map((k, i) => (
              <KontrolSatiri key={i} k={k} />
            ))}
          </div>
        </div>

        <div style={{ marginTop: "16px" }}>
          <h3 style={{ fontSize: "14px", marginBottom: "8px" }}>Dış sistemlerde düzenlenen belgeler</h3>
          <p className="soluk kucuk">Sayı ve tarih isteğe bağlıdır; dosya dizininde görünür. Boş bırakılan alan kaydı değiştirmez.</p>
          <div className="form-izgara" style={{ marginTop: "8px" }}>
            <div className="alan">
              <label htmlFor="tif-sayi">Taşınır işlem fişi (TKYS) sayısı</label>
              <input id="tif-sayi" type="text" value={tifSayi} onChange={(e) => setTifSayi(e.target.value)} disabled={kapali} />
            </div>
            <div className="alan">
              <label htmlFor="tif-tarih">Taşınır işlem fişi (TKYS) tarihi</label>
              <input id="tif-tarih" type="date" value={tifTarih} onChange={(e) => setTifTarih(e.target.value)} disabled={kapali} />
            </div>
            <div className="alan">
              <label htmlFor="oeb-sayi">Ödeme emri belgesi (MYS) sayısı</label>
              <input id="oeb-sayi" type="text" value={oebSayi} onChange={(e) => setOebSayi(e.target.value)} disabled={kapali} />
            </div>
            <div className="alan">
              <label htmlFor="oeb-tarih">Ödeme emri belgesi (MYS) tarihi</label>
              <input id="oeb-tarih" type="date" value={oebTarih} onChange={(e) => setOebTarih(e.target.value)} disabled={kapali} />
            </div>
            <div className="alan">
              <label className="onay-kutusu">
                <input
                  type="checkbox"
                  checked={kikYapildi}
                  disabled={kapali}
                  onChange={(e) => {
                    setKikYapildi(e.target.checked);
                    if (e.target.checked && !kikTarih) setKikTarih(bugunTarih);
                  }}
                />
                <span>KİK bildirimi yapıldı</span>
              </label>
            </div>
            <div className="alan">
              <label htmlFor="kik-bildirim-tarihi">KİK bildirim tarihi</label>
              <input
                id="kik-bildirim-tarihi"
                type="date"
                value={kikTarih}
                disabled={kapali || !kikYapildi}
                onChange={(e) => setKikTarih(e.target.value)}
              />
            </div>
          </div>
          <div className="dugme-grubu" style={{ marginTop: "12px" }}>
            <button type="button" className="dugme" disabled={kaydediliyor || kapali} onClick={() => void kaydet()}>
              Dış sistem bilgilerini kaydet
            </button>
          </div>
        </div>

        {mesaj && (
          <div className="bant" role="status" style={{ marginTop: "12px" }}>
            {mesaj}
          </div>
        )}

        <div style={{ marginTop: "16px" }}>
          <h3 style={{ fontSize: "14px", marginBottom: "8px" }}>Kapak ve dizin</h3>
          <button type="button" className="dugme" onClick={() => setOnizle(true)}>
            Kapak ve dizin önizlemesi
          </button>
        </div>

        <div style={{ marginTop: "20px" }}>
          {kapali ? (
            <p className="kalin">Dosya {kapanisTarihi ? uzunTarih(kapanisTarihi) : ""} tarihinde kapatıldı.</p>
          ) : (
            <>
              <button
                type="button"
                className="dugme dugme-ana"
                disabled={!ozet.hazir || kaydediliyor}
                onClick={() => void kapat()}
                style={{ fontSize: "14px", padding: "10px 20px" }}
              >
                Dosyayı kapat
              </button>
              {!ozet.hazir && (
                <p className="soluk kucuk" style={{ marginTop: "6px" }}>
                  Kapanışı engelleyenler giderilmeden dosya kapatılamaz ({ozet.engeller.length} engel).
                </p>
              )}
            </>
          )}
        </div>
      </section>

      {onizle && <BelgeOnizleme baslik="Dosya kapağı ve dizini" sayfalar={sayfalar} kapat={() => setOnizle(false)} />}
    </>
  );
}
