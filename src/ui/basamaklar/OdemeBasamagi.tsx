import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { BasamakBaglami } from "../sayfalar/DosyaCalismaAlani";
import { BelgeOnizleme } from "../BelgeOnizleme";
import { KontrolSatiri } from "../KontrolSatiri";
import { KucukA4 } from "./KucukA4";
import { odemeEmriBelgesiSayfalari } from "./belgeler";
import { evrakFormu, evrakKaydiYap } from "../../domain/basamaklar";
import { evrakDurumlari, kapanisEksikleri, type EvrakKaydi } from "../../domain/dosya";
import {
  borcSorgusuGerekli,
  borcSorgulariTamam,
  ekListesi,
  kbsAlanlari,
  odemeHesabi,
  odemeKontrolleri,
  odemeMatrahi,
  odemeOlustur,
  oebSatirlari,
  TEVKIFAT_TURLERI,
  vergiSorguEsigi,
  type BorcSorgusu,
  type Odeme,
  type SorguDurumu,
} from "../../domain/odeme";
import { sozlesmeZorunlu, tutarCoz, type Kontrol } from "../../domain/sihirbaz";
import { bugun, tlKurus } from "../bicim";

const SORGU_DURUMLARI: [SorguDurumu, string][] = [
  ["yapilmadi", "Sorgu yapılmadı"],
  ["borcsuz", "Borcu yok"],
  ["borclu", "Borçlu"],
  ["gerekmiyor", "Gerekmiyor (eşik altında)"],
];

export function OdemeBasamagi({ b }: { b: BasamakBaglami }) {
  const navigate = useNavigate();
  const { alim, dosya, odeme, muayene, piyasa, evraklar, veri } = b;
  const { ayarlar, tedarikciler } = veri;
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [onizle, setOnizle] = useState(false);
  const [mesaj, setMesaj] = useState("");
  const [kopyalanan, setKopyalanan] = useState("");
  const [kopyaHata, setKopyaHata] = useState("");

  const [o, setO] = useState<Odeme>(() => odeme ?? odemeOlustur(alim));
  const [oeb, setOeb] = useState(() => evrakFormu(evraklar["odeme-emri"], bugun(), o.oebNo));
  const [kikTarihi, setKikTarihi] = useState(evraklar["kik-bildirimi"]?.tamam ? evraklar["kik-bildirimi"].tarih.slice(0, 10) : "");
  const [borcMetni, setBorcMetni] = useState<Record<"vergi" | "sgk", string>>({
    vergi: o.vergiSorgusu.borc ? String(o.vergiSorgusu.borc / 100).replace(".", ",") : "",
    sgk: o.sgkSorgusu.borc ? String(o.sgkSorgusu.borc / 100).replace(".", ",") : "",
  });

  const yuklenici = tedarikciler.find((t) => t.id === alim.tedarikciId) ?? null;
  const firmaAdi = (id: string) => tedarikciler.find((t) => t.id === id)?.ad || "Bilinmeyen Firma";

  // Matrah: muayenede kabul edilen KDV hariç tutar. KDV, tevkifat, damga ve borç mahsubu alan katmanında hesaplanır.
  const matrah = odemeMatrahi(alim, muayene);
  const aktif = { ...o, oebNo: oeb.sayi.trim() };
  const h = odemeHesabi(matrah, aktif, ayarlar);
  const satirlar = oebSatirlari(h, aktif, ayarlar);
  const sorguGerekli = borcSorgusuGerekli(h.brut, ayarlar);

  // Bu basamağın kaydedeceği evraklarla birlikte dosyanın kapanıp kapanamayacağı
  const buBasamaginEvraklari = useMemo((): Record<string, EvrakKaydi> => {
    const e: Record<string, EvrakKaydi> = {};
    if (oeb.sayi.trim() && oeb.tarih) e["odeme-emri"] = { tamam: true, tarih: oeb.tarih, not: oeb.sayi.trim() };
    if (borcSorgulariTamam(o, h.brut, ayarlar)) {
      e["borc-sorgusu"] = { tamam: true, tarih: o.vergiSorgusu.tarih || o.sgkSorgusu.tarih || oeb.tarih, not: "" };
    }
    if (kikTarihi) e["kik-bildirimi"] = { tamam: true, tarih: kikTarihi, not: "" };
    return e;
  }, [oeb, o, kikTarihi, h.brut, ayarlar]);
  const kapanisEksik = kapanisEksikleri(alim, { ...evraklar, ...buBasamaginEvraklari }, piyasa);

  const kontroller = useMemo((): Kontrol[] => {
    const g = ayarlar.gorevler;
    const k: Kontrol[] = [];
    if (!g?.harcamaYetkilisi || !g?.gerceklestirme) {
      k.push({ durum: "engel", baslik: "İmzacı eksik", detay: "Ödeme emri belgesini gerçekleştirme görevlisi düzenler, harcama yetkilisi onaylar." });
    }
    if (!yuklenici?.iban) {
      k.push({ durum: "uyari", baslik: "Yüklenicinin IBAN'ı yok", detay: "Ödeme banka hesabına yapılır; IBAN'ı Tedarikçiler ekranından girin." });
    }
    const ekler = ekListesi(evrakDurumlari(alim, evraklar, piyasa), aktif, h.brut, ayarlar);
    k.push(...odemeKontrolleri(aktif, h, ekler, ayarlar, sozlesmeZorunlu(alim)));
    return k;
  }, [ayarlar, yuklenici, alim, evraklar, piyasa, aktif, h]);
  const engelVar = kontroller.some((k) => k.durum === "engel");

  const belgeSayfalari = odemeEmriBelgesiSayfalari(
    { alim, ayarlar, dosya, kalemler: b.kalemler },
    aktif,
    satirlar,
    oeb.tarih,
    firmaAdi,
    yuklenici?.iban ?? "",
  );

  const sorguDegistir = (hangi: "vergiSorgusu" | "sgkSorgusu", d: Partial<BorcSorgusu>) =>
    setO((x) => ({ ...x, [hangi]: { ...x[hangi], ...d } }));

  const kopyala = async (ad: string, deger: string) => {
    setKopyaHata("");
    try {
      await navigator.clipboard.writeText(deger);
      setKopyalanan(ad);
    } catch {
      setKopyalanan("");
      setKopyaHata("Panoya kopyalanamadı. Değeri elle seçip kopyalayın.");
    }
  };

  const kbs = kbsAlanlari(alim, h, yuklenici?.ad || "Bilinmeyen Firma", yuklenici?.iban ?? "");

  const kaydet = async () => {
    setMesaj("");
    let oebKaydi: EvrakKaydi;
    try {
      oebKaydi = evrakKaydiYap(oeb);
    } catch (e) {
      setMesaj((e as Error).message);
      return;
    }
    if (!oebKaydi.not) {
      setMesaj("Ödeme emri belgesinin numarasını girin.");
      return;
    }
    setKaydediliyor(true);
    try {
      await veri.depo.odemeKaydet({ ...aktif, tamamlandi: true });
      await b.evrakDegistir("odeme-emri", "Ödeme emri belgesi", oebKaydi);
      if (buBasamaginEvraklari["borc-sorgusu"]) await b.evrakDegistir("borc-sorgusu", "Vergi ve SGK borç sorgusu", buBasamaginEvraklari["borc-sorgusu"]);
      if (buBasamaginEvraklari["kik-bildirimi"]) await b.evrakDegistir("kik-bildirimi", "KİK bildirimi", buBasamaginEvraklari["kik-bildirimi"]);

      // Dosya yalnızca evrak listesi eksiksizse kapanır; değilse ödeme aşamasında kalır.
      if (kapanisEksik.length === 0) {
        await b.alimDegistir({ asama: "tamamlandi", sonIslem: bugun() }, `Ödeme emri ${oebKaydi.not} kaydedildi, dosya tamamlandı.`);
        navigate(`/dosyalar/${alim.id}/ozet`);
      } else {
        await b.alimDegistir({ asama: "odeme", sonIslem: bugun() }, `Ödeme emri ${oebKaydi.not} kaydedildi; dosya eksik evrak nedeniyle açık kaldı.`);
        setMesaj(`Ödeme kaydedildi. Dosya kapanmadı; eksik evrak: ${kapanisEksik.join(", ")}.`);
      }
    } finally {
      setKaydediliyor(false);
    }
  };

  return (
    <>
      <div className="iki-sutun">
        <section className="panel genis-form" aria-labelledby="odeme-baslik">
          <div>
            <h2 id="odeme-baslik">13. Ödeme emri belgesi ve dosyanın kapanışı</h2>
            <p className="soluk kucuk">KDV, tevkifat, damga vergisi ve borç mahsubu hesaplanır; dosya evrak listesi eksiksizse kapanır.</p>
          </div>

          <div className="form-izgara">
            <div className="alan">
              <label htmlFor="oeb-no">Ödeme emri belgesi no</label>
              <input id="oeb-no" value={oeb.sayi} onChange={(e) => setOeb((f) => ({ ...f, sayi: e.target.value }))} placeholder="2026/0129" aria-invalid={!oeb.sayi.trim()} />
            </div>
            <div className="alan">
              <label htmlFor="oeb-tarih">Ödeme emri tarihi</label>
              <input id="oeb-tarih" type="date" value={oeb.tarih} onChange={(e) => setOeb((f) => ({ ...f, tarih: e.target.value }))} aria-invalid={!oeb.tarih} />
            </div>
            <div className="alan">
              <label htmlFor="kdv-orani">KDV oranı</label>
              <select id="kdv-orani" value={o.kdvOrani} onChange={(e) => setO((x) => ({ ...x, kdvOrani: Number(e.target.value) }))}>
                {[1, 10, 20].map((r) => (
                  <option key={r} value={r}>
                    %{r}
                  </option>
                ))}
              </select>
            </div>
            <div className="alan">
              <label htmlFor="tevkifat">KDV tevkifatı</label>
              <select id="tevkifat" value={o.tevkifatTuru} onChange={(e) => setO((x) => ({ ...x, tevkifatTuru: e.target.value }))}>
                {TEVKIFAT_TURLERI.map((t) => (
                  <option key={t.kod} value={t.kod}>
                    {t.pay ? `${t.pay}/${t.payda} · ${t.ad}` : t.ad}
                  </option>
                ))}
              </select>
            </div>
            <label className="onay-kutusu">
              <input type="checkbox" checked={o.sozlesmeVar} onChange={(e) => setO((x) => ({ ...x, sozlesmeVar: e.target.checked }))} />
              Yazılı sözleşme imzalandı
            </label>
            <label className="onay-kutusu">
              <input type="checkbox" checked={o.komisyonKarariVar} onChange={(e) => setO((x) => ({ ...x, komisyonKarariVar: e.target.checked }))} />
              Komisyon kararı alındı
            </label>
          </div>
          {sozlesmeZorunlu(alim) && (
            <p className="soluk kucuk">Bu alım süreye yayılan bir iş olduğundan sözleşme zorunludur (Doğrudan Temin Tebliği m.4/5); kutu varsayılan işaretlidir. Sözleşme damga vergisi hesaba girer.</p>
          )}

          <fieldset className="secim-grubu">
            <legend>Vergi ve SGK borç sorgusu</legend>
            <div className="form-izgara">
              {(
                [
                  ["vergiSorgusu", "vergi", "Vergi borcu"],
                  ["sgkSorgusu", "sgk", "SGK borcu"],
                ] as const
              ).map(([alan, kisa, ad]) => (
                <div key={alan} className="alan">
                  <label htmlFor={`${kisa}-durum`}>{ad}</label>
                  <select id={`${kisa}-durum`} value={o[alan].durum} onChange={(e) => sorguDegistir(alan, { durum: e.target.value as SorguDurumu })}>
                    {SORGU_DURUMLARI.map(([k, a]) => (
                      <option key={k} value={k}>
                        {a}
                      </option>
                    ))}
                  </select>
                  {alan === "vergiSorgusu" && (
                    <span className="soluk kucuk">
                      {sorguGerekli.vergi
                        ? `Ödeme ${tlKurus(h.brut)}; ${tlKurus(vergiSorguEsigi(ayarlar))} eşiğini aştığı için sorgu gerekli`
                        : "Ödeme eşiğin altında; sorgu gerekmez"}
                    </span>
                  )}
                  {(o[alan].durum === "borcsuz" || o[alan].durum === "borclu") && (
                    <>
                      <label className="gizli" htmlFor={`${kisa}-tarih`}>
                        {ad} sorgu tarihi
                      </label>
                      <input id={`${kisa}-tarih`} type="date" value={o[alan].tarih} onChange={(e) => sorguDegistir(alan, { tarih: e.target.value })} />
                      <label htmlFor={`${kisa}-no`}>{ad} sorgu belge numarası</label>
                      <input id={`${kisa}-no`} className="mono" placeholder="Belge numarası" value={o[alan].belgeNo} onChange={(e) => sorguDegistir(alan, { belgeNo: e.target.value })} />
                    </>
                  )}
                  {o[alan].durum === "borclu" && (
                    <>
                      <label className="gizli" htmlFor={`${kisa}-borc`}>
                        {ad} tutarı
                      </label>
                      <input
                        id={`${kisa}-borc`}
                        className="mono"
                        inputMode="decimal"
                        placeholder="Borç tutarı, ₺"
                        value={borcMetni[kisa]}
                        onChange={(e) => {
                          setBorcMetni((m) => ({ ...m, [kisa]: e.target.value }));
                          const k = tutarCoz(e.target.value);
                          sorguDegistir(alan, { borc: k ?? 0 });
                        }}
                      />
                    </>
                  )}
                </div>
              ))}
              <div className="alan">
                <label htmlFor="kik-tarih">KİK bildirim tarihi (EKAP)</label>
                <input id="kik-tarih" type="date" value={kikTarihi} onChange={(e) => setKikTarihi(e.target.value)} />
                <span className="soluk kucuk">Boşsa dosya kapanmaz; bildirim yapılınca girilir.</span>
              </div>
            </div>
          </fieldset>

          <div className="tablo-kutu">
            <table className="cetvel">
              <thead>
                <tr>
                  <th scope="col">Hesap</th>
                  <th scope="col" className="sag">
                    Borç
                  </th>
                  <th scope="col" className="sag">
                    Alacak
                  </th>
                </tr>
              </thead>
              <tbody>
                {satirlar.map((x) => (
                  <tr key={x.aciklama}>
                    <td className={x.aciklama.startsWith("Yükleniciye") ? "kalin" : undefined}>{x.aciklama}</td>
                    <td className="sag mono">{x.borc === null ? "—" : tlKurus(x.borc)}</td>
                    <td className={`sag mono${x.aciklama.startsWith("Yükleniciye") ? " kalin" : ""}`}>{x.alacak === null ? "—" : tlKurus(x.alacak)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="sutun" style={{ gap: "6px" }}>
            {kontroller.map((k, i) => (
              <KontrolSatiri key={i} k={k} />
            ))}
            {kapanisEksik.length > 0 ? (
              <KontrolSatiri k={{ durum: "uyari", baslik: "Dosya bu hâliyle kapanmaz", detay: `Eksik evrak: ${kapanisEksik.join(", ")}. Ödeme kaydedilir, dosya ödeme aşamasında kalır.` }} />
            ) : (
              <KontrolSatiri k={{ durum: "tamam", baslik: "Evrak listesi tam", detay: "Ödeme kaydedilince dosya tamamlandı olarak kapanır." }} />
            )}
          </div>

          {mesaj && (
            <div className="bant bant-uyari" role="alert">
              {mesaj}
            </div>
          )}

          <section className="sutun" style={{ gap: "6px" }} aria-labelledby="kbs-baslik">
            <h3 id="kbs-baslik">KBS'ye aktarım</h3>
            <p className="soluk kucuk">Ödeme emri belgesini KBS'de oluştururken bu alanları kopyalayın.</p>
            <div className="kbs-alanlari">
              {kbs.map((a) => (
                <div key={a.ad} className="kbs-alani">
                  <span className="kbs-metin">
                    <span className="soluk kucuk">{a.ad}</span>
                    <span className="mono">{a.deger}</span>
                  </span>
                  <button type="button" className="dugme kucuk-dugme" aria-label={`${a.ad} değerini kopyala`} onClick={() => void kopyala(a.ad, a.deger)}>
                    {kopyalanan === a.ad ? "Kopyalandı" : "Kopyala"}
                  </button>
                </div>
              ))}
            </div>
            <div className="dugme-grubu">
              <button type="button" className="dugme" onClick={() => void kopyala("tumu", kbs.map((a) => `${a.ad}\t${a.deger}`).join("\n"))}>
                {kopyalanan === "tumu" ? "Kopyalandı" : "Tümünü kopyala"}
              </button>
            </div>
            {kopyaHata && (
              <div className="bant bant-uyari" role="alert">
                {kopyaHata}
              </div>
            )}
          </section>

          <div className="dugme-grubu">
            <button type="button" className="dugme dugme-ana" disabled={kaydediliyor || engelVar} onClick={() => void kaydet()}>
              {kaydediliyor ? "Kaydediliyor…" : kapanisEksik.length ? "Ödemeyi kaydet" : "Ödemeyi kaydet ve dosyayı kapat"}
            </button>
            <button type="button" className="dugme" onClick={() => setOnizle(true)}>
              Tam ekran önizle ve yazdır
            </button>
          </div>
        </section>

        <section className="panel kucuk-onizleme" aria-labelledby="odeme-a4-baslik">
          <div className="panel-baslik-satiri">
            <h2 id="odeme-a4-baslik">A4 görünüşü</h2>
            <span className="soluk kucuk">{belgeSayfalari.length} sayfa</span>
          </div>
          <KucukA4>{belgeSayfalari[0]}</KucukA4>
          <button type="button" className="dugme dugme-ana" onClick={() => setOnizle(true)}>
            Önizle ve yazdır
          </button>
        </section>
      </div>

      {onizle && <BelgeOnizleme baslik={`Ödeme emri belgesi · ${alim.id}`} sayfalar={belgeSayfalari} kapat={() => setOnizle(false)} />}
    </>
  );
}
