import { useMemo, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { bolmeRiskleri, limitDonemiBul, yuzdeOnDurumu } from "../../domain/kurallar";
import { ASAMA_ADI, asamaGrubu, bugun, gunFarki, kisaTarih, tl, yuzde, type AsamaGrubu } from "../bicim";
import type { Veri } from "../useVeri";

const FILTRELER: ("Tümü" | AsamaGrubu)[] = ["Tümü", "Hazırlık", "Teslim", "Ödeme"];

const KOD_ADI: Record<string, string> = {
  "03.2": "03.2 Tüketime yönelik mal",
  "03.5": "03.5 Hizmet alımları",
  "03.7": "03.7 Menkul mal, bakım",
};

export function AnaPanel() {
  const { alimlar, ayarlar, limitDonemleri } = useOutletContext<Veri>();
  const [filtre, setFiltre] = useState<(typeof FILTRELER)[number]>("Tümü");
  const gun = bugun();
  const yil = Number(gun.slice(0, 4));

  const ozet = useMemo(() => {
    const odenek = ayarlar.odenekler[yil] ?? 0;
    const yuzdeOn = yuzdeOnDurumu(alimlar, yil, odenek);
    const ddAlimlari = alimlar.filter((a) => a.onayTarihi.startsWith(String(yil)) && a.asama !== "iptal");
    const acik = alimlar.filter((a) => asamaGrubu(a.asama) !== "Kapalı").sort((x, y) => y.onayTarihi.localeCompare(x.onayTarihi) || y.id.localeCompare(x.id));
    const bekleyenler = acik.filter((a) => gunFarki(gun, a.sonIslem) > 10);
    const odeme = acik.filter((a) => a.asama === "odeme");
    const kodlar = new Map<string, number>();
    for (const a of ddAlimlari) {
      const ad = KOD_ADI[a.ekonomikKod.slice(0, 4)] ?? "Diğer";
      kodlar.set(ad, (kodlar.get(ad) ?? 0) + a.tutar);
    }
    const kodListesi = [...kodlar.entries()].sort((x, y) => y[1] - x[1]);
    return {
      odenek,
      yuzdeOn,
      ddAdet: ddAlimlari.length,
      acik,
      bekleyenler,
      odeme,
      odemeToplam: odeme.reduce((t, a) => t + a.tutar, 0),
      riskler: bolmeRiskleri(alimlar, gun, ayarlar.bolme),
      kodListesi,
      enBuyukKod: kodListesi[0]?.[1] ?? 1,
      donem: limitDonemiBul(gun, limitDonemleri),
    };
  }, [alimlar, ayarlar, limitDonemleri, gun, yil]);

  const limit = ozet.donem ? (ayarlar.konum === "buyuksehir" ? ozet.donem.buyuksehir : ozet.donem.diger) : null;
  const satirlar = ozet.acik.filter((a) => filtre === "Tümü" || asamaGrubu(a.asama) === filtre);
  const kalan = Math.max(0, ozet.yuzdeOn.sinir - ozet.yuzdeOn.kullanilan);
  const doluluk = ozet.yuzdeOn.sinir ? Math.min(1, ozet.yuzdeOn.kullanilan / ozet.yuzdeOn.sinir) : 0;

  return (
    <div className="sayfa">
      <header className="sayfa-ust">
        <div>
          <h1>Ana panel</h1>
          <p className="soluk">
            Mali yıl {yil} ·{" "}
            {limit !== null
              ? `22/d limiti ${tl(limit)} (${ayarlar.konum === "buyuksehir" ? "büyükşehir" : "diğer idareler"}, KDV hariç)`
              : "Bu tarih için limit dönemi tanımlı değil, Parametreler'den ekleyin"}
          </p>
        </div>
        <Link to="/yeni" className="dugme dugme-ana">
          Yeni alım
        </Link>
      </header>

      <section className="kartlar" aria-label="Özet">
        <div className="kart">
          <span className="kart-etiket">22/d harcaması, {yil}</span>
          <span className="kart-deger">{tl(ozet.yuzdeOn.kullanilan)}</span>
          <span className="kart-not">{ozet.ddAdet} alım</span>
        </div>
        <div className="kart">
          <span className="kart-etiket">%10 ödenek sınırı kullanımı</span>
          <span className="kart-deger">{yuzde(ozet.yuzdeOn.oran)}</span>
          <div className="cubuk" role="img" aria-label={`Sınırın ${Math.round(doluluk * 100)} yüzdesi kullanıldı`}>
            <div className={ozet.yuzdeOn.asiyor ? "cubuk-dolu cubuk-tehlike" : "cubuk-dolu cubuk-uyari"} style={{ width: `${doluluk * 100}%` }} />
          </div>
          <span className="kart-not">
            {ozet.odenek ? `${tl(ozet.yuzdeOn.sinir)} sınırın ${tl(kalan)}'si kaldı` : `${yil} ödeneği girilmemiş`}
          </span>
        </div>
        <div className="kart">
          <span className="kart-etiket">Açık dosyalar</span>
          <span className="kart-deger">{ozet.acik.length}</span>
          <span className={ozet.bekleyenler.length ? "kart-not uyari-yazi" : "kart-not"}>
            {ozet.bekleyenler.length ? `${ozet.bekleyenler.length} dosya 10 günden beri bekliyor` : "Bekleyen dosya yok"}
          </span>
        </div>
        <div className="kart">
          <span className="kart-etiket">Ödeme bekleyen, KDV hariç</span>
          <span className="kart-deger">{tl(ozet.odemeToplam)}</span>
          <span className="kart-not">{ozet.odeme.length} dosya</span>
        </div>
      </section>

      {ozet.riskler.map((r) => (
        <div key={r.kalemKodu} className="bant bant-uyari" role="alert">
          <strong>Bölme riski:</strong> "{r.konu}" için son {ayarlar.bolme.pencereGun} günde {r.alimlar.length} ayrı alım yapıldı
          (toplam {tl(r.toplam)}). İhtiyacı tek alımda toplamayı düşünün (4734 md. 5, kısımlara bölme yasağı).
        </div>
      ))}

      <div className="iki-sutun">
        <section className="panel genis" aria-labelledby="acik-baslik">
          <div className="panel-ust">
            <h2 id="acik-baslik">Açık dosyalar</h2>
            <div className="filtreler" role="group" aria-label="Aşamaya göre süz">
              {FILTRELER.map((f) => (
                <button key={f} type="button" aria-pressed={filtre === f} className="filtre" onClick={() => setFiltre(f)}>
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="tablo-kutu">
            <table>
              <thead>
                <tr>
                  <th scope="col">Dosya</th>
                  <th scope="col">Konu</th>
                  <th scope="col" className="sag">
                    Tutar
                  </th>
                  <th scope="col">Aşama</th>
                  <th scope="col">Son işlem</th>
                </tr>
              </thead>
              <tbody>
                {satirlar.map((a) => (
                  <tr key={a.id}>
                    <td className="mono"><Link to={`/dosyalar/${a.id}`}>{a.id}</Link></td>
                    <td>{a.konu}</td>
                    <td className="mono sag">{tl(a.tutar)}</td>
                    <td>
                      <span className={`etiket etiket-${asamaGrubu(a.asama)}`}>{ASAMA_ADI[a.asama]}</span>
                    </td>
                    <td className="soluk">{kisaTarih(a.sonIslem)}</td>
                  </tr>
                ))}
                {satirlar.length === 0 && (
                  <tr>
                    <td colSpan={5} className="soluk bos">
                      Bu aşamada dosya yok.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="yan">
          <section className="panel" aria-labelledby="bekleyen-baslik">
            <h2 id="bekleyen-baslik">Uzun süredir bekleyenler</h2>
            {ozet.bekleyenler.length === 0 && <p className="soluk">Son 10 günde işlem görmeyen dosya yok.</p>}
            {ozet.bekleyenler.slice(0, 4).map((a) => (
              <div key={a.id} className="bekleyen">
                <span className="gun-rozeti">{gunFarki(gun, a.sonIslem)} gün</span>
                <span>
                  {a.konu} · {ASAMA_ADI[a.asama].toLocaleLowerCase("tr-TR")}
                </span>
              </div>
            ))}
          </section>
          <section className="panel" aria-labelledby="kod-baslik">
            <h2 id="kod-baslik">Ekonomik koda göre 22/d</h2>
            {ozet.kodListesi.map(([ad, tutar]) => (
              <div key={ad} className="kod-satiri">
                <div className="kod-ust">
                  <span>{ad}</span>
                  <span className="mono">{tl(tutar)}</span>
                </div>
                <div className="cubuk ince">
                  <div className="cubuk-dolu" style={{ width: `${(tutar / ozet.enBuyukKod) * 100}%` }} />
                </div>
              </div>
            ))}
          </section>
        </aside>
      </div>
    </div>
  );
}
