import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { olayKaydet } from "../../data/olay";
import { kabulTutari, muayeneKontrolleri, muayeneOlustur, muayeneOzeti, type KomisyonUyesi, type Muayene, type MuayeneKalemi } from "../../domain/muayene";
import { engelVarMi } from "../../domain/sihirbaz";
import { bugun, tl, tlKurus, uzunTarih } from "../bicim";
import { KontrolSatiri } from "../KontrolSatiri";
import type { Veri } from "../useVeri";

type KayitDurumu = "kayitli" | "bekliyor" | "kaydediliyor" | "hata";

function miktar(n: number): string {
  return n.toLocaleString("tr-TR", { maximumFractionDigits: 3 });
}

export function MuayeneKabul() {
  const { alimId = "" } = useParams();
  const { depo, alimlar, tedarikciler, ayarlar, yenile } = useOutletContext<Veri>();
  const navigate = useNavigate();
  const alim = alimlar.find((a) => a.id === alimId);

  const [m, setM] = useState<Muayene | null>(null);
  const [kayit, setKayit] = useState<KayitDurumu>("kayitli");
  const [tutanakAcik, setTutanakAcik] = useState(false);
  const [mesaj, setMesaj] = useState("");
  const yuklendi = useRef(false);
  const alimRef = useRef(alim);
  alimRef.current = alim;

  useEffect(() => {
    let iptal = false;
    yuklendi.current = false;
    (async () => {
      const kayitli = await depo.muayeneGetir(alimId);
      const a = alimRef.current;
      if (iptal || !a) return;
      setM(kayitli ?? muayeneOlustur(a, await depo.piyasaGetir(alimId), bugun()));
    })();
    return () => {
      iptal = true;
    };
  }, [depo, alimId]);

  // Piyasa araştırmasındaki gibi her değişiklikten yarım saniye sonra kaydeder.
  useEffect(() => {
    if (!m) return;
    if (!yuklendi.current) {
      yuklendi.current = true;
      return;
    }
    setKayit("bekliyor");
    const zaman = setTimeout(async () => {
      setKayit("kaydediliyor");
      try {
        await depo.muayeneKaydet(m);
        setKayit("kayitli");
      } catch {
        setKayit("hata");
      }
    }, 500);
    return () => clearTimeout(zaman);
  }, [m, depo]);

  const ozet = useMemo(() => (m ? muayeneOzeti(m) : null), [m]);
  const kontroller = useMemo(() => (m ? muayeneKontrolleri(m) : []), [m]);

  if (!alim) {
    return (
      <div className="sayfa">
        <div className="bant bant-hata" role="alert">
          {alimId} numaralı dosya bulunamadı. <Link to="/dosyalar">Dosya listesine dönün.</Link>
        </div>
      </div>
    );
  }
  if (!m || !ozet) return <p className="soluk">Muayene yükleniyor…</p>;

  const kilitli = m.tamamlandi;
  const tedarikci = tedarikciler.find((t) => t.id === alim.tedarikciId)?.ad ?? "[Yüklenici]";

  function guncelle(d: Partial<Muayene>) {
    setMesaj("");
    setM((x) => (x ? { ...x, ...d } : x));
  }

  function kalemDegistir(id: string, d: Partial<MuayeneKalemi>) {
    setMesaj("");
    setM((x) => (x ? { ...x, kalemler: x.kalemler.map((k) => (k.kalemId === id ? { ...k, ...d } : k)) } : x));
  }

  function uyeDegistir(i: number, d: Partial<KomisyonUyesi>) {
    setMesaj("");
    setM((x) => {
      if (!x) return x;
      let uyeler = x.uyeler.map((u, j) => (j === i ? { ...u, ...d } : u));
      // Tek başkan olur; yeni başkan seçilince öncekiler üye olur.
      if (d.rol === "baskan") uyeler = uyeler.map((u, j) => (j === i ? u : { ...u, rol: "uye" }));
      return { ...x, uyeler };
    });
  }

  async function tamamla() {
    if (!m || !ozet || engelVarMi(kontroller)) {
      setMesaj("Kırmızı işaretli kontroller çözülmeden muayene tamamlanamaz.");
      return;
    }
    try {
      await depo.muayeneKaydet({ ...m, tamamlandi: true });
      await depo.evrakKaydet(alimId, "muayene-tutanagi", { tamam: true, tarih: m.muayeneTarihi, not: ozet.kismi ? "Kısmi kabul" : "Muayene ekranından" });
      if (m.faturaNo.trim()) {
        await depo.evrakKaydet(alimId, "fatura", { tamam: true, tarih: m.faturaTarihi || bugun(), not: `No ${m.faturaNo.trim()}` });
      }
      await depo.alimGuncelle(alimId, { asama: "odeme", tutar: ozet.kabulToplami, sonIslem: bugun() });
      await olayKaydet(depo, ayarlar, alimId, "asama:odeme", `Muayene ve kabul tamamlandı: ${tl(ozet.kabulToplami)}${ozet.kismi ? ", kısmi kabul" : ""}`);
      await yenile();
      navigate(`/dosyalar/${alimId}`);
    } catch (e) {
      setMesaj(`Muayene kaydedilemedi. ${String(e)}`);
    }
  }

  const kayitYazisi = { kayitli: "Kaydedildi", bekliyor: "Değişiklik var", kaydediliyor: "Kaydediliyor…", hata: "Kaydedilemedi" }[kayit];
  const sayi = (deger: string) => Math.max(0, Number(deger.replace(",", ".")) || 0);

  return (
    <div className="sayfa">
      <header className="sayfa-ust yazdirma">
        <div>
          <Link to={`/dosyalar/${alim.id}`} className="kucuk mono">
            {alim.id} · {alim.konu}
          </Link>
          <h1>Muayene ve kabul</h1>
          <p className="soluk">
            {tedarikci} · sipariş tutarı {tl(alim.tutar)} + KDV
          </p>
        </div>
        <span className={kayit === "hata" ? "kayit-durumu hata-yazi" : "kayit-durumu soluk"} role="status">
          {kayitYazisi}
        </span>
      </header>

      {kilitli && <div className="bant bant-bilgi yazdirma">Muayene tamamlandı. Sonuç dosyaya işlendi, değişiklik yapılamaz.</div>}

      <fieldset className="kilit yazdirma" disabled={kilitli}>
        <section className="panel" aria-labelledby="fatura-baslik">
          <h2 id="fatura-baslik">Fatura ve muayene bilgileri</h2>
          <div className="form-izgara">
            <div className="alan">
              <label htmlFor="fno">Fatura numarası</label>
              <input id="fno" className="mono" value={m.faturaNo} onChange={(e) => guncelle({ faturaNo: e.target.value })} placeholder="ABC2026000000123" />
            </div>
            <div className="alan">
              <label htmlFor="ftarih">Fatura tarihi</label>
              <input id="ftarih" type="date" value={m.faturaTarihi} onChange={(e) => guncelle({ faturaTarihi: e.target.value })} />
            </div>
            <div className="alan">
              <label htmlFor="mtarih">Muayene tarihi</label>
              <input id="mtarih" type="date" value={m.muayeneTarihi} onChange={(e) => guncelle({ muayeneTarihi: e.target.value })} />
            </div>
            <div className="alan">
              <label htmlFor="myer">Muayene yeri</label>
              <input id="myer" value={m.yer} onChange={(e) => guncelle({ yer: e.target.value })} placeholder="Hizmet binası" />
            </div>
          </div>
        </section>

        <section className="panel bosluksuz" aria-labelledby="kabul-baslik">
          <div className="panel-ust">
            <h2 id="kabul-baslik">Kalemler ve kabul miktarları</h2>
            <span className="soluk kucuk">Eksik ya da uygunsuz iş varsa kabul miktarını düşürün</span>
          </div>
          <div className="tablo-kutu">
            <table>
              <thead>
                <tr>
                  <th scope="col">Kalem</th>
                  <th scope="col" className="sag">
                    Sipariş
                  </th>
                  <th scope="col" className="sag">
                    Fatura
                  </th>
                  <th scope="col" className="orta">
                    Kabul
                  </th>
                  <th scope="col" className="sag">
                    Birim fiyat
                  </th>
                  <th scope="col" className="sag">
                    Kabul tutarı
                  </th>
                </tr>
              </thead>
              <tbody>
                {m.kalemler.map((k) => {
                  const tam = k.kabulMiktari === k.faturaMiktari;
                  return (
                    <tr key={k.kalemId} className={tam ? undefined : "satir-uyari"}>
                      <td>
                        <span className="blok">{k.ad}</span>
                        <span className={tam ? "kucuk basari-yazi" : "kucuk uyari-yazi"}>
                          {tam ? "Tamamı kabul" : `${miktar(k.faturaMiktari - k.kabulMiktari)} ${k.birim} kabul edilmedi`}
                        </span>
                      </td>
                      <td className="mono sag soluk">
                        {miktar(k.siparisMiktari)} {k.birim}
                      </td>
                      <td className="sag">
                        <input
                          className="fiyat-girdi mono miktar-kucuk"
                          type="number"
                          min="0"
                          step="any"
                          aria-label={`${k.ad} fatura miktarı`}
                          value={k.faturaMiktari}
                          onChange={(e) => {
                            const f = sayi(e.target.value);
                            kalemDegistir(k.kalemId, { faturaMiktari: f, kabulMiktari: Math.min(k.kabulMiktari, f) });
                          }}
                        />
                      </td>
                      <td>
                        <span className="sayac">
                          <button type="button" className="dugme sayac-dugme" aria-label={`${k.ad} kabul miktarını azalt`} onClick={() => kalemDegistir(k.kalemId, { kabulMiktari: Math.max(0, k.kabulMiktari - 1) })}>
                            −
                          </button>
                          <input
                            className="fiyat-girdi mono miktar-kucuk"
                            type="number"
                            min="0"
                            step="any"
                            aria-label={`${k.ad} kabul miktarı`}
                            value={k.kabulMiktari}
                            onChange={(e) => kalemDegistir(k.kalemId, { kabulMiktari: sayi(e.target.value) })}
                          />
                          <button
                            type="button"
                            className="dugme sayac-dugme"
                            aria-label={`${k.ad} kabul miktarını artır`}
                            onClick={() => kalemDegistir(k.kalemId, { kabulMiktari: Math.min(k.faturaMiktari, k.kabulMiktari + 1) })}
                          >
                            +
                          </button>
                        </span>
                      </td>
                      <td className="mono sag">{tlKurus(k.birimFiyat)}</td>
                      <td className="mono sag kalin">{tlKurus(kabulTutari(k))}</td>
                    </tr>
                  );
                })}
                <tr className="toplam-satiri">
                  <th scope="row" colSpan={5}>
                    Kabul edilen toplam, KDV hariç
                    {ozet.kismi && <span className="soluk kucuk normal-yazi"> · fatura {tlKurus(ozet.faturaToplami)}</span>}
                  </th>
                  <td className="mono sag kalin">{tlKurus(ozet.kabulToplami)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel" aria-labelledby="komisyon-baslik">
          <div className="panel-baslik-satiri">
            <h2 id="komisyon-baslik">Muayene ve kabul komisyonu</h2>
            <button type="button" className="dugme kucuk-dugme" onClick={() => guncelle({ uyeler: [...m.uyeler, { ad: "", unvan: "", rol: "uye" }] })}>
              Üye ekle
            </button>
          </div>
          {m.uyeler.map((u, i) => (
            <div key={i} className="kalem-satiri">
              <label className="onay-kutusu baskan-secimi">
                <input type="radio" name="baskan" checked={u.rol === "baskan"} onChange={() => uyeDegistir(i, { rol: "baskan" })} />
                Başkan
              </label>
              <label className="gizli" htmlFor={`uye-ad-${i}`}>
                {i + 1}. üyenin adı
              </label>
              <input id={`uye-ad-${i}`} className="girdi genis-girdi" value={u.ad} onChange={(e) => uyeDegistir(i, { ad: e.target.value })} placeholder="Ad Soyad" />
              <label className="gizli" htmlFor={`uye-unvan-${i}`}>
                {i + 1}. üyenin unvanı
              </label>
              <input id={`uye-unvan-${i}`} className="girdi unvan-girdi" value={u.unvan} onChange={(e) => uyeDegistir(i, { unvan: e.target.value })} placeholder="Unvan" />
              <button type="button" className="dugme kucuk-dugme" aria-label={`${u.ad || `${i + 1}. üyeyi`} çıkar`} onClick={() => guncelle({ uyeler: m.uyeler.filter((_, j) => j !== i) })}>
                Çıkar
              </button>
            </div>
          ))}
        </section>
      </fieldset>

      <div className="iki-sutun yazdirma">
        <section className="panel genis-panel" aria-labelledby="sonuc-baslik">
          <h2 id="sonuc-baslik">Sonuç</h2>
          <div className={ozet.kismi ? "sonuc-kutusu sonuc-uyari" : "sonuc-kutusu"}>
            <span className="kalin">
              {ozet.kismi ? "Kısmi kabul" : "Tamamı kabul"} · {tlKurus(ozet.kabulToplami)} + KDV
            </span>
            <span className="kucuk">
              {ozet.kismi ? `Faturadan ${tlKurus(ozet.fark)} eksik. Ödeme kabul edilen tutar üzerinden hazırlanır.` : "Ödeme fatura tutarı üzerinden hazırlanır."}
            </span>
          </div>
          {mesaj && (
            <div className="bant bant-hata" role="alert">
              {mesaj}
            </div>
          )}
          <div className="dugme-grubu sarmali">
            <button type="button" className="dugme" onClick={() => setTutanakAcik((a) => !a)}>
              {tutanakAcik ? "Tutanağı gizle" : "Tutanağı göster"}
            </button>
            {tutanakAcik && (
              <button type="button" className="dugme" onClick={() => window.print()}>
                Yazdır
              </button>
            )}
            {!kilitli && (
              <button type="button" className="dugme dugme-ana" onClick={tamamla}>
                Muayeneyi tamamla
              </button>
            )}
          </div>
        </section>
        <aside className="panel yan" aria-labelledby="kontrol-baslik" aria-live="polite">
          <h2 id="kontrol-baslik">Kontroller</h2>
          {kontroller.map((k) => (
            <KontrolSatiri key={k.baslik} k={k} />
          ))}
        </aside>
      </div>

      {tutanakAcik && (
        <section className="belge-zemin" aria-label="Tutanak önizlemesi">
          <article className="belge genis-belge">
            <div className="belge-ust">
              <span>T.C.</span>
              <span>[İDARE ADI]</span>
            </div>
            <div className="belge-baslik">MUAYENE VE KABUL TUTANAĞI</div>
            <table className="belge-tablo">
              <tbody>
                <tr>
                  <th scope="row">İşin adı</th>
                  <td>{alim.konu}</td>
                </tr>
                <tr>
                  <th scope="row">Dosya</th>
                  <td>
                    {alim.id} · 4734 sayılı Kanun {alim.bent}
                  </td>
                </tr>
                <tr>
                  <th scope="row">Yüklenici</th>
                  <td>{tedarikci}</td>
                </tr>
                <tr>
                  <th scope="row">Fatura</th>
                  <td>{m.faturaNo ? `${m.faturaNo}${m.faturaTarihi ? `, ${uzunTarih(m.faturaTarihi)}` : ""}` : "…"}</td>
                </tr>
                <tr>
                  <th scope="row">Muayene tarihi ve yeri</th>
                  <td>
                    {m.muayeneTarihi ? uzunTarih(m.muayeneTarihi) : "…"}
                    {m.yer ? `, ${m.yer}` : ""}
                  </td>
                </tr>
              </tbody>
            </table>
            <table className="belge-tablo tutanak-tablo">
              <thead>
                <tr>
                  <th scope="col">Kalem</th>
                  <th scope="col">Fatura</th>
                  <th scope="col">Kabul</th>
                  <th scope="col">Tutar (TL)</th>
                </tr>
              </thead>
              <tbody>
                {m.kalemler.map((k) => (
                  <tr key={k.kalemId}>
                    <td>{k.ad}</td>
                    <td>
                      {miktar(k.faturaMiktari)} {k.birim}
                    </td>
                    <td>
                      {miktar(k.kabulMiktari)} {k.birim}
                    </td>
                    <td>{tlKurus(kabulTutari(k)).replace("₺", "")}</td>
                  </tr>
                ))}
                <tr>
                  <th scope="row" colSpan={3}>
                    Kabul edilen toplam, KDV hariç
                  </th>
                  <td className="kalin">{tlKurus(ozet.kabulToplami).replace("₺", "")}</td>
                </tr>
              </tbody>
            </table>
            <p>
              {ozet.kismi
                ? "Komisyonumuzca yapılan incelemede işin bir kısmının sipariş şartlarına uygun olarak tamamlanmadığı tespit edilmiş, yalnızca yukarıda miktarları gösterilen kısmın kabulüne karar verilmiştir."
                : "Komisyonumuzca yapılan incelemede işin sipariş şartlarına uygun olarak eksiksiz yapıldığı görülmüş ve kabulüne karar verilmiştir."}
            </p>
            <div className="belge-imzalar uc-imza">
              {m.uyeler.map((u, i) => (
                <div key={i}>
                  <span className="imza-bosluk" />
                  <span className="kalin">{u.ad || "…"}</span>
                  <span>
                    {u.unvan ? `${u.unvan} · ` : ""}
                    {u.rol === "baskan" ? "Başkan" : "Üye"}
                  </span>
                </div>
              ))}
            </div>
            <div className="belge-onay">
              <span className="kalin">ONAY</span>
              <span>…/…/{bugun().slice(0, 4)}</span>
              <span className="imza-bosluk" />
              <span>Harcama yetkilisi</span>
            </div>
          </article>
        </section>
      )}
    </div>
  );
}
