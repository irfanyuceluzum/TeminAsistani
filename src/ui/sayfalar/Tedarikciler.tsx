import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { eskiEkranBasamagi } from "../../domain/basamaklar";
import type { PiyasaArastirmasi } from "../../domain/piyasa";
import {
  bilgiEksik,
  firmaGecmisi,
  firmaKimligi,
  ibanBicimle,
  SORGU_ESKIME_GUNU,
  sorguYasi,
  tedarikciHatalari,
  type TeklifSonucu,
} from "../../domain/tedarikci";
import type { Tedarikci } from "../../domain/tipler";
import { bugun, tl, uzunTarih } from "../bicim";
import type { Veri } from "../useVeri";

type Filtre = "Tümü" | "Sorgu gerekli" | "Bilgi eksik";

const SONUC: Record<TeklifSonucu, [string, string]> = {
  kazandi: ["Kazandı", "etiket etiket-Teslim"],
  kaybetti: ["Kaybetti", "etiket etiket-Kapalı"],
  suruyor: ["Değerlendiriliyor", "etiket etiket-Hazırlık"],
};

const BOS_FORM: Tedarikci = { id: "", ad: "", kategori: "", vkn: "", vergiDairesi: "", telefon: "", eposta: "", iban: "", adres: "" };

function bas(ad: string): string {
  return ad
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((k) => k[0].toLocaleUpperCase("tr-TR"))
    .join("");
}

export function Tedarikciler() {
  const { tedarikciId } = useParams();
  const { depo, alimlar, tedarikciler, yenile } = useOutletContext<Veri>();
  const navigate = useNavigate();
  const gun = bugun();

  const [piyasalar, setPiyasalar] = useState<PiyasaArastirmasi[]>([]);
  const [arama, setArama] = useState("");
  const [filtre, setFiltre] = useState<Filtre>("Tümü");
  const [form, setForm] = useState<Tedarikci | null>(null);
  const [hatalar, setHatalar] = useState<string[]>([]);

  useEffect(() => {
    let iptal = false;
    depo.tumPiyasa().then((p) => {
      if (!iptal) setPiyasalar(p);
    });
    return () => {
      iptal = true;
    };
  }, [depo, alimlar]);

  const gecmisler = useMemo(() => new Map(tedarikciler.map((t) => [t.id, firmaGecmisi(t.id, piyasalar, alimlar)])), [tedarikciler, piyasalar, alimlar]);
  const sorguGerekli = (t: Tedarikci) => {
    const yas = sorguYasi(gecmisler.get(t.id)?.sonSorgu ?? null, gun);
    return yas === null || yas > SORGU_ESKIME_GUNU;
  };

  const q = arama.trim().toLocaleLowerCase("tr-TR");
  const liste = tedarikciler
    .filter((t) => !q || `${t.ad} ${t.kategori} ${t.vkn ?? ""}`.toLocaleLowerCase("tr-TR").includes(q))
    .filter((t) => filtre === "Tümü" || (filtre === "Sorgu gerekli" ? sorguGerekli(t) : bilgiEksik(t)));

  const secili = tedarikciler.find((t) => t.id === tedarikciId) ?? (form ? null : liste[0] ?? null);
  const gecmis = secili ? gecmisler.get(secili.id) : undefined;
  const yas = gecmis ? sorguYasi(gecmis.sonSorgu, gun) : null;

  function duzenle(t: Tedarikci) {
    setForm({ ...BOS_FORM, ...t });
    setHatalar([]);
  }

  async function kaydet() {
    if (!form) return;
    const yeni = !form.id;
    const kayit: Tedarikci = {
      ...form,
      id: yeni ? firmaKimligi(form.ad, tedarikciler.map((t) => t.id)) : form.id,
      ad: form.ad.trim(),
      kategori: form.kategori.trim(),
      vkn: form.vkn?.trim(),
      iban: form.iban ? ibanBicimle(form.iban) : "",
      eposta: form.eposta?.trim(),
    };
    const h = tedarikciHatalari(kayit, tedarikciler);
    setHatalar(h);
    if (h.length) return;
    try {
      if (yeni) await depo.tedarikciEkle(kayit);
      else await depo.tedarikciGuncelle(kayit);
      await yenile();
      setForm(null);
      navigate(`/tedarikciler/${kayit.id}`);
    } catch (e) {
      setHatalar([`Firma kaydedilemedi. ${String(e)}`]);
    }
  }

  const alan = (k: keyof Tedarikci, etiket: string, yer: string, sinif = "") => (
    <div className={`alan ${sinif}`}>
      <label htmlFor={`f-${k}`}>{etiket}</label>
      <input id={`f-${k}`} className={k === "vkn" || k === "iban" ? "mono" : undefined} value={form?.[k] ?? ""} onChange={(e) => form && setForm({ ...form, [k]: e.target.value })} placeholder={yer} />
    </div>
  );

  return (
    <div className="sayfa">
      <header className="sayfa-ust">
        <div>
          <h1>Tedarikçiler</h1>
          <p className="soluk">
            {tedarikciler.length} firma · {[...gecmisler.values()].reduce((s, g) => s + g.teklifSayisi, 0)} teklif
          </p>
        </div>
        <button type="button" className="dugme dugme-ana" onClick={() => duzenle(BOS_FORM)}>
          Firma ekle
        </button>
      </header>

      <div className="iki-sutun">
        <section className="panel bosluksuz firma-listesi" aria-labelledby="liste-baslik">
          <div className="liste-ust">
            <h2 id="liste-baslik">Firma listesi</h2>
            <label htmlFor="firma-ara" className="gizli">
              Firma adı, kategori veya vergi numarası ara
            </label>
            <input id="firma-ara" className="girdi" type="search" value={arama} onChange={(e) => setArama(e.target.value)} placeholder="Toros, temizlik, 1234567890" />
            <div className="filtreler" role="group" aria-label="Süz">
              {(["Tümü", "Sorgu gerekli", "Bilgi eksik"] as Filtre[]).map((f) => (
                <button key={f} type="button" className="filtre" aria-pressed={filtre === f} onClick={() => setFiltre(f)}>
                  {f}
                </button>
              ))}
            </div>
          </div>
          <ul className="firma-satirlari">
            {liste.map((t) => {
              const uyari = sorguGerekli(t) ? "Sorgu gerekli" : bilgiEksik(t) ? "Bilgi eksik" : null;
              return (
                <li key={t.id}>
                  <Link to={`/tedarikciler/${t.id}`} className={secili?.id === t.id && !form ? "firma-satiri secili" : "firma-satiri"} onClick={() => setForm(null)}>
                    <span className="firma-bas" aria-hidden="true">
                      {bas(t.ad)}
                    </span>
                    <span className="firma-satir-metin">
                      <span className="kalin">{t.ad}</span>
                      <span className="soluk kucuk">{t.kategori || "Kategori girilmemiş"}</span>
                    </span>
                    {uyari && <span className="etiket etiket-Ödeme">{uyari}</span>}
                  </Link>
                </li>
              );
            })}
            {liste.length === 0 && <li className="soluk bos">Aramaya uyan firma yok. Aramayı ya da süzgeci değiştirin.</li>}
          </ul>
        </section>

        <div className="genis-panel sutun">
          {form ? (
            <section className="panel" aria-labelledby="form-baslik">
              <h2 id="form-baslik">{form.id ? `${form.ad} · düzenle` : "Yeni firma"}</h2>
              <div className="form-izgara">
                {alan("ad", "Firma adı", "Toros Temizlik AŞ", "tam")}
                {alan("kategori", "Kategori", "Temizlik malzemesi")}
                {alan("vkn", "Vergi kimlik numarası", "1234567890")}
                {alan("vergiDairesi", "Vergi dairesi", "Çankaya")}
                {alan("telefon", "Telefon", "0312 000 00 00")}
                {alan("eposta", "E-posta", "teklif@firma.com.tr")}
                {alan("iban", "IBAN", "TR00 0000 0000 0000 0000 0000 00", "tam")}
                {alan("adres", "Adres", "Mahalle, cadde, ilçe, il", "tam")}
              </div>
              {hatalar.length > 0 && (
                <ul className="hata-listesi" role="alert">
                  {hatalar.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              )}
              <div className="satir sag-hizali">
                <button type="button" className="dugme" onClick={() => setForm(null)}>
                  Vazgeç
                </button>
                <button type="button" className="dugme dugme-ana" onClick={kaydet}>
                  {form.id ? "Değişiklikleri kaydet" : "Firmayı kaydet"}
                </button>
              </div>
            </section>
          ) : secili && gecmis ? (
            <>
              <section className="panel" aria-labelledby="firma-baslik">
                <div className="panel-baslik-satiri">
                  <div className="firma-ust-bilgi">
                    <span className="firma-bas buyuk" aria-hidden="true">
                      {bas(secili.ad)}
                    </span>
                    <div>
                      <h2 id="firma-baslik" className="firma-adi">
                        {secili.ad}
                      </h2>
                      <span className="soluk kucuk">
                        {secili.vkn ? <span className="mono">VKN {secili.vkn}</span> : "VKN girilmemiş"}
                        {secili.vergiDairesi ? ` · ${secili.vergiDairesi} VD` : ""}
                        {secili.kategori ? ` · ${secili.kategori}` : ""}
                      </span>
                    </div>
                  </div>
                  <button type="button" className="dugme kucuk-dugme" onClick={() => duzenle(secili)}>
                    Düzenle
                  </button>
                </div>
                <div className="bilgi-izgarasi">
                  {(
                    [
                      ["Telefon", secili.telefon],
                      ["E-posta", secili.eposta],
                      ["IBAN", secili.iban ? ibanBicimle(secili.iban) : ""],
                      ["Adres", secili.adres],
                    ] as [string, string | undefined][]
                  ).map(([ad, deger]) => (
                    <div key={ad} className="bilgi">
                      <span className="soluk kucuk">{ad}</span>
                      <span className={ad === "IBAN" ? "mono" : undefined}>{deger || <span className="uyari-yazi kucuk">Girilmemiş</span>}</span>
                    </div>
                  ))}
                </div>
              </section>

              {(yas === null || yas > SORGU_ESKIME_GUNU) && (
                <div className="bant bant-uyari" role="status">
                  {yas === null
                    ? "Bu firma için kayıtlı yasaklılık sorgusu yok. Teklif istemeden önce EKAP'ta sorgulayın."
                    : `Son yasaklılık sorgusu ${yas} gün önce yapıldı. Yeni alımda sorguyu yenileyin.`}
                </div>
              )}

              <section className="kartlar" aria-label="Firma özeti">
                <div className="kart">
                  <span className="kart-etiket">Teklif</span>
                  <span className="kart-deger">{gecmis.teklifSayisi}</span>
                </div>
                <div className="kart">
                  <span className="kart-etiket">Kazanılan</span>
                  <span className="kart-deger">{gecmis.kazanilan}</span>
                </div>
                <div className="kart">
                  <span className="kart-etiket">Kazanma oranı</span>
                  <span className="kart-deger">
                    {gecmis.teklifSayisi ? `%${Math.round((gecmis.kazanilan / gecmis.teklifSayisi) * 100)}` : "—"}
                  </span>
                </div>
                <div className="kart">
                  <span className="kart-etiket">Sipariş toplamı</span>
                  <span className="kart-deger">{tl(gecmis.siparisToplami)}</span>
                </div>
              </section>

              <section className="panel bosluksuz" aria-labelledby="teklif-baslik">
                <div className="panel-ust">
                  <h2 id="teklif-baslik">Geçmiş teklifler</h2>
                  <span className="soluk kucuk">KDV hariç · piyasa araştırmalarından</span>
                </div>
                {gecmis.teklifler.length === 0 ? (
                  <p className="soluk bos">Bu firmanın kayıtlı teklifi yok.</p>
                ) : (
                  <div className="tablo-kutu">
                    <table>
                      <thead>
                        <tr>
                          <th scope="col">Dosya</th>
                          <th scope="col">Konu</th>
                          <th scope="col">Tarih</th>
                          <th scope="col" className="sag">
                            Teklif
                          </th>
                          <th scope="col">Sonuç</th>
                          <th scope="col" className="sag">
                            En düşüğe fark
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {gecmis.teklifler.map((t) => (
                          <tr key={t.alimId}>
                            <td className="mono">
                              <Link to={`/dosyalar/${t.alimId}`}>{t.alimId}</Link>
                            </td>
                            <td>{t.konu}</td>
                            <td className="mono soluk">{t.tarih ? uzunTarih(t.tarih) : "—"}</td>
                            <td className="mono sag">{t.toplam === null ? <span className="soluk">eksik fiyat</span> : tl(t.toplam)}</td>
                            <td>
                              <span className={SONUC[t.sonuc][1]}>{SONUC[t.sonuc][0]}</span>
                            </td>
                            <td className="mono sag soluk">
                              {t.fark === null ? "—" : `+%${(t.fark * 100).toLocaleString("tr-TR", { maximumFractionDigits: 1 })}`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className="panel" aria-labelledby="sorgu-baslik">
                <h2 id="sorgu-baslik">Yasaklılık sorgu geçmişi</h2>
                {gecmis.sorgular.length === 0 ? (
                  <p className="soluk kucuk">Kayıtlı sorgu yok. Sorgular piyasa araştırması ekranında işaretlenir.</p>
                ) : (
                  <ol className="iz-listesi">
                    {gecmis.sorgular.map((s) => (
                      <li key={`${s.alimId}-${s.tarih}`} className="sorgu-satiri">
                        <span className="evrak-isaret sorgu-isaret" aria-hidden="true">
                          ✓
                        </span>
                        <span className="sutun-dar">
                          <span className="blok">Yasaklı değil</span>
                          <span className="soluk kucuk">
                            <span className="mono">{uzunTarih(s.tarih)}</span> ·{" "}
                            <Link to={`/dosyalar/${s.alimId}/basamak/${eskiEkranBasamagi("piyasa")}`} className="mono">
                              {s.alimId}
                            </Link>
                          </span>
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </>
          ) : (
            <section className="panel">
              <p className="soluk">Listeden bir firma seçin ya da yeni firma ekleyin.</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
