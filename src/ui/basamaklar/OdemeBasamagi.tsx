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
  ekListesi,
  odemeHesabi,
  odemeKontrolleri,
  odemeMatrahi,
  odemeOlustur,
  oebSatirlari,
  TEVKIFAT_TURLERI,
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
  ["gerekmiyor", "Tutar sınırın altında, gerekmiyor"],
];

const sorguTamam = (s: BorcSorgusu) => s.durum !== "yapilmadi";

export function OdemeBasamagi({ b }: { b: BasamakBaglami }) {
  const navigate = useNavigate();
  const { alim, dosya, odeme, muayene, piyasa, evraklar, veri } = b;
  const { ayarlar, tedarikciler } = veri;
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [onizle, setOnizle] = useState(false);
  const [mesaj, setMesaj] = useState("");

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

  // Bu basamağın kaydedeceği evraklarla birlikte dosyanın kapanıp kapanamayacağı
  const buBasamaginEvraklari = useMemo((): Record<string, EvrakKaydi> => {
    const e: Record<string, EvrakKaydi> = {};
    if (oeb.sayi.trim() && oeb.tarih) e["odeme-emri"] = { tamam: true, tarih: oeb.tarih, not: oeb.sayi.trim() };
    if (sorguTamam(o.vergiSorgusu) && sorguTamam(o.sgkSorgusu)) {
      e["borc-sorgusu"] = { tamam: true, tarih: o.vergiSorgusu.tarih || o.sgkSorgusu.tarih || oeb.tarih, not: "" };
    }
    if (kikTarihi) e["kik-bildirimi"] = { tamam: true, tarih: kikTarihi, not: "" };
    return e;
  }, [oeb, o.vergiSorgusu, o.sgkSorgusu, kikTarihi]);
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
    const ekler = ekListesi(evrakDurumlari(alim, evraklar, piyasa), aktif);
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
          </div>

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
                  {(o[alan].durum === "borcsuz" || o[alan].durum === "borclu") && (
                    <>
                      <label className="gizli" htmlFor={`${kisa}-tarih`}>
                        {ad} sorgu tarihi
                      </label>
                      <input id={`${kisa}-tarih`} type="date" value={o[alan].tarih} onChange={(e) => sorguDegistir(alan, { tarih: e.target.value })} />
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
