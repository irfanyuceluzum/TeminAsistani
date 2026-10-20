import { useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { ASAMA_ADI, asamaGrubu, tl, uzunTarih, type AsamaGrubu } from "../bicim";
import type { Veri } from "../useVeri";

const FILTRELER: ("Tümü" | AsamaGrubu)[] = ["Tümü", "Hazırlık", "Teslim", "Kapanış", "Kapalı"];

export function AlimDosyalari() {
  const { alimlar, tedarikciler } = useOutletContext<Veri>();
  const [filtre, setFiltre] = useState<(typeof FILTRELER)[number]>("Tümü");
  const [arama, setArama] = useState("");

  const q = arama.trim().toLocaleLowerCase("tr-TR");
  const firmaAdi = (id: string | null) => tedarikciler.find((t) => t.id === id)?.ad ?? "";
  const satirlar = [...alimlar]
    .sort((x, y) => y.onayTarihi.localeCompare(x.onayTarihi) || y.id.localeCompare(x.id))
    .filter((a) => filtre === "Tümü" || asamaGrubu(a.asama) === filtre)
    .filter((a) => !q || `${a.id} ${a.konu} ${firmaAdi(a.tedarikciId)}`.toLocaleLowerCase("tr-TR").includes(q));

  return (
    <div className="sayfa">
      <header className="sayfa-ust">
        <div>
          <h1>Alım dosyaları</h1>
          <p className="soluk">{alimlar.length} dosya</p>
        </div>
        <Link to="/yeni" className="dugme dugme-ana">
          Yeni alım
        </Link>
      </header>
      <section className="panel bosluksuz" aria-label="Dosya listesi">
        <div className="panel-ust">
          <div className="alan arama">
            <label htmlFor="dosya-ara" className="gizli">
              Dosya, konu veya firma ara
            </label>
            <input id="dosya-ara" type="search" value={arama} onChange={(e) => setArama(e.target.value)} placeholder="DT-2026-041, toner, Toros" />
          </div>
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
                <th scope="col">Onay</th>
                <th scope="col">Konu</th>
                <th scope="col">Tedarikçi</th>
                <th scope="col" className="sag">
                  Tutar
                </th>
                <th scope="col">Aşama</th>
              </tr>
            </thead>
            <tbody>
              {satirlar.map((a) => (
                <tr key={a.id}>
                  <td className="mono">
                    <Link to={`/dosyalar/${a.id}`}>{a.id}</Link>
                  </td>
                  <td className="mono soluk">{uzunTarih(a.onayTarihi)}</td>
                  <td>{a.konu}</td>
                  <td className="soluk">{firmaAdi(a.tedarikciId) || "—"}</td>
                  <td className="mono sag">{tl(a.tutar)}</td>
                  <td>
                    <span className={`etiket etiket-${asamaGrubu(a.asama)}`}>{ASAMA_ADI[a.asama]}</span>
                  </td>
                </tr>
              ))}
              {satirlar.length === 0 && (
                <tr>
                  <td colSpan={6} className="soluk bos">
                    Aramaya uyan dosya yok. Aramayı ya da süzgeci değiştirin.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
