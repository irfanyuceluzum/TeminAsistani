import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useOutletContext, useParams } from "react-router-dom";
import {
  bosArastirma,
  bosYazi,
  yaziEksikleri,
  type TeklifYazisi,
  degerlendir,
  firmaToplami,
  piyasaKontrolleri,
  type Degerlendirme,
  type FirmaTeklifi,
  type PiyasaArastirmasi,
} from "../../domain/piyasa";
import { bentBilgisi, engelVarMi, tutarCoz } from "../../domain/sihirbaz";
import { belgeGorevlileri } from "../../domain/personel";
import { firmaKimligi } from "../../domain/tedarikci";
import { olayKaydet } from "../../data/olay";
import { bugun, tl, tlKurus, uzunTarih } from "../bicim";
import { IhtiyacListesiDuzenleyici, IhtiyacTablosu } from "../IhtiyacListesi";
import { BelgeOnizleme } from "../BelgeOnizleme";
import { IdareBasligi } from "../IdareBasligi";
import { KontrolSatiri } from "../KontrolSatiri";
import type { Veri } from "../useVeri";

type KayitDurumu = "kayitli" | "bekliyor" | "kaydediliyor" | "hata";

function hucre(firma: string, kalem: string): string {
  return `${firma}|${kalem}`;
}

function fiyatYazisi(kurus: number | null | undefined): string {
  if (kurus === null || kurus === undefined) return "";
  return (kurus / 100).toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}



export function PiyasaArastirmasiSayfasi() {
  const { alimId = "" } = useParams();
  const { depo, alimlar, tedarikciler, ayarlar, limitDonemleri, yenile } = useOutletContext<Veri>();
  const navigate = useNavigate();
  const alim = alimlar.find((a) => a.id === alimId);

  const [p, setP] = useState<PiyasaArastirmasi | null>(null);
  const [metinler, setMetinler] = useState<Record<string, string>>({});
  const [kayit, setKayit] = useState<KayitDurumu>("kayitli");
  const [secilenFirma, setSecilenFirma] = useState("");
  const [yeniFirma, setYeniFirma] = useState({ ad: "", kategori: "" });
  const [yeniFirmaHatasi, setYeniFirmaHatasi] = useState("");
  // Ekranın altında gösterilen belge: tutanak ya da (firmaya özel veya boş) teklif isteme yazısı
  const [onizleme, setOnizleme] = useState<{ tur: "tutanak" } | { tur: "yazi"; firma: string | null } | null>(null);
  const [mesaj, setMesaj] = useState("");
  const yuklendi = useRef(false);
  const alimRef = useRef(alim);
  alimRef.current = alim;
  const ayarlarRef = useRef(ayarlar);
  ayarlarRef.current = ayarlar;

  useEffect(() => {
    let iptal = false;
    yuklendi.current = false;
    depo.piyasaGetir(alimId).then((kayitli) => {
      if (iptal) return;
      const ilk = kayitli ?? bosArastirma(alimId);
      // Görevli girilmemiş eski dosyalarda Personel ve görevler ekranındaki atama kullanılır.
      if (!ilk.gorevliler) ilk.gorevliler = belgeGorevlileri(ayarlarRef.current).piyasaGorevlileri;
      const m: Record<string, string> = {};
      for (const t of ilk.teklifler) for (const k of ilk.kalemler) m[hucre(t.tedarikciId, k.id)] = fiyatYazisi(t.fiyatlar[k.id]);
      setMetinler(m);
      setP(ilk);
    });
    return () => {
      iptal = true;
    };
  }, [depo, alimId]);

  // Her değişiklikten yarım saniye sonra kaydeder; ilk yüklemede kaydetmez.
  useEffect(() => {
    if (!p || !alimRef.current) return;
    if (!yuklendi.current) {
      yuklendi.current = true;
      return;
    }
    setKayit("bekliyor");
    const zaman = setTimeout(async () => {
      setKayit("kaydediliyor");
      try {
        await depo.piyasaKaydet(p);
        const a = alimRef.current;
        if (a && a.asama === "onay") {
          await depo.alimGuncelle(a.id, { asama: "piyasa", sonIslem: bugun() });
          await olayKaydet(depo, ayarlarRef.current, a.id, "piyasa-basladi", "Piyasa fiyat araştırması başladı");
          await yenile();
        }
        setKayit("kayitli");
      } catch {
        setKayit("hata");
      }
    }, 500);
    return () => clearTimeout(zaman);
  }, [p, depo, yenile]);

  const sonuc = useMemo(() => (p ? degerlendir(p) : null), [p]);
  const kontroller = useMemo(
    () => (p && alim ? piyasaKontrolleri(p, sonuc, alim, ayarlar, limitDonemleri, tedarikciler) : []),
    [p, sonuc, alim, ayarlar, limitDonemleri, tedarikciler],
  );

  if (!alim) {
    return (
      <div className="sayfa">
        <div className="bant bant-hata" role="alert">
          {alimId} numaralı dosya bulunamadı. <Link to="/">Ana panele dönün.</Link>
        </div>
      </div>
    );
  }
  if (!p) return <p className="soluk">Araştırma yükleniyor…</p>;

  const firmaAdi = (id: string) => tedarikciler.find((t) => t.id === id)?.ad ?? id;
  const kilitli = p.tamamlandi;
  const yazi = p.yazi ?? bosYazi(bugun());
  const yaziEksik = yaziEksikleri({ ...p, yazi });
  const eklenebilir = tedarikciler.filter((t) => !p.teklifler.some((x) => x.tedarikciId === t.id));
  const kazandi = (firma: string, kalem: string) => sonuc?.atamalar.some((a) => a.tedarikciId === firma && a.kalemId === kalem) ?? false;

  function guncelle(f: (eski: PiyasaArastirmasi) => PiyasaArastirmasi) {
    setMesaj("");
    setP((eski) => (eski ? f(eski) : eski));
  }

  function yaziDegistir(d: Partial<TeklifYazisi>) {
    guncelle((x) => ({ ...x, yazi: { ...(x.yazi ?? bosYazi(bugun())), ...d } }));
  }





  function teklifDegistir(firma: string, d: Partial<FirmaTeklifi>) {
    guncelle((x) => ({ ...x, teklifler: x.teklifler.map((t) => (t.tedarikciId === firma ? { ...t, ...d } : t)) }));
  }

  function fiyatGir(firma: string, kalem: string, metin: string) {
    setMetinler((m) => ({ ...m, [hucre(firma, kalem)]: metin }));
    const kurus = metin.trim() === "" ? null : tutarCoz(metin);
    guncelle((x) => ({
      ...x,
      teklifler: x.teklifler.map((t) => (t.tedarikciId === firma ? { ...t, fiyatlar: { ...t.fiyatlar, [kalem]: kurus } } : t)),
    }));
  }

  function firmaEkle(id: string) {
    if (!id) return;
    guncelle((x) => ({ ...x, teklifler: [...x.teklifler, { tedarikciId: id, teklifTarihi: null, yasaklilikSorgusu: null, fiyatlar: {} }] }));
    setSecilenFirma("");
  }

  async function yeniFirmaKaydet() {
    const ad = yeniFirma.ad.trim();
    if (!ad) {
      setYeniFirmaHatasi("Firma adını yazın.");
      return;
    }
    const id = firmaKimligi(ad, tedarikciler.map((t) => t.id));
    try {
      await depo.tedarikciEkle({ id, ad, kategori: yeniFirma.kategori.trim() });
      await yenile();
      firmaEkle(id);
      setYeniFirma({ ad: "", kategori: "" });
      setYeniFirmaHatasi("");
    } catch (e) {
      setYeniFirmaHatasi(`Firma eklenemedi. ${String(e)}`);
    }
  }

  async function tamamla() {
    if (!p || !sonuc || engelVarMi(kontroller)) {
      setMesaj("Kırmızı işaretli kontroller çözülmeden araştırma tamamlanamaz.");
      return;
    }
    const son = { ...p, tamamlandi: true };
    try {
      await depo.piyasaKaydet(son);
      await depo.alimGuncelle(alimId, {
        asama: "siparis",
        tutar: sonuc.toplam,
        tedarikciId: sonuc.kazananlar.length === 1 ? sonuc.kazananlar[0] : null,
        sonIslem: bugun(),
      });
      const kazanan = sonuc.kazananlar.map(firmaAdi).join(", ");
      await olayKaydet(depo, ayarlar, alimId, "piyasa-tamamlandi", `Piyasa araştırması tamamlandı: ${kazanan}, ${tl(sonuc.toplam)}`);
      await yenile();
      navigate(`/dosyalar/${alimId}`);
    } catch (e) {
      setMesaj(`Araştırma kaydedilemedi. ${String(e)}`);
    }
  }

  const kayitYazisi = { kayitli: "Kaydedildi", bekliyor: "Değişiklik var", kaydediliyor: "Kaydediliyor…", hata: "Kaydedilemedi" }[kayit];

  // Önizlenen belgelerin A4 sayfaları: yazı ve ekindeki teklif cetveli ayrı sayfalardır.
  const yaziFirma = onizleme?.tur === "yazi" ? onizleme.firma : null;
  const yaziSayfalari = [
    <>
            <IdareBasligi ayarlar={ayarlar} />
            <div className="belge-satir">
              <span>Sayı: {yazi.sayi || "…"}</span>
              <span>{yazi.tarih ? uzunTarih(yazi.tarih) : "…"}</span>
            </div>
            <p>
              <span className="kalin">Konu:</span> Fiyat teklifi istenmesi
            </p>
            <p className="kalin">{yaziFirma ? firmaAdi(yaziFirma) : "Sayın Yetkili"}</p>
            <p>
              İdaremiz ihtiyacı olan ve ekli cetvelde nitelik ve miktarları belirtilen mal veya hizmetlerin ("{alim.konu}") 4734 sayılı Kamu İhale
              Kanununun 22 nci maddesinin ({bentBilgisi(alim.bent).harf}) bendi uyarınca doğrudan temin usulüyle alınması planlanmaktadır.
            </p>
            <p>
              Ekli fiyat teklif cetvelinin birim fiyat ve tutarları KDV hariç olarak doldurulup kaşelenerek imzalanması ve en geç{" "}
              <span className="kalin">{yazi.sonTeklifTarihi ? uzunTarih(yazi.sonTeklifTarihi) : "…"}</span> tarihine kadar idaremize ulaştırılması
              hususunda gereğini rica ederim.
            </p>
            {(yazi.teslimYeri || yazi.teslimSuresi || yazi.aciklama) && (
              <table className="belge-tablo">
                <tbody>
                  {yazi.teslimYeri && (
                    <tr>
                      <th scope="row">Teslim yeri</th>
                      <td>{yazi.teslimYeri}</td>
                    </tr>
                  )}
                  {yazi.teslimSuresi && (
                    <tr>
                      <th scope="row">Teslim süresi</th>
                      <td>{yazi.teslimSuresi}</td>
                    </tr>
                  )}
                  {yazi.aciklama && (
                    <tr>
                      <th scope="row">Açıklama</th>
                      <td>{yazi.aciklama}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
            <div className="belge-imzalar">
              <div />
              <div>
                <span className="imza-bosluk" />
                <span className="kalin">{p.gorevliler ? p.gorevliler.split(",")[0].trim() : "…"}</span>
                <span>Piyasa fiyat araştırması görevlisi</span>
              </div>
            </div>
            <p className="kucuk">EK: Fiyat teklif cetveli ({p.kalemler.length} kalem)</p>
    </>,
    <>
      <div className="belge-satir">
        <span className="kalin">FİYAT TEKLİF CETVELİ</span>
        <span>EK-1</span>
      </div>
            <div className="belge-satir">
              <span>İşin adı: {alim.konu}</span>
              <span>Dosya: {alim.id}</span>
            </div>
            <IhtiyacTablosu kalemler={p.kalemler} fiyatSutunlari />
            <p className="kucuk">Yukarıdaki kalemleri belirtilen fiyatlarla, şartlara uygun olarak teslim etmeyi kabul ederiz.</p>
            <div className="firma-kase">
              <div className="firma-kase-bilgi">
                <span>Firma unvanı: {yaziFirma ? firmaAdi(yaziFirma) : ""}</span>
                <span>Vergi dairesi ve no: {yaziFirma ? [tedarikciler.find((x) => x.id === yaziFirma)?.vergiDairesi, tedarikciler.find((x) => x.id === yaziFirma)?.vkn].filter(Boolean).join(" · ") : ""}</span>
                <span>Adres ve telefon:</span>
                <span>Teklif tarihi: …/…/{bugun().slice(0, 4)}</span>
              </div>
              <div className="firma-kase-alan">Kaşe ve imza</div>
            </div>
    </>,
  ];
  const tutanakSayfalari = [<>
            <IdareBasligi ayarlar={ayarlar} />
            <div className="belge-baslik">PİYASA FİYAT ARAŞTIRMASI TUTANAĞI</div>
            <div className="belge-satir">
              <span>Dosya: {alim.id}</span>
              <span>Tarih: {uzunTarih(bugun())}</span>
            </div>
            <p>
              <span className="kalin">İşin adı:</span> {alim.konu} · 4734 sayılı Kanun {alim.bent}
            </p>
            <table className="belge-tablo tutanak-tablo">
              <thead>
                <tr>
                  <th scope="col">Kalem</th>
                  <th scope="col">Miktar</th>
                  {p.teklifler.map((t) => (
                    <th key={t.tedarikciId} scope="col">
                      {firmaAdi(t.tedarikciId)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {p.kalemler.map((k) => (
                  <tr key={k.id}>
                    <td>{k.ad}</td>
                    <td>
                      {k.miktar.toLocaleString("tr-TR")} {k.birim}
                    </td>
                    {p.teklifler.map((t) => {
                      const f = t.fiyatlar[k.id];
                      return (
                        <td key={t.tedarikciId} className={kazandi(t.tedarikciId, k.id) ? "kalin" : ""}>
                          {f === null || f === undefined ? "—" : tlKurus(f).replace("₺", "") + " TL"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr>
                  <th scope="row" colSpan={2}>
                    Toplam, KDV hariç
                  </th>
                  {p.teklifler.map((t) => {
                    const toplam = firmaToplami(p, t.tedarikciId);
                    return <td key={t.tedarikciId}>{toplam === null ? "—" : tlKurus(toplam).replace("₺", "") + " TL"}</td>;
                  })}
                </tr>
              </tbody>
            </table>
            <p>
              {sonuc
                ? sonuc.kazananlar.length === 1
                  ? `Yapılan piyasa fiyat araştırması sonucunda en uygun teklifin ${tlKurus(sonuc.toplam).replace("₺", "")} TL (KDV hariç) ile ${firmaAdi(sonuc.kazananlar[0])} tarafından verildiği tespit edilmiştir.`
                  : `Yapılan piyasa fiyat araştırması sonucunda kalemler en düşük fiyatı veren firmalara (${sonuc.kazananlar.map(firmaAdi).join(", ")}) toplam ${tlKurus(sonuc.toplam).replace("₺", "")} TL (KDV hariç) ile atanmıştır.`
                : "Değerlendirme için fiyatlar tamamlanmamıştır."}
            </p>
            <div className="belge-imzalar">
              {(p.gorevliler ? p.gorevliler.split(",") : ["…", "…"]).map((g, i) => (
                <div key={i}>
                  <span className="imza-bosluk" />
                  <span className="kalin">{g.trim()}</span>
                  <span>Görevli</span>
                </div>
              ))}
            </div>
  </>];

  return (
    <div className="sayfa">
      <header className="sayfa-ust yazdirma">
        <div>
          <p className="mono soluk">
            {alim.id} · {alim.bent} · onay tutarı {tl(alim.tutar)}
          </p>
          <h1>Piyasa fiyat araştırması</h1>
          <p className="soluk">{alim.konu}</p>
        </div>
        <span className={kayit === "hata" ? "kayit-durumu hata-yazi" : "kayit-durumu soluk"} role="status">
          {kayitYazisi}
        </span>
      </header>

      {kilitli && (
        <div className="bant bant-bilgi yazdirma">Araştırma tamamlandı. Sonuç dosyaya işlendi, değişiklik yapılamaz.</div>
      )}

      <fieldset className="kilit yazdirma" disabled={kilitli}>
        <section className="panel" aria-labelledby="kalem-baslik">
          <div>
            <h2 id="kalem-baslik">1. İhtiyaç listesi</h2>
            <p className="soluk kucuk">Sihirbazda girilen liste. Teklif isteme yazısı gönderildikten sonra değiştirmeyin; firmalar bu listeye fiyat verir.</p>
          </div>
          <IhtiyacListesiDuzenleyici kalemler={p.kalemler} degistir={(kalemler) => guncelle((x) => ({ ...x, kalemler }))} kilitli={kilitli} />
        </section>

        <section className="panel" aria-labelledby="yazi-baslik">
          <div className="panel-baslik-satiri">
            <div>
              <h2 id="yazi-baslik">2. Teklif isteme yazısı</h2>
              <p className="soluk kucuk">Ekinde ihtiyaç listesinden üretilen boş fiyat teklif cetveli bulunur. Firmalar cetveli doldurup kaşeleyip imzalayarak geri gönderir.</p>
            </div>
            <button type="button" className="dugme kucuk-dugme" onClick={() => setOnizleme({ tur: "yazi", firma: null })}>
              Boş yazıyı önizle
            </button>
          </div>
          <div className="form-izgara">
            <div className="alan">
              <label htmlFor="yazi-sayi">Sayı</label>
              <input id="yazi-sayi" className="mono" value={yazi.sayi} onChange={(e) => yaziDegistir({ sayi: e.target.value })} placeholder="E-12345678-934.01-…" />
            </div>
            <div className="alan">
              <label htmlFor="yazi-tarih">Yazı tarihi</label>
              <input id="yazi-tarih" type="date" value={yazi.tarih} onChange={(e) => yaziDegistir({ tarih: e.target.value })} />
            </div>
            <div className="alan">
              <label htmlFor="yazi-son">Son teklif tarihi</label>
              <input id="yazi-son" type="date" value={yazi.sonTeklifTarihi} onChange={(e) => yaziDegistir({ sonTeklifTarihi: e.target.value })} aria-invalid={!yazi.sonTeklifTarihi} />
            </div>
            <div className="alan">
              <label htmlFor="yazi-yer">Teslim yeri</label>
              <input id="yazi-yer" value={yazi.teslimYeri} onChange={(e) => yaziDegistir({ teslimYeri: e.target.value })} placeholder="İdare ambarı" />
            </div>
            <div className="alan">
              <label htmlFor="yazi-sure">Teslim süresi</label>
              <input id="yazi-sure" value={yazi.teslimSuresi} onChange={(e) => yaziDegistir({ teslimSuresi: e.target.value })} placeholder="Siparişten itibaren 5 iş günü" />
            </div>
            <div className="alan tam">
              <label htmlFor="yazi-aciklama">Açıklama</label>
              <input id="yazi-aciklama" value={yazi.aciklama} onChange={(e) => yaziDegistir({ aciklama: e.target.value })} placeholder="Numune istenebilir, nakliye teklif fiyatına dahildir" />
            </div>
          </div>
          {yaziEksik.length > 0 ? (
            <ul className="hata-listesi">
              {yaziEksik.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          ) : (
            <span className="basari-yazi kucuk">Yazı hazır. Aşağıda her firma için kendi adıyla yazdırabilirsiniz.</span>
          )}
        </section>

        <section className="panel" aria-labelledby="firma-baslik">
          <h2 id="firma-baslik">3. Firmalar ve gelen teklifler</h2>
          <p className="soluk kucuk">Fiyatları firmanın kaşeli ve imzalı teklif belgesinden girin, belgenin ulaştığını işaretleyin.</p>
          <div className="firma-kartlari">
            {p.teklifler.map((t) => (
              <div key={t.tedarikciId} className={sonuc?.kazananlar.includes(t.tedarikciId) ? "firma-karti kazanan" : "firma-karti"}>
                <div className="firma-ust">
                  <span className="kalin">{firmaAdi(t.tedarikciId)}</span>
                  <button type="button" className="metin-dugme" onClick={() => guncelle((x) => ({ ...x, teklifler: x.teklifler.filter((y) => y.tedarikciId !== t.tedarikciId) }))}>
                    Çıkar
                  </button>
                </div>
                <div className="alan">
                  <label htmlFor={`tarih-${t.tedarikciId}`}>Teklif tarihi</label>
                  <input id={`tarih-${t.tedarikciId}`} type="date" value={t.teklifTarihi ?? ""} onChange={(e) => teklifDegistir(t.tedarikciId, { teklifTarihi: e.target.value || null })} />
                </div>
                {t.yasaklilikSorgusu ? (
                  <div className="sorgu sorgu-tamam">
                    <span>Yasaklılık sorgusu {uzunTarih(t.yasaklilikSorgusu)}</span>
                    <button type="button" className="metin-dugme" onClick={() => teklifDegistir(t.tedarikciId, { yasaklilikSorgusu: null })}>
                      Kaldır
                    </button>
                  </div>
                ) : (
                  <button type="button" className="dugme kucuk-dugme" onClick={() => teklifDegistir(t.tedarikciId, { yasaklilikSorgusu: bugun() })}>
                    EKAP sorgusu yapıldı
                  </button>
                )}
                <label className="onay-kutusu kucuk">
                  <input type="checkbox" checked={!!t.belgeAlindi} onChange={(e) => teklifDegistir(t.tedarikciId, { belgeAlindi: e.target.checked })} />
                  Kaşeli, imzalı teklif belgesi alındı
                </label>
                <button type="button" className="metin-dugme sola" onClick={() => setOnizleme({ tur: "yazi", firma: t.tedarikciId })}>
                  Bu firmanın yazısını önizle
                </button>
                <span className="kart-not">
                  Toplam: <span className="mono">{firmaToplami(p, t.tedarikciId) === null ? "eksik fiyat" : tl(firmaToplami(p, t.tedarikciId)!)}</span>
                </span>
              </div>
            ))}
          </div>
          <div className="firma-ekle">
            <div className="alan">
              <label htmlFor="kayitli-firma">Kayıtlı firma ekle</label>
              <div className="satir">
                <select id="kayitli-firma" value={secilenFirma} onChange={(e) => setSecilenFirma(e.target.value)}>
                  <option value="">Firma seçin</option>
                  {eklenebilir.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.ad} · {t.kategori}
                    </option>
                  ))}
                </select>
                <button type="button" className="dugme" onClick={() => firmaEkle(secilenFirma)}>
                  Ekle
                </button>
              </div>
            </div>
            <div className="alan">
              <label htmlFor="yeni-firma">Yeni firma</label>
              <div className="satir">
                <input
                  id="yeni-firma"
                  value={yeniFirma.ad}
                  onChange={(e) => {
                    setYeniFirma({ ...yeniFirma, ad: e.target.value });
                    setYeniFirmaHatasi("");
                  }}
                  placeholder="Firma adı"
                />
                <label className="gizli" htmlFor="yeni-kategori">
                  Kategori
                </label>
                <input id="yeni-kategori" value={yeniFirma.kategori} onChange={(e) => setYeniFirma({ ...yeniFirma, kategori: e.target.value })} placeholder="Kategori" />
                <button type="button" className="dugme" onClick={yeniFirmaKaydet}>
                  Kaydet ve ekle
                </button>
              </div>
              {yeniFirmaHatasi && <span className="hata-yazi">{yeniFirmaHatasi}</span>}
            </div>
          </div>
        </section>

        <section className="panel bosluksuz" aria-labelledby="karsilastirma-baslik">
          <div className="panel-ust">
            <h2 id="karsilastirma-baslik">Teklif karşılaştırması · KDV hariç birim fiyat</h2>
            <div className="bolumlu" role="radiogroup" aria-label="Değerlendirme şekli">
              {(
                [
                  ["toplam", "Toplam bazlı"],
                  ["kalem", "Kalem bazlı"],
                ] as [Degerlendirme, string][]
              ).map(([id, ad]) => (
                <button key={id} type="button" role="radio" aria-checked={p.degerlendirme === id} onClick={() => guncelle((x) => ({ ...x, degerlendirme: id }))}>
                  {ad}
                </button>
              ))}
            </div>
          </div>
          {p.kalemler.length === 0 || p.teklifler.length === 0 ? (
            <p className="soluk bos">Karşılaştırma için kalem ve firma ekleyin.</p>
          ) : (
            <div className="tablo-kutu">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Kalem</th>
                    <th scope="col" className="sag">
                      Miktar
                    </th>
                    {p.teklifler.map((t) => (
                      <th key={t.tedarikciId} scope="col" className="sag">
                        {firmaAdi(t.tedarikciId)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {p.kalemler.map((k) => (
                    <tr key={k.id}>
                      <td>{k.ad || <span className="soluk">Adsız kalem</span>}</td>
                      <td className="mono sag soluk">
                        {k.miktar.toLocaleString("tr-TR")} {k.birim}
                      </td>
                      {p.teklifler.map((t) => {
                        const anahtar = hucre(t.tedarikciId, k.id);
                        const metin = metinler[anahtar] ?? "";
                        const gecersiz = metin.trim() !== "" && tutarCoz(metin) === null;
                        return (
                          <td key={t.tedarikciId} className="sag">
                            <input
                              className={`fiyat-girdi mono${kazandi(t.tedarikciId, k.id) ? " fiyat-kazanan" : ""}`}
                              aria-label={`${firmaAdi(t.tedarikciId)}, ${k.ad || "kalem"} birim fiyatı`}
                              aria-invalid={gecersiz}
                              inputMode="decimal"
                              value={metin}
                              onChange={(e) => fiyatGir(t.tedarikciId, k.id, e.target.value)}
                              placeholder="—"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr className="toplam-satiri">
                    <th scope="row">Toplam</th>
                    <td />
                    {p.teklifler.map((t) => {
                      const toplam = firmaToplami(p, t.tedarikciId);
                      return (
                        <td key={t.tedarikciId} className="mono sag kalin">
                          {toplam === null ? <span className="soluk">eksik</span> : tl(toplam)}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </section>
      </fieldset>

      <div className="iki-sutun yazdirma">
        <section className="panel genis-panel" aria-labelledby="sonuc-baslik">
          <h2 id="sonuc-baslik">Sonuç</h2>
          {sonuc ? (
            <div className="sonuc-kutusu">
              <span className="kalin">
                {sonuc.kazananlar.length === 1
                  ? `${firmaAdi(sonuc.kazananlar[0])} · ${tlKurus(sonuc.toplam)} + KDV`
                  : `${sonuc.kazananlar.length} firmaya kalem bazında sipariş · ${tlKurus(sonuc.toplam)} + KDV`}
              </span>
              <span className="soluk kucuk">
                {sonuc.mod === "toplam" ? "En düşük toplam teklif seçildi." : "Her kalem en düşük fiyatı veren firmaya atandı."}
              </span>
            </div>
          ) : (
            <p className="soluk">Sonuç için fiyatları tamamlayın.</p>
          )}
          <div className="alan">
            <label htmlFor="gorevliler">Piyasa fiyat araştırması görevlileri</label>
            <input id="gorevliler" value={p.gorevliler} disabled={kilitli} onChange={(e) => guncelle((x) => ({ ...x, gorevliler: e.target.value }))} placeholder="A. Yılmaz (Şef), M. Kaya (Memur)" />
          </div>
          {mesaj && (
            <div className="bant bant-hata" role="alert">
              {mesaj}
            </div>
          )}
          <div className="dugme-grubu sarmali">
            <button type="button" className="dugme" onClick={() => setOnizleme({ tur: "tutanak" })}>
              Tutanağı önizle
            </button>
            {!kilitli && (
              <button type="button" className="dugme dugme-ana" onClick={tamamla}>
                Araştırmayı tamamla
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

      {onizleme && (
        <BelgeOnizleme
          baslik={onizleme.tur === "tutanak" ? `${alim.id} · Piyasa fiyat araştırması tutanağı` : `${alim.id} · Teklif isteme yazısı${yaziFirma ? ` · ${firmaAdi(yaziFirma)}` : ""}`}
          sayfalar={onizleme.tur === "tutanak" ? tutanakSayfalari : yaziSayfalari}
          kapat={() => setOnizleme(null)}
        />
      )}
    </div>
  );
}
