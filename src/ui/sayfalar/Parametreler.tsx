import { useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { limitDonemiBul, odenekSiniri } from "../../domain/kurallar";
import { ayarHatalari, limitDonemiHatalari, onerilenDonem } from "../../domain/parametreler";
import { tutarCoz } from "../../domain/sihirbaz";
import type { Ayarlar, KararPulu, Konum } from "../../domain/tipler";
import type { Depo } from "../../data/depo";
import { elleYedekAl, yedegiDenetle, yedekSec, yedektenGeriYukle } from "../../data/yedek";
import { binde, bugun, tl, tutarGirdisi, uzunTarih, yedekOzeti, yolDosyaAdi } from "../bicim";
import { IdareBasligi } from "../IdareBasligi";
import type { Veri } from "../useVeri";

const KARAR_PULU: [KararPulu, string, string][] = [
  ["uygulanmaz", "Uygulanmaz", "Doğrudan temin ihale usulü değil. Sayıştay kararlarında bu görüş var."],
  ["onay-karar-sayilir", "Onay belgesi karar sayılır", "Onay belgesi veya \"rayice uygundur\" şerhi karar kabul edilir."],
  ["yalnizca-komisyon", "Yalnızca komisyon kararı varsa", "İdare ayrıca komisyon kurup karar aldıysa uygulanır."],
];

interface Metinler {
  odenekler: Record<string, string>;
  tevkifatSiniri: string;
  vergiBorcuSorguEsigi: string;
  pencere: string;
  makbuz: string;
  sozlesme: string;
  karar: string;
}

function metinleriKur(a: Ayarlar): Metinler {
  return {
    odenekler: Object.fromEntries(Object.entries(a.odenekler).map(([y, k]) => [y, tutarGirdisi(k)])),
    tevkifatSiniri: a.tevkifatSiniri ? tutarGirdisi(a.tevkifatSiniri) : "",
    vergiBorcuSorguEsigi: a.vergiBorcuSorguEsigi ? tutarGirdisi(a.vergiBorcuSorguEsigi) : "",
    pencere: String(a.bolme.pencereGun),
    // Oranlar yüz binde tutulur; ekranda binde gösterilir. tutarCoz "9,48" → 948 verir.
    makbuz: binde(a.damga.makbuzOrani),
    sozlesme: binde(a.damga.sozlesmeOrani),
    karar: binde(a.damga.kararOrani),
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
  const oran = (ad: string, metin: string) => {
    const v = tutarCoz(metin);
    if (v === null) hatalar.push(`${ad} oranını 9,48 biçiminde yazın.`);
    return v ?? 0;
  };
  let tevkifatSiniri: number | undefined;
  if (m.tevkifatSiniri.trim()) {
    const v = tutarCoz(m.tevkifatSiniri);
    if (v === null) hatalar.push("Tevkifat sınırını 12.000,00 biçiminde yazın.");
    else tevkifatSiniri = v;
  }
  let vergiBorcuSorguEsigi: number | undefined;
  if (m.vergiBorcuSorguEsigi.trim()) {
    const v = tutarCoz(m.vergiBorcuSorguEsigi);
    if (v === null) hatalar.push("Vergi borcu sorgu eşiğini 5.000,00 biçiminde yazın.");
    else vergiBorcuSorguEsigi = v;
  }
  const ayar: Ayarlar = {
    ...taslak,
    odenekler,
    tevkifatSiniri,
    vergiBorcuSorguEsigi,
    bolme: { ...taslak.bolme, pencereGun: Number(m.pencere) },
    damga: {
      ...taslak.damga,
      makbuzOrani: oran("Makbuz", m.makbuz),
      sozlesmeOrani: oran("Sözleşme", m.sozlesme),
      kararOrani: oran("Karar pulu", m.karar),
    },
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

      <section className="panel" aria-labelledby="tevkifat-baslik">
        <h2 id="tevkifat-baslik">KDV tevkifatı</h2>
        <div className="alan">
          <label htmlFor="tevkifat-siniri">Tevkifat sınırı, KDV dahil, TL</label>
          <input
            id="tevkifat-siniri"
            className="mono"
            inputMode="decimal"
            value={metin.tevkifatSiniri}
            aria-invalid={metin.tevkifatSiniri.trim() !== "" && tutarCoz(metin.tevkifatSiniri) === null}
            onChange={(e) => metinDegistir({ tevkifatSiniri: e.target.value })}
            placeholder="Güncel tebliğdeki tutar"
          />
          <span className="ipucu">KDV dahil bedel bu tutarı aşarsa tevkifat uygulanır. Boş bırakılırsa her tutara uygulanır.</span>
        </div>
        <div className="alan">
          <label htmlFor="vergi-sorgu-esigi">Vergi borcu sorgu eşiği (₺)</label>
          <input
            id="vergi-sorgu-esigi"
            className="mono"
            inputMode="decimal"
            value={metin.vergiBorcuSorguEsigi}
            aria-invalid={metin.vergiBorcuSorguEsigi.trim() !== "" && tutarCoz(metin.vergiBorcuSorguEsigi) === null}
            onChange={(e) => metinDegistir({ vergiBorcuSorguEsigi: e.target.value })}
            placeholder="5.000,00"
          />
          <span className="ipucu">KDV dahil ödeme bu tutarı aşarsa vergi borcu sorgulanır (6183 md. 22/A). Boş bırakılırsa ₺5.000 kullanılır. SGK sorgusunda tutar sınırı yoktur.</span>
        </div>
      </section>

      <section className="panel" aria-labelledby="damga-baslik">
        <h2 id="damga-baslik">Damga vergisi kuralları</h2>
        <p className="soluk kucuk">Ödeme ekranındaki kesintiler bu kurallarla hesaplanır. Oranlar KDV hariç bedele uygulanır.</p>
        <div className="izgara">
          <div className="sutun">
            {(
              [
                ["makbuz", "Ödeme makbuzu, binde", "Her ödemede kesilir"],
                ["sozlesme", "Sözleşme, binde", "Yalnızca yazılı sözleşme imzalanırsa"],
                ["karar", "Karar pulu, binde", "Ne zaman uygulanacağı yandaki ayardan seçilir"],
              ] as const
            ).map(([k, ad, not]) => (
              <div key={k} className="alan">
                <label htmlFor={`oran-${k}`}>{ad}</label>
                <input id={`oran-${k}`} className="mono" inputMode="decimal" value={metin[k]} aria-invalid={tutarCoz(metin[k]) === null} onChange={(e) => metinDegistir({ [k]: e.target.value })} />
                <span className="ipucu">{not}</span>
              </div>
            ))}
          </div>
          <div className="sutun">
            <span id="karar-baslik" className="kalin">
              Karar pulu uygulansın mı?
            </span>
            <div className="sutun" role="radiogroup" aria-labelledby="karar-baslik">
              {KARAR_PULU.map(([id, ad, not]) => (
                <button key={id} type="button" role="radio" aria-checked={taslak.damga.kararPulu === id} className="secenek-karti" onClick={() => taslakDegistir({ damga: { ...taslak.damga, kararPulu: id } })}>
                  <span className="kalin">{ad}</span>
                  <span className="soluk kucuk">{not}</span>
                </button>
              ))}
            </div>
            <div className="bant bant-uyari kucuk">Doğrudan teminde karar pulu konusunda kaynaklar çelişiyor. Seçimi muhasebe biriminizle netleştirin.</div>
          </div>
        </div>
      </section>

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
