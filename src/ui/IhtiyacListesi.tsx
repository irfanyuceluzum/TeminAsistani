import { useEffect, useId, useRef, useState } from "react";
import { gecmisKalemAra, gecmisKalemBul, kalemAnahtari, type GecmisKalem } from "../domain/gecmis";
import { ihtiyacMetniniAyikla, metniCoz } from "../domain/ihtiyacAktar";
import type { AktarimSonucu, AktarilanKalem } from "../domain/ihtiyacAktar";
import type { PiyasaKalemi } from "../domain/piyasa";

// Aynı milisaniyede ve aynı rastgele ekle bile çağrılsa kimlik çakışmasın diye artan sayaç eklenir.
let kalemSayaci = 0;

export function yeniKalem(): PiyasaKalemi {
  kalemSayaci += 1;
  return { id: "k" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5) + kalemSayaci.toString(36), ad: "", ozellik: "", miktar: 1, birim: "adet" };
}

export function miktarYazisi(n: number): string {
  return n.toLocaleString("tr-TR", { maximumFractionDigits: 3 });
}

export const AKTARIM_DOSYA_SINIRI = 1024 * 1024;
export const ONIZLEME_SATIRI = 50;

// Aktarılan kalemlere benzersiz kimlik verir.
export function aktarilanlariKalemYap(aktarilan: AktarilanKalem[]): PiyasaKalemi[] {
  return aktarilan.map((a) => ({ ...yeniKalem(), ad: a.ad, ozellik: a.ozellik, miktar: a.miktar, birim: a.birim }));
}

// Yalnız tek boş kalem (ad boş) varsa o atılır; "degistir" modunda liste yenileriyle değişir.
export function listeyeBirlestir(mevcut: PiyasaKalemi[], yeni: PiyasaKalemi[], mod: "ekle" | "degistir"): PiyasaKalemi[] {
  if (mod === "degistir") return [...yeni];
  if (mevcut.length === 1 && !mevcut[0].ad.trim()) return [...yeni];
  return [...mevcut, ...yeni];
}

export function doluKalemVarMi(kalemler: PiyasaKalemi[]): boolean {
  return kalemler.some((k) => k.ad.trim() !== "");
}

export function onizlemeOzeti(sonuc: Pick<AktarimSonucu, "kalemler" | "basliktan">): string {
  const sayi = `${sonuc.kalemler.length} kalem bulundu`;
  return sonuc.basliktan ? `${sayi} (başlık satırı tanındı)` : `${sayi} (başlık satırı bulunamadı; sütunlar tahmin edildi — önizlemeyi kontrol edin)`;
}

export function onizlemeFazlasi(toplam: number): string | null {
  return toplam > ONIZLEME_SATIRI ? `… ve ${toplam - ONIZLEME_SATIRI} kalem daha` : null;
}

export const GECMIS_SATIRI = 50;

// Önceki alımlardan seçilen kalemler listeye son alındıkları miktar ve özellikle girer.
export function gecmistenKalemYap(secilen: GecmisKalem[]): PiyasaKalemi[] {
  return aktarilanlariKalemYap(secilen.map((g) => ({ ad: g.ad, ozellik: g.ozellik, miktar: g.miktar, birim: g.birim })));
}

// Ad önceki bir alımın kalemiyle aynıysa ve özellik boşsa özellik ve birim o alımdan dolar.
export function gecmistenTamamla(k: PiyasaKalemi, gecmis: GecmisKalem[]): Partial<PiyasaKalemi> | null {
  const g = gecmisKalemBul(gecmis, k.ad);
  if (!g || (k.ozellik ?? "").trim()) return null;
  return { ozellik: g.ozellik, birim: g.birim || k.birim };
}

// İhtiyaç listesi düzenleyicisi: sihirbazın ilk adımında ve piyasa araştırmasında aynı liste düzenlenir.
export function IhtiyacListesiDuzenleyici({
  kalemler,
  degistir,
  kilitli = false,
  gecmis = [],
}: {
  kalemler: PiyasaKalemi[];
  degistir: (k: PiyasaKalemi[]) => void;
  kilitli?: boolean;
  gecmis?: GecmisKalem[];
}) {
  const guncelle = (id: string, d: Partial<PiyasaKalemi>) => degistir(kalemler.map((k) => (k.id === id ? { ...k, ...d } : k)));

  const baslikKimligi = useId();
  const metinKimligi = useId();
  const dosyaKimligi = useId();
  const oneriKimligi = useId();
  const gecmisBaslikKimligi = useId();
  const aramaKimligi = useId();
  const [gecmisAcik, setGecmisAcik] = useState(false);
  const [arama, setArama] = useState("");
  const [secilenler, setSecilenler] = useState<Set<string>>(() => new Set());
  const listedekiler = new Set(kalemler.map((k) => kalemAnahtari(k.ad)).filter(Boolean));
  const bulunanlar = gecmisKalemAra(gecmis, arama);
  const secilenKalemler = gecmis.filter((g) => secilenler.has(kalemAnahtari(g.ad)));
  const gecmisiKapat = () => {
    setGecmisAcik(false);
    setArama("");
    setSecilenler(new Set());
  };
  const gecmistenEkle = () => {
    if (secilenKalemler.length === 0) return;
    degistir(listeyeBirlestir(kalemler, gecmistenKalemYap(secilenKalemler), "ekle"));
    setDurum(`Önceki alımlardan ${secilenKalemler.length} kalem eklendi.`);
    gecmisiKapat();
  };
  const [aktarAcik, setAktarAcik] = useState(false);
  const [metin, setMetin] = useState("");
  const [dosyaHatasi, setDosyaHatasi] = useState("");
  const [durum, setDurum] = useState("");
  const metinRef = useRef<HTMLTextAreaElement>(null);
  const dugmeRef = useRef<HTMLButtonElement>(null);
  const dosyaRef = useRef<HTMLInputElement>(null);
  const odakDugmeye = useRef(false);

  useEffect(() => {
    if (aktarAcik) metinRef.current?.focus();
    else if (odakDugmeye.current) {
      odakDugmeye.current = false;
      dugmeRef.current?.focus();
    }
  }, [aktarAcik]);

  const sonuc = ihtiyacMetniniAyikla(metin);
  const n = sonuc.kalemler.length;

  const kapat = () => {
    odakDugmeye.current = true;
    setAktarAcik(false);
    setMetin("");
    setDosyaHatasi("");
  };
  const aktar = (mod: "ekle" | "degistir") => {
    if (n === 0) return;
    degistir(listeyeBirlestir(kalemler, aktarilanlariKalemYap(sonuc.kalemler), mod));
    setDurum(`${n} kalem eklendi.`);
    kapat();
  };
  const dosyaSec = async (dosya: File | undefined) => {
    if (!dosya) return;
    setDosyaHatasi("");
    if (dosya.size > AKTARIM_DOSYA_SINIRI) {
      setDosyaHatasi("Dosya çok büyük (1 MB sınırı).");
      return;
    }
    try {
      setMetin(metniCoz(new Uint8Array(await dosya.arrayBuffer())));
    } catch {
      setDosyaHatasi("Dosya okunamadı.");
    }
  };

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
          <input
            id={`ad-${k.id}`}
            className="girdi ihtiyac-ad"
            value={k.ad}
            disabled={kilitli}
            list={gecmis.length ? oneriKimligi : undefined}
            onChange={(e) => guncelle(k.id, { ad: e.target.value })}
            onBlur={() => {
              const d = gecmistenTamamla(k, gecmis);
              if (d) guncelle(k.id, d);
            }}
            placeholder="Çamaşır suyu, 4 L"
            aria-invalid={!k.ad.trim()}
          />
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
      {!kilitli && gecmis.length > 0 && (
        <datalist id={oneriKimligi}>
          {gecmis.map((g) => (
            <option key={g.alimId + g.ad} value={g.ad}>
              {[g.ozellik, `${miktarYazisi(g.miktar)} ${g.birim}`, g.alimId].filter(Boolean).join(" · ")}
            </option>
          ))}
        </datalist>
      )}
      {!kilitli && (
        <div className="ust-araclar">
          <button type="button" className="dugme kucuk-dugme kendi-genisligi" onClick={() => degistir([...kalemler, yeniKalem()])}>
            Kalem ekle
          </button>
          {gecmis.length > 0 && (
            <button
              type="button"
              className="dugme kucuk-dugme kendi-genisligi"
              aria-expanded={gecmisAcik}
              onClick={() => {
                setDurum("");
                setAktarAcik(false);
                setGecmisAcik(true);
              }}
            >
              Önceki alımlardan ekle…
            </button>
          )}
          <button
            ref={dugmeRef}
            type="button"
            className="dugme kucuk-dugme kendi-genisligi"
            aria-expanded={aktarAcik}
            onClick={() => {
              setDurum("");
              gecmisiKapat();
              setAktarAcik(true);
            }}
          >
            Excel'den aktar…
          </button>
        </div>
      )}
      {!kilitli && (
        <p className="kucuk" role="status">
          {durum}
        </p>
      )}
      {!kilitli && gecmisAcik && (
        <section className="aktar-bolumu" aria-labelledby={gecmisBaslikKimligi}>
          <h3 id={gecmisBaslikKimligi} className="kucuk-baslik">
            Önceki alımlardan ekle
          </h3>
          <p className="soluk kucuk">Daha önceki dosyalarda alınmış kalemler, en son alındıkları miktar ve özellikle listeye girer. Eklendikten sonra değiştirebilirsiniz.</p>
          <div className="alan">
            <label htmlFor={aramaKimligi}>Kalem ara</label>
            <input id={aramaKimligi} className="girdi" value={arama} autoFocus onChange={(e) => setArama(e.target.value)} placeholder="Toner, A4, deterjan…" />
          </div>
          {bulunanlar.length === 0 ? (
            <p className="soluk kucuk">Aramaya uyan kalem yok.</p>
          ) : (
            <div className="tablo-kutu">
              <table>
                <thead>
                  <tr>
                    <th scope="col">
                      <span className="gizli">Seç</span>
                    </th>
                    <th scope="col">Malzeme veya hizmet</th>
                    <th scope="col">Teknik özellik</th>
                    <th scope="col">Son miktar</th>
                    <th scope="col">Son alım</th>
                  </tr>
                </thead>
                <tbody>
                  {bulunanlar.slice(0, GECMIS_SATIRI).map((g) => {
                    const anahtar = kalemAnahtari(g.ad);
                    const listede = listedekiler.has(anahtar);
                    return (
                      <tr key={anahtar}>
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`${g.ad} seç`}
                            disabled={listede}
                            checked={listede || secilenler.has(anahtar)}
                            onChange={(e) =>
                              setSecilenler((s) => {
                                const y = new Set(s);
                                if (e.target.checked) y.add(anahtar);
                                else y.delete(anahtar);
                                return y;
                              })
                            }
                          />
                        </td>
                        <td>
                          {g.ad}
                          {listede && <span className="soluk kucuk"> · listede</span>}
                        </td>
                        <td>{g.ozellik}</td>
                        <td className="mono">
                          {miktarYazisi(g.miktar)} {g.birim}
                        </td>
                        <td className="kucuk">
                          <span className="mono">{g.alimId}</span>
                          {g.kez > 1 && <span className="soluk"> · {g.kez} dosyada</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {onizlemeFazlasi(bulunanlar.length) && <p className="soluk kucuk">{onizlemeFazlasi(bulunanlar.length)}; aramayı daraltın.</p>}
          <div className="ust-araclar">
            <button type="button" className="dugme kucuk-dugme dugme-ana" disabled={secilenKalemler.length === 0} onClick={gecmistenEkle}>
              Seçilenleri ekle ({secilenKalemler.length} kalem)
            </button>
            <button type="button" className="dugme kucuk-dugme" onClick={gecmisiKapat}>
              Vazgeç
            </button>
          </div>
        </section>
      )}
      {!kilitli && aktarAcik && (
        <section className="aktar-bolumu" aria-labelledby={baslikKimligi}>
          <h3 id={baslikKimligi} className="kucuk-baslik">
            Excel'den aktar
          </h3>
          <p className="soluk kucuk">Excel ya da LibreOffice Calc'ta satırları (başlık satırıyla birlikte) kopyalayıp aşağıya yapıştırın ya da .csv dosyası seçin. Sütunlar: malzeme adı, teknik özellik, miktar, birim.</p>
          <div className="alan">
            <label htmlFor={metinKimligi}>Yapıştırma alanı</label>
            <textarea id={metinKimligi} ref={metinRef} rows={6} value={metin} onChange={(e) => setMetin(e.target.value)} />
          </div>
          <div className="ust-araclar">
            <input
              id={dosyaKimligi}
              ref={dosyaRef}
              className="gizli"
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              tabIndex={-1}
              aria-label="CSV dosyası"
              onChange={(e) => {
                const dosya = e.target.files?.[0];
                e.target.value = "";
                void dosyaSec(dosya);
              }}
            />
            <button type="button" className="dugme kucuk-dugme" onClick={() => dosyaRef.current?.click()}>
              CSV dosyası seç
            </button>
            {dosyaHatasi && <span className="hata-yazi">{dosyaHatasi}</span>}
          </div>
          {metin.trim() !== "" && (
            <div className="sutun">
              <p className="kalin">{onizlemeOzeti(sonuc)}</p>
              {sonuc.uyarilar.length > 0 && (
                <ul className="duz-liste kucuk">
                  {sonuc.uyarilar.map((u, i) => (
                    <li key={i}>{u}</li>
                  ))}
                </ul>
              )}
              {n > 0 && (
                <div className="tablo-kutu">
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Sıra</th>
                        <th scope="col">Malzeme veya hizmet</th>
                        <th scope="col">Teknik özellik</th>
                        <th scope="col">Miktar</th>
                        <th scope="col">Birim</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sonuc.kalemler.slice(0, ONIZLEME_SATIRI).map((k, i) => (
                        <tr key={i}>
                          <td>{i + 1}</td>
                          <td>{k.ad}</td>
                          <td>{k.ozellik}</td>
                          <td>{miktarYazisi(k.miktar)}</td>
                          <td>{k.birim}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {onizlemeFazlasi(n) && <p className="soluk kucuk">{onizlemeFazlasi(n)}</p>}
            </div>
          )}
          <div className="ust-araclar">
            <button type="button" className="dugme kucuk-dugme dugme-ana" disabled={n === 0} onClick={() => aktar("ekle")}>
              Listeye ekle ({n} kalem)
            </button>
            {doluKalemVarMi(kalemler) && (
              <button type="button" className="dugme kucuk-dugme" disabled={n === 0} onClick={() => aktar("degistir")}>
                Listeyi bununla değiştir
              </button>
            )}
            <button type="button" className="dugme kucuk-dugme" onClick={kapat}>
              Vazgeç
            </button>
          </div>
        </section>
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
