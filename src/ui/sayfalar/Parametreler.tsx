import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { limitDonemiBul } from "../../domain/kurallar";
import { ayarHatalari, limitDonemiHatalari, onerilenDonem } from "../../domain/parametreler";
import { tutarCoz } from "../../domain/sihirbaz";
import type { Ayarlar, KararPulu, Konum } from "../../domain/tipler";
import { bugun, tl, uzunTarih } from "../bicim";
import type { Veri } from "../useVeri";

const KARAR_PULU: [KararPulu, string, string][] = [
  ["uygulanmaz", "Uygulanmaz", "Doğrudan temin ihale usulü değil. Sayıştay kararlarında bu görüş var."],
  ["onay-karar-sayilir", "Onay belgesi karar sayılır", "Onay belgesi veya \"rayice uygundur\" şerhi karar kabul edilir."],
  ["yalnizca-komisyon", "Yalnızca komisyon kararı varsa", "İdare ayrıca komisyon kurup karar aldıysa uygulanır."],
];

// Oranlar yüz binde tutulur; ekranda binde gösterilir. tutarCoz "9,48" → 948 verir.
function bindeYazisi(yuzBinde: number): string {
  return (yuzBinde / 100).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function tlYazisi(kurus: number): string {
  return (kurus / 100).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface Metinler {
  odenekler: Record<string, string>;
  pencere: string;
  makbuz: string;
  sozlesme: string;
  karar: string;
}

function metinleriKur(a: Ayarlar): Metinler {
  return {
    odenekler: Object.fromEntries(Object.entries(a.odenekler).map(([y, k]) => [y, tlYazisi(k)])),
    pencere: String(a.bolme.pencereGun),
    makbuz: bindeYazisi(a.damga.makbuzOrani),
    sozlesme: bindeYazisi(a.damga.sozlesmeOrani),
    karar: bindeYazisi(a.damga.kararOrani),
  };
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
  const ayar: Ayarlar = {
    ...taslak,
    odenekler,
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
          <p className="soluk kucuk">22/d alımlarının yıllık toplamı bu tutarın %10'unu Kurum'un uygun görüşü olmadan aşamaz.</p>
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
              {tutarCoz(metin.odenekler[yil]) !== null && <span className="ipucu">Sınır: {tl(Math.floor((tutarCoz(metin.odenekler[yil]) ?? 0) / 10))}</span>}
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
