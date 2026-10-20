import { useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { limitDonemiBul, odenekSiniri } from "../../domain/kurallar";
import { ayarHatalari, limitDonemiHatalari, onerilenDonem } from "../../domain/parametreler";
import { tutarCoz } from "../../domain/sihirbaz";
import type { Ayarlar, Konum } from "../../domain/tipler";
import type { Depo } from "../../data/depo";
import { elleYedekAl, yedegiDenetle, yedekSec, yedektenGeriYukle } from "../../data/yedek";
import { bugun, tl, tutarGirdisi, uzunTarih, yedekOzeti, yolDosyaAdi } from "../bicim";
import { IdareBasligi } from "../IdareBasligi";
import type { Veri } from "../useVeri";

interface Metinler {
  odenekler: Record<string, string>;
  pencere: string;
}

function metinleriKur(a: Ayarlar): Metinler {
  return {
    odenekler: Object.fromEntries(Object.entries(a.odenekler).map(([y, k]) => [y, tutarGirdisi(k)])),
    pencere: String(a.bolme.pencereGun),
  };
}

// Bütçe kodlarının boş başlangıç değeri; üç girdiden biri değişince diğerleri korunur.
function butceTaslagi(a: Ayarlar): NonNullable<Ayarlar["butce"]> {
  return { kurumsal: "", fonksiyonel: "", finansman: "", ...a.butce };
}

// Metin alanlarını ayarlara çevirir; okunamayan alanlar için hata döner.
function taslaktanAyar(taslak: Ayarlar, m: Metinler): { ayar: Ayarlar; hatalar: string[] } {
  const hatalar: string[] = [];
  const odenekler: Record<number, number> = {};
  for (const [yil, metin] of Object.entries(m.odenekler)) {
    const k = tutarCoz(metin);
    if (k === null) hatalar.push(`${yil} ödeneğini 20.000.000,00 biçiminde yazın.`);
    else odenekler[Number(yil)] = k;
  }
  // Eski damga/tevkifat/eşik alanları taslaktan aynen korunur (ayar JSON'u bozulmaz).
  const ayar: Ayarlar = {
    ...taslak,
    odenekler,
    bolme: { ...taslak.bolme, pencereGun: Number(m.pencere) },
  };
  return { ayar, hatalar: [...hatalar, ...ayarHatalari(ayar)] };
}

interface DonemFormu {
  baslangic: string;
  bitis: string;
  buyuksehir: string;
  diger: string;
  dayanak: string;
}

interface GeriYuklemeOnayi {
  yol: string;
  alimSayisi: number;
  tedarikciSayisi: number;
}

// Yedek işlemleri ayarlar formundan bağımsızdır; kendi durumunu taşır.
function YedekPaneli({ depo }: { depo: Depo }) {
  const masaustu = depo.tur === "sqlite";
  const [calisiyor, setCalisiyor] = useState<"yedek" | "denetim" | "geri" | null>(null);
  const [tamam, setTamam] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [onay, setOnay] = useState<GeriYuklemeOnayi | null>(null);
  const vazgecDugmesi = useRef<HTMLButtonElement>(null);

  // Onay adımı açılınca odak güvenli seçenek olan "Vazgeç"e gider.
  useEffect(() => {
    if (onay) vazgecDugmesi.current?.focus();
  }, [onay]);

  async function yedekAl() {
    setCalisiyor("yedek");
    setTamam(null);
    setHata(null);
    try {
      const yol = await elleYedekAl(depo, bugun());
      if (yol) setTamam(`Yedek kaydedildi: ${yol}`);
    } catch (e) {
      setHata(`Yedek alınamadı. ${String(e)}`);
    } finally {
      setCalisiyor(null);
    }
  }

  async function yedekSecVeDenetle() {
    setTamam(null);
    setHata(null);
    setOnay(null);
    setCalisiyor("denetim");
    try {
      const yol = await yedekSec();
      if (!yol) return;
      const ozet = await yedegiDenetle(depo, yol);
      setOnay({ yol, alimSayisi: ozet.alimSayisi, tedarikciSayisi: ozet.tedarikciSayisi });
    } catch (e) {
      setHata(String(e instanceof Error ? e.message : e));
    } finally {
      setCalisiyor(null);
    }
  }

  async function geriYukle() {
    if (!onay) return;
    setCalisiyor("geri");
    setHata(null);
    try {
      await yedektenGeriYukle(depo, onay.yol);
    } catch (e) {
      setHata(`Geri yüklenemedi. ${String(e instanceof Error ? e.message : e)}`);
      setOnay(null);
    } finally {
      setCalisiyor(null);
    }
  }

  const mesgul = calisiyor !== null;

  return (
    <section className="panel" aria-labelledby="yedek-baslik">
      <h2 id="yedek-baslik">Yedekleme</h2>
      <p className="soluk kucuk">Veritabanı her gün ilk açılışta otomatik yedeklenir; son 10 otomatik yedek saklanır.</p>
      {!masaustu && <p className="soluk kucuk">Yedekleme yalnız masaüstü uygulamasında çalışır.</p>}
      <div className="satir">
        <button type="button" className="dugme" disabled={!masaustu || mesgul} onClick={yedekAl}>
          {calisiyor === "yedek" ? "Yedekleniyor…" : "Yedek al"}
        </button>
        <button type="button" className="dugme" disabled={!masaustu || mesgul || onay !== null} onClick={yedekSecVeDenetle}>
          Yedekten geri yükle…
        </button>
      </div>
      {onay && (
        <div className="bant bant-uyari">
          <p>
            <span className="kalin">{yolDosyaAdi(onay.yol)}</span>
            <br />
            {yedekOzeti(onay.alimSayisi, onay.tedarikciSayisi)}
          </p>
          <p>Şu anki veriler bu yedekle değiştirilecek. Değiştirmeden önce mevcut veriler otomatik olarak yedeklenir. Uygulama yeniden başlayacak.</p>
          <div className="satir">
            <button type="button" className="dugme dugme-tehlike" disabled={mesgul} onClick={geriYukle}>
              {calisiyor === "geri" ? "Geri yükleniyor…" : "Geri yükle ve yeniden başlat"}
            </button>
            <button ref={vazgecDugmesi} type="button" className="dugme" disabled={mesgul} onClick={() => setOnay(null)}>
              Vazgeç
            </button>
          </div>
        </div>
      )}
      <div role="status">{tamam && <span className="basari-yazi">{tamam}</span>}</div>
      {hata && (
        <div className="bant bant-hata" role="alert">
          {hata}
        </div>
      )}
    </section>
  );
}

export function Parametreler() {
  const { depo, limitDonemleri, ayarlar, yenile } = useOutletContext<Veri>();
  const gun = bugun();
  const aktif = limitDonemiBul(gun, limitDonemleri);

  const [taslak, setTaslak] = useState<Ayarlar>(ayarlar);
  const [metin, setMetin] = useState<Metinler>(() => metinleriKur(ayarlar));
  const [ayarMesaji, setAyarMesaji] = useState<{ tur: "tamam" | "hata"; metin: string } | null>(null);
  const [donemFormu, setDonemFormu] = useState<DonemFormu | null>(null);
  const [donemHatalari, setDonemHatalari] = useState<string[]>([]);
  const [silinecek, setSilinecek] = useState<string | null>(null);

  // Dönem ekleyip silmek de verileri yeniler; kaydedilmemiş ayar değişiklikleri yalnızca ayarlar gerçekten değişince sıfırlanır.
  const ayarAnahtari = JSON.stringify(ayarlar);
  useEffect(() => {
    setTaslak(ayarlar);
    setMetin(metinleriKur(ayarlar));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ayarAnahtari]);

  const { ayar: yeniAyar, hatalar } = useMemo(() => taslaktanAyar(taslak, metin), [taslak, metin]);
  const degisti = JSON.stringify(yeniAyar) !== JSON.stringify(ayarlar) || JSON.stringify(metin) !== JSON.stringify(metinleriKur(ayarlar));

  function metinDegistir(d: Partial<Metinler>) {
    setAyarMesaji(null);
    setMetin((m) => ({ ...m, ...d }));
  }

  function taslakDegistir(d: Partial<Ayarlar>) {
    setAyarMesaji(null);
    setTaslak((t) => ({ ...t, ...d }));
  }

  async function ayarlariKaydet() {
    if (hatalar.length) {
      setAyarMesaji({ tur: "hata", metin: "Kaydetmeden önce kırmızı işaretli alanları düzeltin." });
      return;
    }
    try {
      await depo.ayarlarKaydet(yeniAyar);
      await yenile();
      setAyarMesaji({ tur: "tamam", metin: "Ayarlar kaydedildi." });
    } catch (e) {
      setAyarMesaji({ tur: "hata", metin: `Ayarlar kaydedilemedi. ${String(e)}` });
    }
  }

  function yeniDonemAc() {
    const oneri = onerilenDonem(limitDonemleri, gun);
    setDonemFormu({ ...oneri, buyuksehir: "", diger: "", dayanak: "" });
    setDonemHatalari([]);
  }

  async function donemEkle() {
    if (!donemFormu) return;
    const d = {
      baslangic: donemFormu.baslangic,
      bitis: donemFormu.bitis,
      buyuksehir: tutarCoz(donemFormu.buyuksehir) ?? 0,
      diger: tutarCoz(donemFormu.diger) ?? 0,
      dayanak: donemFormu.dayanak.trim(),
    };
    const h = limitDonemiHatalari(d, limitDonemleri);
    setDonemHatalari(h);
    if (h.length) return;
    try {
      await depo.limitDonemiEkle(d);
      await yenile();
      setDonemFormu(null);
    } catch (e) {
      setDonemHatalari([`Dönem eklenemedi. ${String(e)}`]);
    }
  }

  async function donemSil(baslangic: string) {
    await depo.limitDonemiSil(baslangic);
    setSilinecek(null);
    await yenile();
  }

  const odenekYillari = Object.keys(metin.odenekler).sort();

  return (
    <div className="sayfa dar">
      <header className="sayfa-ust">
        <div>
          <h1>Parametreler</h1>
          <p className="soluk">Kural motoru bu değerlerle çalışır. Limitler ve oranlar koda gömülü değildir.</p>
        </div>
      </header>

      <section className="panel" aria-labelledby="konum-baslik">
        <div className="panel-baslik-satiri">
          <div>
            <h2 id="konum-baslik">İdarenin konumu</h2>
            <p className="soluk kucuk">22/d limiti büyükşehir belediyesi sınırları içinde olup olmamaya göre değişir.</p>
          </div>
          <div className="bolumlu" role="radiogroup" aria-labelledby="konum-baslik">
            {(
              [
                ["buyuksehir", "Büyükşehir sınırları içinde"],
                ["diger", "Diğer"],
              ] as [Konum, string][]
            ).map(([id, ad]) => (
              <button key={id} type="button" role="radio" aria-checked={taslak.konum === id} onClick={() => taslakDegistir({ konum: id })}>
                {ad}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="panel idare-paneli" aria-labelledby="idare-baslik">
        <div className="sutun genis-panel">
          <div>
            <h2 id="idare-baslik">İdare</h2>
            <p className="soluk kucuk">Belgelerin başlığında "T.C." altında iki satır olarak yazılır. Yan menüde de görünür.</p>
          </div>
          <div className="alan">
            <label htmlFor="ust-idare">Üst idare (1. satır)</label>
            <input id="ust-idare" value={taslak.idare?.ustIdare ?? ""} onChange={(e) => taslakDegistir({ idare: { birim: taslak.idare?.birim ?? "", ustIdare: e.target.value } })} placeholder="Karataş Kaymakamlığı" />
          </div>
          <div className="alan">
            <label htmlFor="birim-adi">Birim (2. satır)</label>
            <input id="birim-adi" value={taslak.idare?.birim ?? ""} onChange={(e) => taslakDegistir({ idare: { ustIdare: taslak.idare?.ustIdare ?? "", birim: e.target.value } })} placeholder="Kırmızıdağ İlkokulu Müdürlüğü" />
          </div>
          <div className="alan">
            <label htmlFor="kurumsal-kod">Kurumsal kod</label>
            <input id="kurumsal-kod" value={taslak.butce?.kurumsal ?? ""} onChange={(e) => taslakDegistir({ butce: { ...butceTaslagi(taslak), kurumsal: e.target.value } })} placeholder="18.01.31.00" />
          </div>
          <div className="alan">
            <label htmlFor="fonksiyonel-kod">Fonksiyonel kod</label>
            <input id="fonksiyonel-kod" value={taslak.butce?.fonksiyonel ?? ""} onChange={(e) => taslakDegistir({ butce: { ...butceTaslagi(taslak), fonksiyonel: e.target.value } })} placeholder="09.1.2.00" />
          </div>
          <div className="alan">
            <label htmlFor="finansman-tipi">Finansman tipi</label>
            <input id="finansman-tipi" value={taslak.butce?.finansman ?? ""} onChange={(e) => taslakDegistir({ butce: { ...butceTaslagi(taslak), finansman: e.target.value } })} placeholder="1" />
          </div>
        </div>
        <div className="baslik-onizleme">
          <span className="kucuk kalin">Belge başlığı önizlemesi</span>
          <IdareBasligi ayarlar={taslak} />
        </div>
      </section>

      <section className="panel" aria-labelledby="kullanici-baslik">
        <h2 id="kullanici-baslik">Kullanıcı</h2>
        <div className="alan">
          <label htmlFor="kullanici">Denetim izinde görünecek ad</label>
          <input id="kullanici" value={taslak.kullanici ?? ""} onChange={(e) => taslakDegistir({ kullanici: e.target.value })} placeholder="A. Yılmaz" />
          <span className="ipucu">Boş bırakılırsa "Satın alma birimi" yazılır.</span>
        </div>
      </section>

      <section className="panel bosluksuz" aria-labelledby="limit-baslik">
        <div className="panel-ust">
          <div>
            <h2 id="limit-baslik">22/d parasal limitleri</h2>
            <span className="soluk kucuk">KDV hariç · dönem 1 Şubat'ta başlar · ayrı kaydedilir</span>
          </div>
          {!donemFormu && (
            <button type="button" className="dugme kucuk-dugme" onClick={yeniDonemAc}>
              Yeni dönem ekle
            </button>
          )}
        </div>
        <div className="tablo-kutu">
          <table>
            <thead>
              <tr>
                <th scope="col">Dönem</th>
                <th scope="col" className="sag">
                  Büyükşehir içi
                </th>
                <th scope="col" className="sag">
                  Diğer idareler
                </th>
                <th scope="col">Dayanak</th>
                <th scope="col">Durum</th>
                <th scope="col">
                  <span className="gizli">İşlem</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {[...limitDonemleri].reverse().map((d) => {
                const durum = d === aktif ? "Uygulanıyor" : d.baslangic > gun ? "Gelecek dönem" : "Geçmiş dönem";
                return (
                  <tr key={d.baslangic}>
                    <td className="mono">
                      {uzunTarih(d.baslangic)} – {uzunTarih(d.bitis)}
                    </td>
                    <td className={taslak.konum === "buyuksehir" ? "mono sag kalin" : "mono sag"}>{tl(d.buyuksehir)}</td>
                    <td className={taslak.konum === "diger" ? "mono sag kalin" : "mono sag"}>{tl(d.diger)}</td>
                    <td>{d.dayanak}</td>
                    <td>
                      <span className={durum === "Uygulanıyor" ? "etiket etiket-Teslim" : durum === "Gelecek dönem" ? "etiket etiket-Hazırlık" : "etiket etiket-Kapalı"}>{durum}</span>
                    </td>
                    <td className="sag">
                      {silinecek === d.baslangic ? (
                        <span className="satir sag-hizali">
                          <button type="button" className="dugme kucuk-dugme dugme-tehlike" onClick={() => donemSil(d.baslangic)}>
                            Sil
                          </button>
                          <button type="button" className="dugme kucuk-dugme" onClick={() => setSilinecek(null)}>
                            Vazgeç
                          </button>
                        </span>
                      ) : (
                        <button type="button" className="metin-dugme" onClick={() => setSilinecek(d.baslangic)}>
                          Sil
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {aktif === null && (
          <div className="bant bant-uyari kenarsiz" role="alert">
            Bugün için tanımlı limit dönemi yok. 22/d alımları bu dönem eklenene kadar onaylanamaz.
          </div>
        )}
        {donemFormu && (
          <div className="donem-formu">
            <div className="form-izgara">
              <div className="alan">
                <label htmlFor="d-bas">Başlangıç</label>
                <input id="d-bas" type="date" value={donemFormu.baslangic} onChange={(e) => setDonemFormu({ ...donemFormu, baslangic: e.target.value })} />
              </div>
              <div className="alan">
                <label htmlFor="d-bit">Bitiş</label>
                <input id="d-bit" type="date" value={donemFormu.bitis} onChange={(e) => setDonemFormu({ ...donemFormu, bitis: e.target.value })} />
              </div>
              <div className="alan">
                <label htmlFor="d-bs">Büyükşehir içi limit, TL</label>
                <input id="d-bs" className="mono" inputMode="decimal" value={donemFormu.buyuksehir} onChange={(e) => setDonemFormu({ ...donemFormu, buyuksehir: e.target.value })} placeholder="1.021.827" />
              </div>
              <div className="alan">
                <label htmlFor="d-dg">Diğer idareler limiti, TL</label>
                <input id="d-dg" className="mono" inputMode="decimal" value={donemFormu.diger} onChange={(e) => setDonemFormu({ ...donemFormu, diger: e.target.value })} placeholder="340.391" />
              </div>
              <div className="alan tam">
                <label htmlFor="d-day">Dayanak</label>
                <input id="d-day" value={donemFormu.dayanak} onChange={(e) => setDonemFormu({ ...donemFormu, dayanak: e.target.value })} placeholder="2027/1 Kamu İhale Tebliği, RG tarihi" />
              </div>
            </div>
            {donemHatalari.length > 0 && (
              <ul className="hata-listesi" role="alert">
                {donemHatalari.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            )}
            <div className="satir sag-hizali">
              <button type="button" className="dugme" onClick={() => setDonemFormu(null)}>
                Vazgeç
              </button>
              <button type="button" className="dugme dugme-ana" onClick={donemEkle}>
                Dönemi ekle
              </button>
            </div>
          </div>
        )}
      </section>

      <div className="izgara">
        <section className="panel" aria-labelledby="odenek-baslik">
          <div className="panel-baslik-satiri">
            <h2 id="odenek-baslik">%10 ödenek sınırı</h2>
            <button
              type="button"
              className="metin-dugme"
              onClick={() => {
                const sonYil = odenekYillari.length ? Number(odenekYillari[odenekYillari.length - 1]) : Number(gun.slice(0, 4)) - 1;
                metinDegistir({ odenekler: { ...metin.odenekler, [String(sonYil + 1)]: "" } });
              }}
            >
              Yıl ekle
            </button>
          </div>
          <p className="soluk kucuk">Parasal limit dahilindeki doğrudan temin harcamalarının yıllık toplamı bu tutarın %10'unu Kamu İhale Kurulu'nun uygun görüşü olmadan aşamaz (4734 md. 62/ı).</p>
          {odenekYillari.map((yil) => (
            <div key={yil} className="alan">
              <label htmlFor={`odenek-${yil}`}>{yil} ödeneği, TL</label>
              <input
                id={`odenek-${yil}`}
                className="mono"
                inputMode="decimal"
                value={metin.odenekler[yil]}
                aria-invalid={tutarCoz(metin.odenekler[yil]) === null}
                onChange={(e) => metinDegistir({ odenekler: { ...metin.odenekler, [yil]: e.target.value } })}
                placeholder="20.000.000,00"
              />
              {tutarCoz(metin.odenekler[yil]) !== null && <span className="ipucu">Sınır: {tl(odenekSiniri(tutarCoz(metin.odenekler[yil]) ?? 0))}</span>}
            </div>
          ))}
        </section>

        <section className="panel" aria-labelledby="bolme-baslik">
          <h2 id="bolme-baslik">Bölme uyarısı</h2>
          <div className="alan">
            <label htmlFor="pencere">Geriye dönük bakılacak süre, gün</label>
            <input id="pencere" className="mono" type="number" min="1" max="366" value={metin.pencere} aria-invalid={!(Number(metin.pencere) >= 1 && Number(metin.pencere) <= 366)} onChange={(e) => metinDegistir({ pencere: e.target.value })} />
          </div>
          <fieldset className="secim-grubu">
            <legend>Benzer sayılacak alımlar</legend>
            {(
              [
                ["ayniKalem", "Aynı kalem kodu"],
                ["ayniEkonomikKod", "Aynı ekonomik kod"],
                ["ayniTedarikci", "Aynı tedarikçi"],
              ] as const
            ).map(([k, ad]) => (
              <label key={k} className="onay-kutusu">
                <input type="checkbox" checked={taslak.bolme[k]} onChange={(e) => taslakDegistir({ bolme: { ...taslak.bolme, [k]: e.target.checked } })} />
                {ad}
              </label>
            ))}
          </fieldset>
        </section>
      </div>

      <YedekPaneli depo={depo} />

      <div className="kaydet-cubugu" role="region" aria-label="Ayarları kaydet">
        <div className="sutun-dar">
          {hatalar.length > 0 ? (
            <ul className="hata-listesi">
              {hatalar.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          ) : ayarMesaji ? (
            <span className={ayarMesaji.tur === "tamam" ? "basari-yazi" : "hata-yazi"} role="status">
              {ayarMesaji.metin}
            </span>
          ) : (
            <span className="soluk">{degisti ? "Kaydedilmemiş değişiklikler var." : "Ayarlar güncel."}</span>
          )}
        </div>
        <div className="satir">
          <button
            type="button"
            className="dugme"
            onClick={() => {
              setTaslak(ayarlar);
              setMetin(metinleriKur(ayarlar));
              setAyarMesaji(null);
            }}
          >
            Değişiklikleri geri al
          </button>
          <button type="button" className="dugme dugme-ana" onClick={ayarlariKaydet}>
            Ayarları kaydet
          </button>
        </div>
      </div>
    </div>
  );
}
