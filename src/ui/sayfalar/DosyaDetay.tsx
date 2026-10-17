import { useCallback, useEffect, useState } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { olayKaydet } from "../../data/olay";
import { asamaIlerlemesi, asamaSirasi, evrakDurumlari, type EvrakKaydi, type Olay } from "../../domain/dosya";
import type { PiyasaArastirmasi } from "../../domain/piyasa";
import type { Asama } from "../../domain/tipler";
import { ASAMA_ADI, asamaGrubu, bugun, tl, uzunTarih } from "../bicim";
import type { Veri } from "../useVeri";

interface Detay {
  evraklar: Record<string, EvrakKaydi>;
  piyasa: PiyasaArastirmasi | null;
  olaylar: Olay[];
}

// Olay türünden ulaşılan aşama; çizelgedeki tarihler bu eşleşmeden okunur.
function olayAsamasi(tur: string): Asama | null {
  if (tur === "olusturuldu") return "onay";
  if (tur === "piyasa-basladi") return "piyasa";
  if (tur === "piyasa-tamamlandi") return "siparis";
  if (tur.startsWith("asama:")) return tur.slice(6) as Asama;
  return null;
}

function zamanYazisi(zaman: string): string {
  return `${uzunTarih(zaman.slice(0, 10))} ${zaman.slice(11, 16)}`;
}

export function DosyaDetay() {
  const { alimId = "" } = useParams();
  const { depo, alimlar, tedarikciler, ayarlar, yenile } = useOutletContext<Veri>();
  const alim = alimlar.find((a) => a.id === alimId);
  const [detay, setDetay] = useState<Detay | null>(null);
  const [eksikler, setEksikler] = useState<string[]>([]);
  const [hata, setHata] = useState("");
  const [ekapMetin, setEkapMetin] = useState<string | null>(null);

  const yukle = useCallback(async () => {
    const [evraklar, piyasa, olaylar] = await Promise.all([depo.evraklar(alimId), depo.piyasaGetir(alimId), depo.olaylar(alimId)]);
    setDetay({ evraklar, piyasa, olaylar });
  }, [depo, alimId]);

  useEffect(() => {
    void yukle();
  }, [yukle]);

  if (!alim) {
    return (
      <div className="sayfa">
        <div className="bant bant-hata" role="alert">
          {alimId} numaralı dosya bulunamadı. <Link to="/dosyalar">Dosya listesine dönün.</Link>
        </div>
      </div>
    );
  }
  if (!detay) return <p className="soluk">Dosya yükleniyor…</p>;

  const evraklar = evrakDurumlari(alim, detay.evraklar, detay.piyasa);
  const ilerleme = asamaIlerlemesi(alim, evraklar);
  const sira = asamaSirasi(alim.bent);
  const simdi = sira.indexOf(alim.asama);
  const kapali = alim.asama === "tamamlandi" || alim.asama === "iptal";
  const tamamSayisi = evraklar.filter((e) => e.tamam).length;
  const tedarikci = tedarikciler.find((t) => t.id === alim.tedarikciId)?.ad;

  const asamaTarihi = (a: Asama): string | null => {
    if (a === "ihtiyac" || a === "dayanak" || a === "onay") return alim.onayTarihi;
    const olay = [...detay.olaylar].reverse().find((o) => olayAsamasi(o.tur) === a);
    return olay ? olay.zaman.slice(0, 10) : null;
  };

  async function evrakDegistir(kod: string, ad: string, tamam: boolean, not: string) {
    setHata("");
    setEksikler([]);
    try {
      await depo.evrakKaydet(alimId, kod, { tamam, tarih: bugun(), not });
      await olayKaydet(depo, ayarlar, alimId, "evrak", `${ad}: ${tamam ? "tamamlandı" : "geri alındı"}`);
      await yukle();
    } catch (e) {
      setHata(`Evrak kaydedilemedi. ${String(e)}`);
    }
  }

  async function ekapKaydet() {
    if (ekapMetin === null || !alim) return;
    const no = ekapMetin.trim();
    try {
      await depo.alimGuncelle(alimId, { ekapKayitNo: no });
      await olayKaydet(depo, ayarlar, alimId, "ekap", no ? `EKAP kayıt numarası: ${no}` : "EKAP kayıt numarası silindi");
      setEkapMetin(null);
      await yenile();
      await yukle();
    } catch (e) {
      setHata(`EKAP numarası kaydedilemedi. ${String(e)}`);
    }
  }

  async function sureliDegistir(deger: boolean) {
    try {
      await depo.alimGuncelle(alimId, { sureliIs: deger });
      await olayKaydet(depo, ayarlar, alimId, "sureli-is", deger ? "Süreye yayılan iş olarak işaretlendi, sözleşme zorunlu" : "Süreye yayılan iş işareti kaldırıldı");
      await yenile();
      await yukle();
    } catch (e) {
      setHata(`Değişiklik kaydedilemedi. ${String(e)}`);
    }
  }

  async function ilerlet() {
    if (!ilerleme.sonraki) return;
    if (ilerleme.eksikler.length) {
      setEksikler(ilerleme.eksikler);
      return;
    }
    try {
      await depo.alimGuncelle(alimId, { asama: ilerleme.sonraki, sonIslem: bugun() });
      await olayKaydet(depo, ayarlar, alimId, `asama:${ilerleme.sonraki}`, `Aşama: ${ASAMA_ADI[ilerleme.sonraki]}`);
      await yenile();
      await yukle();
    } catch (e) {
      setHata(`Aşama değiştirilemedi. ${String(e)}`);
    }
  }

  return (
    <div className="sayfa">
      <header className="sayfa-ust">
        <div>
          <Link to="/dosyalar" className="kucuk">
            Alım dosyaları
          </Link>
          <h1>{alim.konu}</h1>
          <p className="soluk">
            <span className="mono">{alim.id}</span> · <span className="mono">{alim.bent}</span>
            {tedarikci ? ` · ${tedarikci}` : ""} · <span className="mono">{tl(alim.tutar)} + KDV</span>
          </p>
        </div>
        <span className={`etiket etiket-${asamaGrubu(alim.asama)}`}>{ASAMA_ADI[alim.asama]}</span>
      </header>

      <div className="iki-sutun">
        <section className="panel surec" aria-labelledby="surec-baslik">
          <h2 id="surec-baslik">Süreç</h2>
          <ol className="cizelge">
            {sira.map((a, i) => {
              const durum = kapali || i < simdi ? "bitti" : i === simdi ? "simdi" : "sonra";
              const tarih = durum === "sonra" ? null : asamaTarihi(a);
              return (
                <li key={a} className={`cizelge-${durum}`} aria-current={durum === "simdi" ? "step" : undefined}>
                  <span className="cizelge-nokta" aria-hidden="true" />
                  <span className="cizelge-metin">
                    <span>{ASAMA_ADI[a]}</span>
                    <span className="mono soluk kucuk">{tarih ? uzunTarih(tarih) : "—"}</span>
                  </span>
                </li>
              );
            })}
          </ol>
          {!kapali && ilerleme.ekran === "piyasa" && (
            <Link to={`/piyasa/${alim.id}`} className="dugme dugme-ana">
              Piyasa araştırmasına git
            </Link>
          )}
          {!kapali && ilerleme.ekran === "muayene" && (
            <Link to={`/muayene/${alim.id}`} className="dugme dugme-ana">
              Muayene ve kabul tutanağını hazırla
            </Link>
          )}
          {!kapali && ilerleme.ekran === "odeme" && (
            <Link to={`/odeme/${alim.id}`} className="dugme dugme-ana">
              Ödeme ekranını aç
            </Link>
          )}
          {!kapali && ilerleme.sonraki && ilerleme.ekran === null && (
            <button type="button" className="dugme dugme-ana" onClick={ilerlet}>
              {ilerleme.sonraki === "tamamlandi" ? "Dosyayı kapat" : `${ASAMA_ADI[ilerleme.sonraki]} aşamasına geç`}
            </button>
          )}
          {eksikler.length > 0 && (
            <div className="bant bant-uyari kucuk" role="alert">
              Önce şu evrakları tamamlayın:
              <ul className="duz-liste">
                {eksikler.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="panel bosluksuz evrak-paneli" aria-labelledby="evrak-baslik">
          <div className="panel-ust">
            <h2 id="evrak-baslik">Evrak kontrol listesi</h2>
            <span className="mono soluk kucuk">
              {tamamSayisi} / {evraklar.length} tamam
            </span>
          </div>
          <div className="cubuk evrak-cubugu" role="img" aria-label={`${evraklar.length} evraktan ${tamamSayisi} tanesi tamam`}>
            <div className="cubuk-dolu cubuk-basari" style={{ width: `${(tamamSayisi / evraklar.length) * 100}%` }} />
          </div>
          {hata && (
            <div className="bant bant-hata kenarsiz" role="alert">
              {hata}
            </div>
          )}
          <ul className="evrak-listesi">
            {evraklar.map((e) => (
              <li key={e.kod} className={e.tamam ? "evrak evrak-tamam" : "evrak"}>
                {e.sistemden ? (
                  <span className="evrak-isaret" aria-hidden="true">
                    {e.tamam ? "✓" : "·"}
                  </span>
                ) : (
                  <input
                    type="checkbox"
                    id={`evrak-${e.kod}`}
                    checked={e.tamam}
                    disabled={kapali}
                    onChange={(ev) => evrakDegistir(e.kod, e.ad, ev.target.checked, e.not)}
                  />
                )}
                <span className="evrak-metin">
                  {e.sistemden ? <span className="kalin">{e.ad}</span> : <label htmlFor={`evrak-${e.kod}`} className="kalin">{e.ad}</label>}
                  <span className="soluk kucuk">
                    {e.sistemden ? e.not : e.tamam && e.tarih ? `${uzunTarih(e.tarih)}${e.not ? ` · ${e.not}` : ""}` : `${ASAMA_ADI[e.asama]} aşamasında`}
                  </span>
                </span>
                {e.sistemden && e.kod !== "ekap-kaydi" && alim.bent === "22/d" && (
                  <Link to={`/piyasa/${alim.id}`} className="kucuk">
                    Aç
                  </Link>
                )}
                {(e.kod === "borc-sorgusu" || e.kod === "odeme-emri") && (alim.asama === "odeme" || e.tamam) && (
                  <Link to={`/odeme/${alim.id}`} className="kucuk">
                    Aç
                  </Link>
                )}
                {e.kod === "muayene-tutanagi" && (alim.asama === "muayene" || e.tamam) && (
                  <Link to={`/muayene/${alim.id}`} className="kucuk">
                    Aç
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>

        <aside className="yan">
          <section className="panel" aria-labelledby="bilgi-baslik">
            <h2 id="bilgi-baslik">Dosya bilgileri</h2>
            <div className="anahtar-deger">
              <span>Onay tarihi</span>
              <span className="mono">{uzunTarih(alim.onayTarihi)}</span>
            </div>
            <div className="anahtar-deger">
              <span>Bütçe tertibi</span>
              <span className="mono">{alim.ekonomikKod}</span>
            </div>
            <div className="anahtar-deger">
              <span>Kalem kodu</span>
              <span className="mono">{alim.kalemKodu}</span>
            </div>
            <div className="anahtar-deger">
              <span>Tedarikçi</span>
              <span>{tedarikci ?? "Belirlenmedi"}</span>
            </div>
            {ekapMetin === null ? (
              <div className="anahtar-deger">
                <span>EKAP kayıt no</span>
                <span className="satir">
                  {alim.ekapKayitNo ? <span className="mono">{alim.ekapKayitNo}</span> : <span className="uyari-yazi">Girilmedi</span>}
                  {!kapali && (
                    <button type="button" className="metin-dugme" onClick={() => setEkapMetin(alim.ekapKayitNo ?? "")}>
                      {alim.ekapKayitNo ? "Değiştir" : "Gir"}
                    </button>
                  )}
                </span>
              </div>
            ) : (
              <div className="alan">
                <label htmlFor="ekap-no">EKAP doğrudan temin kayıt numarası</label>
                <input id="ekap-no" className="mono" value={ekapMetin} onChange={(e) => setEkapMetin(e.target.value)} />
                <span className="satir sag-hizali">
                  <button type="button" className="dugme kucuk-dugme" onClick={() => setEkapMetin(null)}>
                    Vazgeç
                  </button>
                  <button type="button" className="dugme kucuk-dugme dugme-ana" onClick={ekapKaydet}>
                    Kaydet
                  </button>
                </span>
              </div>
            )}
            <label className="onay-kutusu kucuk">
              <input type="checkbox" checked={!!alim.sureliIs} disabled={kapali} onChange={(e) => sureliDegistir(e.target.checked)} />
              Süreye yayılan iş, sözleşme zorunlu
            </label>
          </section>
          <section className="panel" aria-labelledby="iz-baslik">
            <h2 id="iz-baslik">Denetim izi</h2>
            {detay.olaylar.length === 0 && <p className="soluk kucuk">Bu dosyada henüz kayıtlı işlem yok.</p>}
            <ol className="iz-listesi">
              {detay.olaylar.map((o) => (
                <li key={o.id ?? o.zaman + o.aciklama}>
                  <span>{o.aciklama}</span>
                  <span className="soluk kucuk">
                    {o.kim} · <span className="mono">{zamanYazisi(o.zaman)}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}
