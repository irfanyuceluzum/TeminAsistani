import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { metinDosyasiKaydet } from "../../data/dosyaKaydet";
import { olayKaydet } from "../../data/olay";
import type { EvrakKaydi } from "../../domain/dosya";
import type { PiyasaArastirmasi } from "../../domain/piyasa";
import { csvOlustur, kikBildirimleri, yilAlimlari, yillar, yillikOzet } from "../../domain/raporlar";
import { ASAMA_ADI, asamaGrubu, bugun, tl, uzunTarih, yuzde } from "../bicim";
import type { Veri } from "../useVeri";

const AYLAR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
const AY_ADLARI = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const KOD_ADI: Record<string, string> = {
  "03.2": "Tüketime yönelik mal",
  "03.5": "Hizmet alımları",
  "03.7": "Menkul mal, bakım",
};

export function Raporlar() {
  const { depo, alimlar, tedarikciler, ayarlar, yenile } = useOutletContext<Veri>();
  const gun = bugun();
  const [yil, setYil] = useState(Number(gun.slice(0, 4)));
  const [piyasalar, setPiyasalar] = useState<PiyasaArastirmasi[]>([]);
  const [evraklar, setEvraklar] = useState<Record<string, Record<string, EvrakKaydi>>>({});
  const [arama, setArama] = useState("");
  const [uzerinde, setUzerinde] = useState<number | null>(null);
  const [mesaj, setMesaj] = useState<{ tur: "tamam" | "hata"; metin: string } | null>(null);

  const yukle = useCallback(async () => {
    const [p, e] = await Promise.all([depo.tumPiyasa(), depo.tumEvraklar()]);
    setPiyasalar(p);
    setEvraklar(e);
  }, [depo]);

  useEffect(() => {
    void yukle();
  }, [yukle, alimlar]);

  const ozet = useMemo(() => yillikOzet(alimlar, yil, ayarlar, piyasalar), [alimlar, yil, ayarlar, piyasalar]);
  const kik = useMemo(() => kikBildirimleri(alimlar, yil, evraklar, gun), [alimlar, yil, evraklar, gun]);
  const firmaAdi = (id: string | null) => tedarikciler.find((t) => t.id === id)?.ad ?? "";

  const q = arama.trim().toLocaleLowerCase("tr-TR");
  const liste = yilAlimlari(alimlar, yil)
    .filter((a) => !q || `${a.id} ${a.konu} ${firmaAdi(a.tedarikciId)}`.toLocaleLowerCase("tr-TR").includes(q))
    .sort((x, y) => y.onayTarihi.localeCompare(x.onayTarihi) || y.id.localeCompare(x.id));
  const enBuyukAy = Math.max(1, ...ozet.aylik.map((a) => a.tutar));
  // Eksen dört eşit aralığa bölünür; aralık 1, 2, 2,5 ya da 5'in onluk katlarından seçilir ki etiketler yuvarlak olsun.
  const kaba = enBuyukAy / 4;
  const basamak = 10 ** Math.floor(Math.log10(kaba));
  const aralik = ([1, 2, 2.5, 5, 10].find((c) => c * basamak >= kaba) ?? 10) * basamak;
  const olcekTavani = aralik * 4;
  const zirveAy = ozet.aylik.reduce((m, a) => (a.tutar > m.tutar ? a : m), ozet.aylik[0]);
  const bekleyenKik = kik.filter((k) => !k.bildirildi).length;

  async function listeyiAktar() {
    setMesaj(null);
    try {
      const icerik = csvOlustur(
        ["Dosya", "EKAP kayıt no", "Onay tarihi", "Konu", "Tedarikçi", "Ekonomik kod", "Tutar (KDV hariç, TL)", "Aşama"],
        liste.map((a) => [a.id, a.ekapKayitNo ?? "", uzunTarih(a.onayTarihi), a.konu, firmaAdi(a.tedarikciId), a.ekonomikKod, a.tutar / 100, ASAMA_ADI[a.asama]]),
      );
      if (await metinDosyasiKaydet(`dogrudan-temin-${yil}.csv`, icerik)) {
        setMesaj({ tur: "tamam", metin: `${liste.length} satır Excel dosyasına aktarıldı.` });
      }
    } catch (e) {
      setMesaj({ tur: "hata", metin: `Dosya kaydedilemedi. ${String(e)}` });
    }
  }

  async function kikAktar() {
    setMesaj(null);
    try {
      const icerik = csvOlustur(
        ["Dosya", "Onay tarihi", "Konu", "Tedarikçi", "Tutar (KDV hariç, TL)", "Son gün", "Bildirim durumu", "Bildirim tarihi"],
        kik.map((k) => [k.alim.id, uzunTarih(k.alim.onayTarihi), k.alim.konu, firmaAdi(k.alim.tedarikciId), k.alim.tutar / 100, uzunTarih(k.sonGun), k.bildirildi ? "Bildirildi" : k.gecikti ? "Gecikti" : "Bekliyor", k.tarih ? uzunTarih(k.tarih) : ""]),
      );
      if (await metinDosyasiKaydet(`kik-bildirimleri-${yil}.csv`, icerik)) setMesaj({ tur: "tamam", metin: `${kik.length} satır Excel dosyasına aktarıldı.` });
    } catch (e) {
      setMesaj({ tur: "hata", metin: `Dosya kaydedilemedi. ${String(e)}` });
    }
  }

  async function bildirildiIsaretle(alimId: string) {
    await depo.evrakKaydet(alimId, "kik-bildirimi", { tamam: true, tarih: gun, not: "Raporlar ekranından" });
    await olayKaydet(depo, ayarlar, alimId, "evrak", "KİK bildirimi: tamamlandı");
    await yenile();
    await yukle();
  }

  return (
    <div className="sayfa">
      <header className="sayfa-ust">
        <div>
          <h1>Raporlar</h1>
          <p className="soluk">Mali yıl {yil} · tutarlar KDV hariç</p>
        </div>
        <div className="satir">
          <label htmlFor="yil" className="gizli">
            Mali yıl
          </label>
          <select id="yil" className="girdi" value={yil} onChange={(e) => setYil(Number(e.target.value))}>
            {yillar(alimlar, Number(gun.slice(0, 4))).map((y) => (
              <option key={y} value={y}>
                Mali yıl {y}
              </option>
            ))}
          </select>
        </div>
      </header>

      {mesaj && (
        <div className={mesaj.tur === "tamam" ? "bant bant-bilgi" : "bant bant-hata"} role="status">
          {mesaj.metin}
        </div>
      )}

      <section className="kartlar" aria-label="Yıl özeti">
        <div className="kart">
          <span className="kart-etiket">Doğrudan temin toplamı</span>
          <span className="kart-deger">{tl(ozet.toplam)}</span>
          <span className="kart-not">{ozet.adet} alım</span>
        </div>
        <div className="kart">
          <span className="kart-etiket">22/d harcaması</span>
          <span className="kart-deger">{tl(ozet.ddToplam)}</span>
          <span className="kart-not">
            {ozet.ddAdet} alım{ozet.yuzdeOn ? ` · ödenek oranı ${yuzde(ozet.yuzdeOn.oran)}` : ""}
          </span>
        </div>
        <div className="kart">
          <span className="kart-etiket">KİK bildirimi bekleyen</span>
          <span className="kart-deger">{bekleyenKik}</span>
          <span className={bekleyenKik ? "kart-not uyari-yazi" : "kart-not"}>{kik.length} bildirilecek alımdan</span>
        </div>
        <div className="kart">
          <span className="kart-etiket">Alım başına teklif</span>
          <span className="kart-deger">{ozet.ortalamaTeklif === null ? "—" : ozet.ortalamaTeklif.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}</span>
          <span className="kart-not">Tamamlanan 22/d araştırmalarında</span>
        </div>
      </section>

      <div className="iki-sutun">
        <section className="panel genis-panel" aria-labelledby="aylik-baslik">
          <div className="panel-baslik-satiri">
            <h2 id="aylik-baslik">Aylık 22/d harcaması</h2>
            <span className="soluk kucuk">Onay tarihine göre</span>
          </div>
          <div className="grafik">
            <div className="grafik-eksen" aria-hidden="true">
              {[1, 0.75, 0.5, 0.25, 0].map((o) => (
                <span key={o}>{o === 0 ? "0" : `₺${Math.round((olcekTavani * o) / 100_000)} B`}</span>
              ))}
            </div>
            <div className="grafik-alan">
              <div className="grafik-cizgiler" aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
              <div className="grafik-sutunlar" role="img" aria-label={`Aylık 22/d harcaması. En yüksek ay ${AY_ADLARI[zirveAy.ay - 1]}, ${tl(zirveAy.tutar)}.`}>
                {ozet.aylik.map((a, i) => (
                  <div key={a.ay} className="grafik-sutun" onMouseEnter={() => setUzerinde(i)} onMouseLeave={() => setUzerinde(null)}>
                    <div className="grafik-cubuk-alani">
                      {a.tutar > 0 && a === zirveAy && uzerinde === null && <span className="grafik-etiket mono">₺{Math.round(a.tutar / 100_000)} B</span>}
                      <div
                        className={uzerinde === null || uzerinde === i ? "grafik-cubuk" : "grafik-cubuk soluk-cubuk"}
                        style={{ height: `${(a.tutar / olcekTavani) * 100}%` }}
                      />
                      {uzerinde === i && a.tutar > 0 && (
                        <div className="grafik-ipucu">
                          <span>
                            {AY_ADLARI[i]} {yil}
                          </span>
                          <span className="mono kalin">{tl(a.tutar)}</span>
                          <span>{a.adet} alım</span>
                        </div>
                      )}
                    </div>
                    <span className="grafik-ay">{AYLAR[i]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="panel yan" aria-labelledby="dagilim-baslik">
          <h2 id="dagilim-baslik">Ekonomik koda göre</h2>
          {ozet.ekonomikKodlar.length === 0 && <p className="soluk kucuk">Bu yıl alım yok.</p>}
          {ozet.ekonomikKodlar.length > 0 && (
            <div className="sutun">
              {ozet.ekonomikKodlar.map((k) => (
                <div key={k.kod} className="kod-ust">
                  <span>
                    {k.kod} {KOD_ADI[k.kod] ?? "Diğer"}
                  </span>
                  <span className="mono">{tl(k.tutar)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="panel bosluksuz" aria-labelledby="kik-baslik">
        <div className="panel-ust">
          <div>
            <h2 id="kik-baslik">KİK bildirimleri</h2>
            <span className="soluk kucuk">Siparişi verilen tüm doğrudan teminler. Sonuç, alım ayını izleyen ayın 10'una kadar EKAP'tan bildirilir.</span>
          </div>
          <button type="button" className="dugme kucuk-dugme" onClick={kikAktar} disabled={kik.length === 0}>
            Excel'e aktar
          </button>
        </div>
        {kik.length === 0 ? (
          <p className="soluk bos">Bu yıl bildirilecek alım yok.</p>
        ) : (
          <div className="tablo-kutu">
            <table>
              <thead>
                <tr>
                  <th scope="col">Dosya</th>
                  <th scope="col">Konu</th>
                  <th scope="col" className="sag">
                    Tutar
                  </th>
                  <th scope="col">Son gün</th>
                  <th scope="col">Durum</th>
                  <th scope="col">Bildirim</th>
                </tr>
              </thead>
              <tbody>
                {kik.map((k) => (
                  <tr key={k.alim.id}>
                    <td className="mono">
                      <Link to={`/dosyalar/${k.alim.id}`}>{k.alim.id}</Link>
                    </td>
                    <td>{k.alim.konu}</td>
                    <td className="mono sag">{tl(k.alim.tutar)}</td>
                    <td className={k.gecikti ? "mono hata-yazi" : "mono soluk"}>{uzunTarih(k.sonGun)}</td>
                    <td>
                      <span className={k.bildirildi ? "etiket etiket-Teslim" : k.gecikti ? "etiket etiket-gecikti" : "etiket etiket-Ödeme"}>
                        {k.bildirildi ? "Bildirildi" : k.gecikti ? "Gecikti" : "Bekliyor"}
                      </span>
                    </td>
                    <td>
                      {k.bildirildi ? (
                        <span className="mono soluk">{k.tarih ? uzunTarih(k.tarih) : ""}</span>
                      ) : (
                        <button type="button" className="metin-dugme" onClick={() => bildirildiIsaretle(k.alim.id)}>
                          Bildirildi olarak işaretle
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel bosluksuz" aria-labelledby="liste-baslik">
        <div className="panel-ust">
          <h2 id="liste-baslik">Yıllık doğrudan temin listesi</h2>
          <div className="satir">
            <label htmlFor="liste-ara" className="gizli">
              Dosya, konu veya firma ara
            </label>
            <input id="liste-ara" className="girdi" type="search" value={arama} onChange={(e) => setArama(e.target.value)} placeholder="Ara" />
            <button type="button" className="dugme kucuk-dugme dugme-ana" onClick={listeyiAktar} disabled={liste.length === 0}>
              Excel'e aktar
            </button>
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
              {liste.map((a) => (
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
              {liste.length === 0 && (
                <tr>
                  <td colSpan={6} className="soluk bos">
                    Bu süzgeçle eşleşen alım yok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="liste-alti soluk kucuk">
          {liste.length} kayıt · toplam {tl(liste.reduce((s, a) => s + a.tutar, 0))}
        </div>
      </section>
    </div>
  );
}
