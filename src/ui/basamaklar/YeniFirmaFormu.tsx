import { useState } from "react";
import { yeniTedarikci } from "../../domain/tedarikci";
import type { BasamakBaglami } from "../sayfalar/DosyaCalismaAlani";

// Rehberde olmayan firmayı tedarikçi rehberine ekler; eklenen firmanın kimliğini üst bileşene verir.
export function YeniFirmaFormu({ b, onEklendi, kimlik }: { b: BasamakBaglami; onEklendi: (id: string) => void; kimlik: string }) {
  const [ad, setAd] = useState("");
  const [kategori, setKategori] = useState("");
  const [hata, setHata] = useState("");
  const [bekliyor, setBekliyor] = useState(false);

  async function ekle() {
    setBekliyor(true);
    try {
      const t = yeniTedarikci(ad, kategori, b.veri.tedarikciler);
      await b.veri.depo.tedarikciEkle(t);
      await b.veri.yenile();
      setAd("");
      setKategori("");
      setHata("");
      onEklendi(t.id);
    } catch (e) {
      setHata(e instanceof Error ? e.message : `Firma eklenemedi. ${String(e)}`);
    } finally {
      setBekliyor(false);
    }
  }

  return (
    <div className="alan">
      <label htmlFor={`${kimlik}-ad`}>Rehberde olmayan firma</label>
      <div className="satir">
        <input
          id={`${kimlik}-ad`}
          value={ad}
          onChange={(e) => {
            setAd(e.target.value);
            setHata("");
          }}
          placeholder="Firma adı"
        />
        <label className="gizli" htmlFor={`${kimlik}-kategori`}>
          Kategori
        </label>
        <input id={`${kimlik}-kategori`} value={kategori} onChange={(e) => setKategori(e.target.value)} placeholder="Kategori" />
        <button type="button" className="dugme" disabled={bekliyor} onClick={() => void ekle()}>
          Rehbere ekle
        </button>
      </div>
      {hata && <span className="hata-yazi">{hata}</span>}
    </div>
  );
}
