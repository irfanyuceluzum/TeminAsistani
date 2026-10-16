import { useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { BENTLER, bentBilgisi, dayanakKontrolleri, engelVarMi, tutarCoz, yeniDosyaNo } from "../../domain/sihirbaz";
import type { Bent } from "../../domain/tipler";
import { olayKaydet } from "../../data/olay";
import { bugun, tl, tlKurus, uzunTarih } from "../bicim";
import { KontrolSatiri } from "../KontrolSatiri";
import type { Veri } from "../useVeri";

// Örnek kod listesi; ileride Parametreler'den yönetilecek.
const EKONOMIK_KODLAR: [string, string][] = [
  ["03.2.1.01", "Kırtasiye alımları"],
  ["03.2.2.01", "Temizlik malzemesi alımları"],
  ["03.5.5.01", "Bina kiralaması"],
  ["03.5.5.02", "Taşıt kiralaması"],
  ["03.5.9.90", "Diğer hizmet alımları"],
  ["03.7.1.02", "Bakım ve onarım giderleri"],
];

const ADIMLAR = ["İhtiyaç", "Dayanak", "Onay belgesi", "Piyasa araştırması", "Sipariş", "Muayene kabul", "Ödeme"];

interface Form {
  konu: string;
  nitelik: string;
  tutar: string;
  ekonomikKod: string;
  kalemKodu: string;
  birim: string;
}

interface OnayBilgisi {
  sayi: string;
  piyasaGorevlileri: string;
  gerceklestirme: string;
  harcamaYetkilisi: string;
  yaklasikMaliyetYaz: boolean;
}

type Hatalar = Partial<Record<keyof Form, string>>;

function formuDenetle(f: Form): Hatalar {
  const h: Hatalar = {};
  if (!f.konu.trim()) h.konu = "Alımın konusunu yazın.";
  const tutar = tutarCoz(f.tutar);
  if (tutar === null || tutar <= 0) h.tutar = "Tutarı 38.500,00 biçiminde yazın.";
  if (!f.ekonomikKod) h.ekonomikKod = "Bütçe tertibini seçin.";
  if (!f.kalemKodu.trim()) h.kalemKodu = "Kalem kodunu yazın ya da listeden seçin.";
  return h;
}

export function YeniAlim() {
  const { depo, alimlar, ayarlar, limitDonemleri, yenile } = useOutletContext<Veri>();
  const navigate = useNavigate();
  const tarih = bugun();
  const dosyaNo = yeniDosyaNo(alimlar, Number(tarih.slice(0, 4)));

  const [adim, setAdim] = useState(0);
  const [form, setForm] = useState<Form>({ konu: "", nitelik: "", tutar: "", ekonomikKod: "", kalemKodu: "", birim: "" });
  const [hatalar, setHatalar] = useState<Hatalar>({});
  const [bent, setBent] = useState<Bent>("22/d");
  const [onay, setOnay] = useState<OnayBilgisi>({
    sayi: "",
    piyasaGorevlileri: "",
    gerceklestirme: "",
    harcamaYetkilisi: "",
    yaklasikMaliyetYaz: true,
  });
  const [engelMesaji, setEngelMesaji] = useState("");
  const [kayitHatasi, setKayitHatasi] = useState("");
  const [kaydediliyor, setKaydediliyor] = useState(false);

  const tutar = tutarCoz(form.tutar) ?? 0;
  const kalemler = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of alimlar) if (!m.has(a.kalemKodu)) m.set(a.kalemKodu, a.konu);
    return [...m.entries()];
  }, [alimlar]);
  const kontroller = useMemo(
    () => dayanakKontrolleri({ onayTarihi: tarih, tutar, ekonomikKod: form.ekonomikKod, kalemKodu: form.kalemKodu.trim() }, bent, alimlar, ayarlar, limitDonemleri),
    [tarih, tutar, form.ekonomikKod, form.kalemKodu, bent, alimlar, ayarlar, limitDonemleri],
  );
  const bilgi = bentBilgisi(bent);

  function alan<K extends keyof Form>(k: K, deger: string) {
    setForm((f) => ({ ...f, [k]: deger }));
    if (hatalar[k]) setHatalar((h) => ({ ...h, [k]: undefined }));
  }

  function ilerle() {
    if (adim === 0) {
      const h = formuDenetle(form);
      setHatalar(h);
      if (Object.keys(h).length) return;
    }
    if (adim === 1 && engelVarMi(kontroller)) {
      setEngelMesaji("Kırmızı işaretli kontrol çözülmeden onay belgesine geçilemez.");
      return;
    }
    setEngelMesaji("");
    setAdim((a) => a + 1);
  }

  async function kaydet() {
    setKaydediliyor(true);
    setKayitHatasi("");
    try {
      await depo.alimEkle({
        id: dosyaNo,
        onayTarihi: tarih,
        konu: form.konu.trim(),
        bent,
        tutar,
        ekonomikKod: form.ekonomikKod,
        kalemKodu: form.kalemKodu.trim().toLocaleUpperCase("tr-TR"),
        tedarikciId: null,
        asama: "onay",
        sonIslem: tarih,
      });
      await olayKaydet(depo, ayarlar, dosyaNo, "olusturuldu", `Dosya açıldı, dayanak ${bent}, tahmini tutar ${tl(tutar)}`);
      await yenile();
      navigate(bent === "22/d" ? `/piyasa/${dosyaNo}` : "/");
    } catch (e) {
      setKayitHatasi(`Dosya kaydedilemedi. ${String(e)}`);
      setKaydediliyor(false);
    }
  }

  return (
    <div className="sayfa">
      <header className="sayfa-ust yazdirma">
        <div>
          <p className="mono soluk">{dosyaNo} · Taslak</p>
          <h1>Yeni alım</h1>
        </div>
      </header>

      <ol className="adimlar yazdirma" aria-label="Adımlar">
        {ADIMLAR.map((ad, i) => (
          <li key={ad} className={i < adim ? "adim adim-bitti" : i === adim ? "adim adim-simdi" : "adim"} aria-current={i === adim ? "step" : undefined}>
            <span className="adim-no">{i < adim ? "✓" : i + 1}</span>
            {ad}
          </li>
        ))}
      </ol>

      {adim === 0 && (
        <section className="panel yazdirma" aria-labelledby="ihtiyac-baslik">
          <h2 id="ihtiyac-baslik">İhtiyaç bilgileri</h2>
          <div className="form-izgara">
            <div className="alan tam">
              <label htmlFor="konu">Alımın konusu</label>
              <input id="konu" value={form.konu} onChange={(e) => alan("konu", e.target.value)} placeholder="Kırtasiye malzemesi alımı" aria-invalid={!!hatalar.konu} />
              {hatalar.konu && <span className="hata-yazi">{hatalar.konu}</span>}
            </div>
            <div className="alan tam">
              <label htmlFor="nitelik">İşin niteliği, türü ve miktarı</label>
              <textarea id="nitelik" rows={3} value={form.nitelik} onChange={(e) => alan("nitelik", e.target.value)} placeholder="12 kalem kırtasiye malzemesi (ekli listede), 1 parti" />
            </div>
            <div className="alan">
              <label htmlFor="tutar">Tahmini tutar, KDV hariç</label>
              <input id="tutar" className="mono" inputMode="decimal" value={form.tutar} onChange={(e) => alan("tutar", e.target.value)} placeholder="38.500,00" aria-invalid={!!hatalar.tutar} />
              {hatalar.tutar && <span className="hata-yazi">{hatalar.tutar}</span>}
            </div>
            <div className="alan">
              <label htmlFor="kod">Bütçe tertibi</label>
              <select id="kod" value={form.ekonomikKod} onChange={(e) => alan("ekonomikKod", e.target.value)} aria-invalid={!!hatalar.ekonomikKod}>
                <option value="">Seçin</option>
                {EKONOMIK_KODLAR.map(([kod, ad]) => (
                  <option key={kod} value={kod}>
                    {kod} {ad}
                  </option>
                ))}
              </select>
              {hatalar.ekonomikKod && <span className="hata-yazi">{hatalar.ekonomikKod}</span>}
            </div>
            <div className="alan">
              <label htmlFor="kalem">Kalem kodu</label>
              <input id="kalem" className="mono" list="kalem-listesi" value={form.kalemKodu} onChange={(e) => alan("kalemKodu", e.target.value)} placeholder="KRT" aria-invalid={!!hatalar.kalemKodu} />
              <datalist id="kalem-listesi">
                {kalemler.map(([kod, konu]) => (
                  <option key={kod} value={kod}>
                    {konu}
                  </option>
                ))}
              </datalist>
              {hatalar.kalemKodu ? <span className="hata-yazi">{hatalar.kalemKodu}</span> : <span className="ipucu">Bölme kontrolü aynı kalemdeki alımlara bakar.</span>}
            </div>
            <div className="alan">
              <label htmlFor="birim">İhtiyacı bildiren birim</label>
              <input id="birim" value={form.birim} onChange={(e) => alan("birim", e.target.value)} placeholder="İdari İşler Şube Müdürlüğü" />
            </div>
          </div>
        </section>
      )}

      {adim === 1 && (
        <div className="iki-sutun yazdirma">
          <section className="genis sutun" aria-labelledby="bent-baslik">
            <div>
              <h2 id="bent-baslik">Bu alım hangi bende dayanıyor?</h2>
              <p className="soluk">Seçtiğiniz bende göre kontroller ve dosyaya girecek belgeler değişir.</p>
            </div>
            <div className="bent-kartlari" role="radiogroup" aria-labelledby="bent-baslik">
              {BENTLER.map((b) => (
                <button key={b.kod} type="button" role="radio" aria-checked={bent === b.kod} className="bent-karti" onClick={() => setBent(b.kod)}>
                  <span className="mono bent-kod">{b.kod}</span>
                  <span className="bent-ad">{b.ad}</span>
                  <span className="soluk kucuk">{b.ozet}</span>
                </button>
              ))}
            </div>
            <section className="panel" aria-labelledby="belge-baslik">
              <h2 id="belge-baslik">Dosyaya eklenecek belgeler · {bent}</h2>
              <ul className="belge-listesi">
                {bilgi.belgeler.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </section>
          </section>
          <aside className="panel yan" aria-labelledby="kontrol-baslik" aria-live="polite">
            <h2 id="kontrol-baslik">Canlı kontroller</h2>
            {kontroller.map((k) => (
              <KontrolSatiri key={k.baslik} k={k} />
            ))}
          </aside>
        </div>
      )}

      {adim === 2 && (
        <div className="iki-sutun">
          <section className="panel sutun-form yazdirma" aria-labelledby="onay-baslik">
            <h2 id="onay-baslik">Belge bilgileri</h2>
            <div className="form-izgara">
              <div className="alan">
                <span className="etiket-yazi">Tarih</span>
                <span className="salt mono">{uzunTarih(tarih)}</span>
              </div>
              <div className="alan">
                <label htmlFor="sayi">Sayı</label>
                <input id="sayi" className="mono" value={onay.sayi} onChange={(e) => setOnay({ ...onay, sayi: e.target.value })} placeholder="E-12345678-934.01-…" />
              </div>
              <div className="alan tam">
                <label htmlFor="pfa">Piyasa fiyat araştırması görevlileri</label>
                <input id="pfa" value={onay.piyasaGorevlileri} onChange={(e) => setOnay({ ...onay, piyasaGorevlileri: e.target.value })} placeholder="A. Yılmaz (Şef), M. Kaya (Memur)" />
              </div>
              <div className="alan">
                <label htmlFor="gg">Gerçekleştirme görevlisi</label>
                <input id="gg" value={onay.gerceklestirme} onChange={(e) => setOnay({ ...onay, gerceklestirme: e.target.value })} placeholder="S. Demir" />
              </div>
              <div className="alan">
                <label htmlFor="hy">Harcama yetkilisi</label>
                <input id="hy" value={onay.harcamaYetkilisi} onChange={(e) => setOnay({ ...onay, harcamaYetkilisi: e.target.value })} placeholder="Ad Soyad" />
              </div>
              <label className="secim tam">
                <input type="checkbox" checked={onay.yaklasikMaliyetYaz} onChange={(e) => setOnay({ ...onay, yaklasikMaliyetYaz: e.target.checked })} />
                <span>
                  <span className="kalin">Yaklaşık maliyeti belgeye yaz</span>
                  <span className="soluk kucuk blok">Doğrudan teminde zorunlu değil.</span>
                </span>
              </label>
            </div>
          </section>

          <section className="belge-zemin" aria-label="Belge önizlemesi">
            <article className="belge">
              <div className="belge-ust">
                <span>T.C.</span>
                <span>[İDARE ADI]</span>
                <span className="normal">{form.birim || "[Birim]"}</span>
              </div>
              <div className="belge-baslik">DOĞRUDAN TEMİN ONAY BELGESİ</div>
              <div className="belge-satir">
                <span>Sayı: {onay.sayi || "…"}</span>
                <span>Tarih: {uzunTarih(tarih)}</span>
              </div>
              <table className="belge-tablo">
                <tbody>
                  <tr>
                    <th scope="row">İşin adı</th>
                    <td>{form.konu}</td>
                  </tr>
                  <tr>
                    <th scope="row">Niteliği, türü ve miktarı</th>
                    <td>{form.nitelik || "…"}</td>
                  </tr>
                  {onay.yaklasikMaliyetYaz && (
                    <tr>
                      <th scope="row">Yaklaşık maliyet (KDV hariç)</th>
                      <td>{tlKurus(tutar).replace("₺", "")} TL</td>
                    </tr>
                  )}
                  <tr>
                    <th scope="row">Bütçe tertibi</th>
                    <td>[Kurumsal kod] · {form.ekonomikKod}</td>
                  </tr>
                  <tr>
                    <th scope="row">Alım usulü</th>
                    <td>4734 sayılı Kanun {bent}, doğrudan temin</td>
                  </tr>
                  <tr>
                    <th scope="row">Piyasa fiyat araştırması görevlileri</th>
                    <td>{onay.piyasaGorevlileri || "…"}</td>
                  </tr>
                </tbody>
              </table>
              <p>
                Yukarıda belirtilen ihtiyacın 4734 sayılı Kamu İhale Kanununun 22 nci maddesinin ({bilgi.harf}) bendi uyarınca doğrudan temin usulüyle
                karşılanması hususunu onaylarınıza arz ederim.
              </p>
              <div className="belge-imzalar">
                <div>
                  <span className="imza-bosluk" />
                  <span className="kalin">{onay.gerceklestirme || "…"}</span>
                  <span>Gerçekleştirme görevlisi</span>
                </div>
                <div>
                  <span className="kalin">OLUR</span>
                  <span>…/…/{tarih.slice(0, 4)}</span>
                  <span className="kalin">{onay.harcamaYetkilisi || "…"}</span>
                  <span>Harcama yetkilisi</span>
                </div>
              </div>
            </article>
          </section>
        </div>
      )}

      {engelMesaji && (
        <div className="bant bant-hata yazdirma" role="alert">
          {engelMesaji}
        </div>
      )}
      {kayitHatasi && (
        <div className="bant bant-hata yazdirma" role="alert">
          {kayitHatasi}
        </div>
      )}

      <div className="alt-dugmeler yazdirma">
        {adim > 0 ? (
          <button type="button" className="dugme" onClick={() => setAdim((a) => a - 1)}>
            Geri
          </button>
        ) : (
          <button type="button" className="dugme" onClick={() => navigate("/")}>
            Vazgeç
          </button>
        )}
        <div className="dugme-grubu">
          {adim === 2 && (
            <button type="button" className="dugme" onClick={() => window.print()}>
              Yazdır
            </button>
          )}
          {adim < 2 ? (
            <button type="button" className="dugme dugme-ana" onClick={ilerle}>
              {adim === 0 ? "Dayanağa geç" : "Onay belgesine geç"}
            </button>
          ) : (
            <button type="button" className="dugme dugme-ana" onClick={kaydet} disabled={kaydediliyor}>
              {kaydediliyor ? "Kaydediliyor…" : "Dosyayı kaydet"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
