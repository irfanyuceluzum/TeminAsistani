import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { olayKaydet } from "../../data/olay";
import { evrakDurumlari, type EvrakKaydi } from "../../domain/dosya";
import {
  ekListesi,
  odemeHesabi,
  odemeKontrolleri,
  odemeOlustur,
  TEVKIFAT_TURLERI,
  tevkifatTuru,
  type BorcSorgusu,
  type Odeme,
  type SorguDurumu,
} from "../../domain/odeme";
import type { PiyasaArastirmasi } from "../../domain/piyasa";
import { engelVarMi, tutarCoz } from "../../domain/sihirbaz";
import { bugun, tlKurus } from "../bicim";
import { KontrolSatiri } from "../KontrolSatiri";
import type { Veri } from "../useVeri";

type KayitDurumu = "kayitli" | "bekliyor" | "kaydediliyor" | "hata";
type SorguAlani = "vergiSorgusu" | "sgkSorgusu";

const SORGU_DURUMLARI: [SorguDurumu, string][] = [
  ["yapilmadi", "Yapılmadı"],
  ["borcsuz", "Borcu yok"],
  ["borclu", "Borçlu"],
  ["gerekmiyor", "Gerekmiyor"],
];

function binde(yuzBinde: number): string {
  return "binde " + (yuzBinde / 100).toLocaleString("tr-TR", { minimumFractionDigits: 2 });
}

export function OdemeSayfasi() {
  const { alimId = "" } = useParams();
  const { depo, alimlar, tedarikciler, ayarlar, yenile } = useOutletContext<Veri>();
  const navigate = useNavigate();
  const alim = alimlar.find((a) => a.id === alimId);

  const [o, setO] = useState<Odeme | null>(null);
  const [evrakKayitlari, setEvrakKayitlari] = useState<Record<string, EvrakKaydi>>({});
  const [piyasa, setPiyasa] = useState<PiyasaArastirmasi | null>(null);
  const [borcMetni, setBorcMetni] = useState<Record<SorguAlani, string>>({ vergiSorgusu: "", sgkSorgusu: "" });
  const [kayit, setKayit] = useState<KayitDurumu>("kayitli");
  const [kopyalanan, setKopyalanan] = useState("");
  const [mesaj, setMesaj] = useState("");
  const yuklendi = useRef(false);
  const alimRef = useRef(alim);
  alimRef.current = alim;

  useEffect(() => {
    let iptal = false;
    yuklendi.current = false;
    (async () => {
      const [kayitli, evraklar, p] = await Promise.all([depo.odemeGetir(alimId), depo.evraklar(alimId), depo.piyasaGetir(alimId)]);
      const a = alimRef.current;
      if (iptal || !a) return;
      const ilk = kayitli ?? odemeOlustur(a);
      const yaz = (s: BorcSorgusu) => (s.borc ? (s.borc / 100).toLocaleString("tr-TR", { minimumFractionDigits: 2 }) : "");
      setBorcMetni({ vergiSorgusu: yaz(ilk.vergiSorgusu), sgkSorgusu: yaz(ilk.sgkSorgusu) });
      setEvrakKayitlari(evraklar);
      setPiyasa(p);
      setO(ilk);
    })();
    return () => {
      iptal = true;
    };
  }, [depo, alimId]);

  useEffect(() => {
    if (!o) return;
    if (!yuklendi.current) {
      yuklendi.current = true;
      return;
    }
    setKayit("bekliyor");
    const zaman = setTimeout(async () => {
      setKayit("kaydediliyor");
      try {
        await depo.odemeKaydet(o);
        setKayit("kayitli");
      } catch {
        setKayit("hata");
      }
    }, 500);
    return () => clearTimeout(zaman);
  }, [o, depo]);

  const hesap = useMemo(() => (o && alim ? odemeHesabi(alim.tutar, o, ayarlar) : null), [o, alim, ayarlar]);
  const ekler = useMemo(() => (o && alim ? ekListesi(evrakDurumlari(alim, evrakKayitlari, piyasa), o) : []), [o, alim, evrakKayitlari, piyasa]);
  const kontroller = useMemo(() => (o && hesap ? odemeKontrolleri(o, hesap, ekler, ayarlar) : []), [o, hesap, ekler, ayarlar]);

  if (!alim) {
    return (
      <div className="sayfa">
        <div className="bant bant-hata" role="alert">
          {alimId} numaralı dosya bulunamadı. <Link to="/dosyalar">Dosya listesine dönün.</Link>
        </div>
      </div>
    );
  }
  if (!o || !hesap) return <p className="soluk">Ödeme yükleniyor…</p>;

  const kilitli = o.tamamlandi;
  const tedarikci = tedarikciler.find((t) => t.id === alim.tedarikciId)?.ad ?? "[Yüklenici]";
  const tevkifat = tevkifatTuru(o.tevkifatTuru);

  function guncelle(d: Partial<Odeme>) {
    setMesaj("");
    setO((x) => (x ? { ...x, ...d } : x));
  }

  function sorguDegistir(alan: SorguAlani, d: Partial<BorcSorgusu>) {
    setMesaj("");
    setO((x) => (x ? { ...x, [alan]: { ...x[alan], ...d } } : x));
  }

  async function kopyala(ad: string, deger: string) {
    try {
      await navigator.clipboard.writeText(deger);
      setKopyalanan(ad);
    } catch {
      setMesaj("Panoya kopyalanamadı. Değeri elle seçip kopyalayın.");
    }
  }

  const aciklama = `${alim.id} dosyası, 4734 sayılı Kanun ${alim.bent} kapsamında doğrudan teminle alınan ${alim.konu.toLocaleLowerCase("tr-TR")} bedeli. ${tedarikci}.${
    hesap.vergiMahsubu + hesap.sgkMahsubu > 0 ? " Kamu borcu ödemeden mahsup edilmiştir." : ""
  }`;

  const kbsAlanlari: [string, string][] = [
    ["Ekonomik kod", alim.ekonomikKod],
    ["Alacaklı", tedarikci],
    ["Brüt tutar, KDV dahil", tlKurus(hesap.brut).replace("₺", "")],
    ["KDV tevkifatı", tlKurus(hesap.tevkifat).replace("₺", "")],
    ["Damga vergisi", tlKurus(hesap.damga.toplam).replace("₺", "")],
    ["Net ödeme", tlKurus(hesap.yukleniciye).replace("₺", "")],
  ];

  async function tamamla() {
    if (!o || !hesap || !alim) return;
    if (engelVarMi(kontroller)) {
      setMesaj("Kırmızı işaretli kontroller çözülmeden ödeme emri tamamlanamaz.");
      return;
    }
    if (!o.oebNo.trim()) {
      setMesaj("KBS'de oluşturulan ödeme emri belgesinin numarasını girin.");
      return;
    }
    try {
      const gun = bugun();
      await depo.odemeKaydet({ ...o, tamamlandi: true });
      const sorguNotu = [o.vergiSorgusu, o.sgkSorgusu].some((s) => s.durum === "borclu") ? "Borç mahsup edildi" : "Borç yok";
      await depo.evrakKaydet(alimId, "borc-sorgusu", { tamam: true, tarih: gun, not: sorguNotu });
      await depo.evrakKaydet(alimId, "odeme-emri", { tamam: true, tarih: gun, not: `ÖEB ${o.oebNo.trim()}` });
      // KİK bildirimi gibi ödeme sonrası evrak kaldıysa dosya ödeme aşamasında kalır.
      const guncel = await depo.evraklar(alimId);
      const kalan = evrakDurumlari(alim, guncel, piyasa).filter((e) => !e.tamam);
      const kapat = kalan.length === 0;
      if (kapat) await depo.alimGuncelle(alimId, { asama: "tamamlandi", sonIslem: gun });
      else await depo.alimGuncelle(alimId, { sonIslem: gun });
      await olayKaydet(
        depo,
        ayarlar,
        alimId,
        kapat ? "asama:tamamlandi" : "odeme",
        `Ödeme emri düzenlendi (ÖEB ${o.oebNo.trim()}): yükleniciye ${tlKurus(hesap.yukleniciye)}${kapat ? ", dosya kapatıldı" : `, kalan evrak: ${kalan.map((e) => e.ad).join(", ")}`}`,
      );
      await yenile();
      navigate(`/dosyalar/${alimId}`);
    } catch (e) {
      setMesaj(`Ödeme kaydedilemedi. ${String(e)}`);
    }
  }

  const kayitYazisi = { kayitli: "Kaydedildi", bekliyor: "Değişiklik var", kaydediliyor: "Kaydediliyor…", hata: "Kaydedilemedi" }[kayit];

  return (
    <div className="sayfa">
      <header className="sayfa-ust">
        <div>
          <Link to={`/dosyalar/${alim.id}`} className="kucuk mono">
            {alim.id} · {alim.konu}
          </Link>
          <h1>Ödeme</h1>
          <p className="soluk">
            {tedarikci} · kabul edilen {tlKurus(alim.tutar)} + KDV
          </p>
        </div>
        <span className={kayit === "hata" ? "kayit-durumu hata-yazi" : "kayit-durumu soluk"} role="status">
          {kayitYazisi}
        </span>
      </header>

      {kilitli && <div className="bant bant-bilgi">Ödeme emri düzenlendi. Bilgiler değiştirilemez.</div>}

      <fieldset className="kilit" disabled={kilitli}>
        <div className="iki-sutun">
          <section className="panel genis-panel" aria-labelledby="hesap-baslik">
            <h2 id="hesap-baslik">Ödeme hesabı</h2>
            <div className="form-izgara">
              <div className="alan">
                <label htmlFor="kdv">KDV oranı</label>
                <select id="kdv" value={o.kdvOrani} onChange={(e) => guncelle({ kdvOrani: Number(e.target.value) })}>
                  {[0, 1, 10, 20].map((v) => (
                    <option key={v} value={v}>
                      %{v}
                    </option>
                  ))}
                </select>
              </div>
              <div className="alan">
                <label htmlFor="tevkifat">KDV tevkifatı</label>
                <select id="tevkifat" value={o.tevkifatTuru} onChange={(e) => guncelle({ tevkifatTuru: e.target.value })}>
                  {TEVKIFAT_TURLERI.map((t) => (
                    <option key={t.kod} value={t.kod}>
                      {t.pay > 0 ? `${t.pay}/${t.payda} · ` : ""}
                      {t.ad}
                    </option>
                  ))}
                </select>
              </div>
              <label className="onay-kutusu">
                <input type="checkbox" checked={o.sozlesmeVar} onChange={(e) => guncelle({ sozlesmeVar: e.target.checked })} />
                Yazılı sözleşme imzalandı
              </label>
              <label className="onay-kutusu">
                <input type="checkbox" checked={o.komisyonKarariVar} onChange={(e) => guncelle({ komisyonKarariVar: e.target.checked })} />
                Komisyon kararı alındı
              </label>
            </div>
            <dl className="dokum">
              <div>
                <dt>Kabul edilen tutar, KDV hariç</dt>
                <dd className="mono">{tlKurus(hesap.matrah)}</dd>
              </div>
              <div>
                <dt>KDV %{o.kdvOrani}</dt>
                <dd className="mono">{tlKurus(hesap.kdv)}</dd>
              </div>
              <div className="dokum-ara">
                <dt>Brüt, KDV dahil</dt>
                <dd className="mono">{tlKurus(hesap.brut)}</dd>
              </div>
              {tevkifat.pay > 0 && (
                <div>
                  <dt>
                    KDV tevkifatı {tevkifat.pay}/{tevkifat.payda}
                    <span className="soluk kucuk blok">{hesap.tevkifatUygulandi ? tevkifat.ad : "Sınırın altında, uygulanmadı"}</span>
                  </dt>
                  <dd className="mono">−{tlKurus(hesap.tevkifat)}</dd>
                </div>
              )}
              <div>
                <dt>
                  Damga vergisi, makbuz
                  <span className="soluk kucuk blok">{binde(ayarlar.damga.makbuzOrani)}</span>
                </dt>
                <dd className="mono">−{tlKurus(hesap.damga.makbuz)}</dd>
              </div>
              {hesap.damga.sozlesme > 0 && (
                <div>
                  <dt>Damga vergisi, sözleşme</dt>
                  <dd className="mono">−{tlKurus(hesap.damga.sozlesme)}</dd>
                </div>
              )}
              {hesap.damga.karar > 0 && (
                <div>
                  <dt>Damga vergisi, karar pulu</dt>
                  <dd className="mono">−{tlKurus(hesap.damga.karar)}</dd>
                </div>
              )}
              {hesap.vergiMahsubu > 0 && (
                <div className="dokum-uyari">
                  <dt>Vergi borcu mahsubu</dt>
                  <dd className="mono">−{tlKurus(hesap.vergiMahsubu)}</dd>
                </div>
              )}
              {hesap.sgkMahsubu > 0 && (
                <div className="dokum-uyari">
                  <dt>SGK borcu mahsubu</dt>
                  <dd className="mono">−{tlKurus(hesap.sgkMahsubu)}</dd>
                </div>
              )}
              <div className="dokum-son">
                <dt>Yükleniciye ödenecek</dt>
                <dd className="mono">{tlKurus(hesap.yukleniciye)}</dd>
              </div>
            </dl>
            <div className="kutular">
              <div className="kutu kutu-vurgu">
                <span className="kucuk">Yükleniciye</span>
                <span className="mono kutu-deger">{tlKurus(hesap.yukleniciye)}</span>
              </div>
              <div className="kutu">
                <span className="kucuk soluk">Vergi dairesine</span>
                <span className="mono kutu-deger">{tlKurus(hesap.vergiDairesine)}</span>
              </div>
              {hesap.sgkya > 0 && (
                <div className="kutu kutu-uyari">
                  <span className="kucuk">SGK'ya</span>
                  <span className="mono kutu-deger">{tlKurus(hesap.sgkya)}</span>
                </div>
              )}
            </div>
          </section>

          <section className="panel yan" aria-labelledby="borc-baslik">
            <h2 id="borc-baslik">Borç sorguları</h2>
            <p className="soluk kucuk">GİB ve SGK sorgularını yapıp sonucu işaretleyin. Sorgu sınırının altındaki ödemelerde "Gerekmiyor" seçilebilir.</p>
            {(
              [
                ["vergiSorgusu", "Vergi borcu"],
                ["sgkSorgusu", "SGK borcu"],
              ] as [SorguAlani, string][]
            ).map(([alan, ad]) => {
              const s = o[alan];
              return (
                <div key={alan} className="sorgu-blok">
                  <span className="kalin" id={`${alan}-baslik`}>
                    {ad}
                  </span>
                  <div className="bolumlu sarmali" role="radiogroup" aria-labelledby={`${alan}-baslik`}>
                    {SORGU_DURUMLARI.map(([d, etiket]) => (
                      <button key={d} type="button" role="radio" aria-checked={s.durum === d} onClick={() => sorguDegistir(alan, { durum: d, tarih: s.tarih || (d === "borcsuz" || d === "borclu" ? bugun() : "") })}>
                        {etiket}
                      </button>
                    ))}
                  </div>
                  {(s.durum === "borcsuz" || s.durum === "borclu") && (
                    <div className="form-izgara">
                      <div className="alan">
                        <label htmlFor={`${alan}-tarih`}>Sorgu tarihi</label>
                        <input id={`${alan}-tarih`} type="date" value={s.tarih} onChange={(e) => sorguDegistir(alan, { tarih: e.target.value })} />
                      </div>
                      <div className="alan">
                        <label htmlFor={`${alan}-no`}>Belge numarası</label>
                        <input id={`${alan}-no`} className="mono" value={s.belgeNo} onChange={(e) => sorguDegistir(alan, { belgeNo: e.target.value })} />
                      </div>
                      {s.durum === "borclu" && (
                        <div className="alan tam">
                          <label htmlFor={`${alan}-borc`}>Borç tutarı, TL</label>
                          <input
                            id={`${alan}-borc`}
                            className="mono"
                            inputMode="decimal"
                            value={borcMetni[alan]}
                            aria-invalid={borcMetni[alan].trim() !== "" && tutarCoz(borcMetni[alan]) === null}
                            onChange={(e) => {
                              setBorcMetni((b) => ({ ...b, [alan]: e.target.value }));
                              sorguDegistir(alan, { borc: tutarCoz(e.target.value) ?? 0 });
                            }}
                            placeholder="4.250,00"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        </div>

        <div className="iki-sutun">
          <section className="panel bosluksuz ek-paneli" aria-labelledby="ek-baslik">
            <div className="panel-ust">
              <h2 id="ek-baslik">Ödeme emri eki listesi</h2>
              <span className="soluk kucuk">{alim.bent}, doğrudan temin</span>
            </div>
            <ol className="evrak-listesi">
              {ekler.map((e, i) => (
                <li key={e.ad} className={e.tamam ? "evrak evrak-tamam" : "evrak"}>
                  <span className="mono soluk sira">{i + 1}</span>
                  <span className="evrak-isaret" aria-hidden="true">
                    {e.tamam ? "✓" : "!"}
                  </span>
                  <span className="evrak-metin">
                    <span className="kalin">{e.ad}</span>
                    <span className={e.tamam ? "soluk kucuk" : "uyari-yazi kucuk"}>{e.not}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section className="panel genis-panel" aria-labelledby="kbs-baslik">
            <h2 id="kbs-baslik">KBS'ye aktarım</h2>
            <p className="soluk kucuk">Ödeme emri belgesini KBS'de oluştururken bu alanları kopyalayın.</p>
            <div className="kbs-alanlari">
              {kbsAlanlari.map(([ad, deger]) => (
                <div key={ad} className="kbs-alani">
                  <span className="kbs-metin">
                    <span className="soluk kucuk">{ad}</span>
                    <span className="mono">{deger}</span>
                  </span>
                  <button type="button" className="dugme kucuk-dugme" aria-label={`${ad} değerini kopyala`} onClick={() => kopyala(ad, deger)}>
                    {kopyalanan === ad ? "Kopyalandı" : "Kopyala"}
                  </button>
                </div>
              ))}
            </div>
            <div className="kbs-alani">
              <span className="kbs-metin">
                <span className="soluk kucuk">Ödeme emri açıklaması</span>
                <span>{aciklama}</span>
              </span>
              <button type="button" className="dugme kucuk-dugme" aria-label="Açıklamayı kopyala" onClick={() => kopyala("aciklama", aciklama)}>
                {kopyalanan === "aciklama" ? "Kopyalandı" : "Kopyala"}
              </button>
            </div>
            <div className="alan">
              <label htmlFor="oeb">KBS ödeme emri belgesi numarası</label>
              <input id="oeb" className="mono" value={o.oebNo} onChange={(e) => guncelle({ oebNo: e.target.value })} placeholder="2026/1234" />
            </div>
          </section>
        </div>
      </fieldset>

      <div className="iki-sutun">
        <section className="panel genis-panel" aria-labelledby="kontrol-baslik" aria-live="polite">
          <h2 id="kontrol-baslik">Kontroller</h2>
          {kontroller.map((k) => (
            <KontrolSatiri key={k.baslik} k={k} />
          ))}
          {mesaj && (
            <div className="bant bant-hata" role="alert">
              {mesaj}
            </div>
          )}
          {!kilitli && (
            <div className="satir sag-hizali">
              <button type="button" className="dugme dugme-ana" onClick={tamamla}>
                Ödeme emrini tamamla
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
