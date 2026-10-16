import { useOutletContext } from "react-router-dom";
import { limitDonemiBul } from "../../domain/kurallar";
import { bugun, tl, uzunTarih } from "../bicim";
import type { Veri } from "../useVeri";

const KARAR_PULU = {
  uygulanmaz: "Uygulanmaz",
  "onay-karar-sayilir": "Onay belgesi karar sayılır",
  "yalnizca-komisyon": "Yalnızca komisyon kararı varsa",
} as const;

function binde(yuzBinde: number): string {
  return "binde " + (yuzBinde / 100).toLocaleString("tr-TR", { minimumFractionDigits: 2 });
}

export function Parametreler() {
  const { limitDonemleri, ayarlar } = useOutletContext<Veri>();
  const aktif = limitDonemiBul(bugun(), limitDonemleri);
  const yillar = Object.entries(ayarlar.odenekler);

  return (
    <div className="sayfa dar">
      <header className="sayfa-ust">
        <div>
          <h1>Parametreler</h1>
          <p className="soluk">Kural motoru bu değerlerle çalışır. Düzenleme ekranı sonraki adımda eklenecek.</p>
        </div>
      </header>

      <section className="panel bosluksuz" aria-labelledby="limit-baslik">
        <div className="panel-ust">
          <h2 id="limit-baslik">22/d parasal limitleri</h2>
          <span className="soluk">KDV hariç · dönem 1 Şubat'ta başlar</span>
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
              </tr>
            </thead>
            <tbody>
              {[...limitDonemleri].reverse().map((d) => (
                <tr key={d.baslangic}>
                  <td className="mono">
                    {uzunTarih(d.baslangic)} – {uzunTarih(d.bitis)}
                  </td>
                  <td className="mono sag">{tl(d.buyuksehir)}</td>
                  <td className="mono sag">{tl(d.diger)}</td>
                  <td>{d.dayanak}</td>
                  <td>
                    <span className={d === aktif ? "etiket etiket-Teslim" : "etiket etiket-Kapalı"}>{d === aktif ? "Uygulanıyor" : "Geçmiş dönem"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="izgara">
        <section className="panel" aria-labelledby="odenek-baslik">
          <h2 id="odenek-baslik">%10 ödenek sınırı</h2>
          {yillar.map(([yil, odenek]) => (
            <div key={yil} className="anahtar-deger">
              <span>{yil} ödeneği</span>
              <span className="mono">{tl(odenek)}</span>
            </div>
          ))}
        </section>
        <section className="panel" aria-labelledby="bolme-baslik">
          <h2 id="bolme-baslik">Bölme uyarısı</h2>
          <div className="anahtar-deger">
            <span>Geriye dönük süre</span>
            <span>{ayarlar.bolme.pencereGun} gün</span>
          </div>
          <div className="anahtar-deger">
            <span>Benzerlik ölçütü</span>
            <span>
              {[
                ayarlar.bolme.ayniKalem && "aynı kalem",
                ayarlar.bolme.ayniEkonomikKod && "aynı ekonomik kod",
                ayarlar.bolme.ayniTedarikci && "aynı tedarikçi",
              ]
                .filter(Boolean)
                .join(", ")}
            </span>
          </div>
        </section>
        <section className="panel" aria-labelledby="damga-baslik">
          <h2 id="damga-baslik">Damga vergisi</h2>
          <div className="anahtar-deger">
            <span>Ödeme makbuzu</span>
            <span>{binde(ayarlar.damga.makbuzOrani)}</span>
          </div>
          <div className="anahtar-deger">
            <span>Sözleşme</span>
            <span>{binde(ayarlar.damga.sozlesmeOrani)}</span>
          </div>
          <div className="anahtar-deger">
            <span>Karar pulu</span>
            <span>
              {binde(ayarlar.damga.kararOrani)} · {KARAR_PULU[ayarlar.damga.kararPulu]}
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}
