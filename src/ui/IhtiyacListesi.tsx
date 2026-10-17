import type { PiyasaKalemi } from "../domain/piyasa";

export function yeniKalem(): PiyasaKalemi {
  return { id: "k" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), ad: "", ozellik: "", miktar: 1, birim: "adet" };
}

export function miktarYazisi(n: number): string {
  return n.toLocaleString("tr-TR", { maximumFractionDigits: 3 });
}

// İhtiyaç listesi düzenleyicisi: sihirbazın ilk adımında ve piyasa araştırmasında aynı liste düzenlenir.
export function IhtiyacListesiDuzenleyici({
  kalemler,
  degistir,
  kilitli = false,
}: {
  kalemler: PiyasaKalemi[];
  degistir: (k: PiyasaKalemi[]) => void;
  kilitli?: boolean;
}) {
  const guncelle = (id: string, d: Partial<PiyasaKalemi>) => degistir(kalemler.map((k) => (k.id === id ? { ...k, ...d } : k)));
  return (
    <div className="sutun">
      {kalemler.length > 0 && (
        <div className="ihtiyac-baslik soluk kucuk" aria-hidden="true">
          <span className="sira" />
          <span className="ihtiyac-ad">Malzeme veya hizmet</span>
          <span className="ihtiyac-ozellik">Teknik özellik</span>
          <span className="miktar-girdi">Miktar</span>
          <span className="birim-girdi">Birim</span>
          <span className="sil-yeri" />
        </div>
      )}
      {kalemler.map((k, i) => (
        <div key={k.id} className="kalem-satiri">
          <span className="mono soluk sira">{i + 1}</span>
          <label className="gizli" htmlFor={`ad-${k.id}`}>
            {i + 1}. kalemin adı
          </label>
          <input id={`ad-${k.id}`} className="girdi ihtiyac-ad" value={k.ad} disabled={kilitli} onChange={(e) => guncelle(k.id, { ad: e.target.value })} placeholder="Çamaşır suyu, 4 L" aria-invalid={!k.ad.trim()} />
          <label className="gizli" htmlFor={`oz-${k.id}`}>
            {i + 1}. kalemin teknik özelliği
          </label>
          <input id={`oz-${k.id}`} className="girdi ihtiyac-ozellik" value={k.ozellik ?? ""} disabled={kilitli} onChange={(e) => guncelle(k.id, { ozellik: e.target.value })} placeholder="TSE belgeli, en az %5 aktif klor" />
          <label className="gizli" htmlFor={`mk-${k.id}`}>
            {i + 1}. kalemin miktarı
          </label>
          <input
            id={`mk-${k.id}`}
            className="girdi mono miktar-girdi"
            type="number"
            min="0"
            step="any"
            value={k.miktar}
            disabled={kilitli}
            aria-invalid={!(k.miktar > 0)}
            onChange={(e) => guncelle(k.id, { miktar: Math.max(0, Number(e.target.value) || 0) })}
          />
          <label className="gizli" htmlFor={`br-${k.id}`}>
            {i + 1}. kalemin birimi
          </label>
          <input id={`br-${k.id}`} className="girdi birim-girdi" value={k.birim} disabled={kilitli} onChange={(e) => guncelle(k.id, { birim: e.target.value })} />
          {!kilitli && (
            <button type="button" className="dugme kucuk-dugme sil-yeri" aria-label={`${k.ad || `${i + 1}. kalemi`} sil`} onClick={() => degistir(kalemler.filter((x) => x.id !== k.id))}>
              Sil
            </button>
          )}
        </div>
      ))}
      {!kilitli && (
        <button type="button" className="dugme kucuk-dugme kendi-genisligi" onClick={() => degistir([...kalemler, yeniKalem()])}>
          Kalem ekle
        </button>
      )}
    </div>
  );
}

// Belgelere eklenen liste: onay belgesinin EK-1'i ve teklif cetvelinin gövdesi.
export function IhtiyacTablosu({ kalemler, fiyatSutunlari = false }: { kalemler: PiyasaKalemi[]; fiyatSutunlari?: boolean }) {
  return (
    <table className="belge-tablo ek-tablo">
      <thead>
        <tr>
          <th scope="col">Sıra</th>
          <th scope="col">Malzeme veya hizmet</th>
          <th scope="col">Teknik özellik</th>
          <th scope="col">Miktar</th>
          <th scope="col">Birim</th>
          {fiyatSutunlari && (
            <>
              <th scope="col">Birim fiyat (KDV hariç)</th>
              <th scope="col">Tutar (KDV hariç)</th>
            </>
          )}
        </tr>
      </thead>
      <tbody>
        {kalemler.map((k, i) => (
          <tr key={k.id}>
            <td>{i + 1}</td>
            <td>{k.ad}</td>
            <td>{k.ozellik}</td>
            <td>{miktarYazisi(k.miktar)}</td>
            <td>{k.birim}</td>
            {fiyatSutunlari && (
              <>
                <td className="bos-hucre" />
                <td className="bos-hucre" />
              </>
            )}
          </tr>
        ))}
        {fiyatSutunlari && (
          <>
            <tr>
              <th scope="row" colSpan={6}>
                Toplam, KDV hariç
              </th>
              <td className="bos-hucre" />
            </tr>
            <tr>
              <th scope="row" colSpan={6}>
                KDV oranı
              </th>
              <td className="bos-hucre" />
            </tr>
          </>
        )}
      </tbody>
    </table>
  );
}
