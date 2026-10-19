import { useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { BENTLER, bentBilgisi, dayanakKontrolleri, engelVarMi, tutarCoz, yeniDosyaNo } from "../../domain/sihirbaz";
import { basamaklariTamamla } from "../../domain/basamaklar";
import type { Bent } from "../../domain/tipler";
import { olayKaydet } from "../../data/olay";
import { belgeGorevlileri } from "../../domain/personel";
import { bosArastirma, bosYazi, type PiyasaKalemi } from "../../domain/piyasa";
import { IhtiyacListesiDuzenleyici, yeniKalem } from "../IhtiyacListesi";
import { bugun, tl } from "../bicim";
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

// Sihirbaz dosyayı açar; ihtiyaç onayından ödemeye kadar diğer işler basamaklı çalışma alanında yapılır.
const ADIMLAR = ["İhtiyaç", "Dayanak ve dosyanın açılması"];

interface Form {
  konu: string;
  nitelik: string;
  tutar: string;
  ekonomikKod: string;
  kalemKodu: string;
  birim: string;
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
  const [sureliIs, setSureliIs] = useState(false);
  const [ihtiyaclar, setIhtiyaclar] = useState<PiyasaKalemi[]>(() => [yeniKalem()]);
  const [ihtiyacHatasi, setIhtiyacHatasi] = useState("");
  const [hatalar, setHatalar] = useState<Hatalar>({});
  const [bent, setBent] = useState<Bent>("22/d");
  // Görevliler Personel ve görevler ekranındaki atamalardan gelir; dosya için değiştirilebilir.
  const gorevli = belgeGorevlileri(ayarlar);
  const [bolmeGerekcesi, setBolmeGerekcesi] = useState("");
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
    () => dayanakKontrolleri({ onayTarihi: tarih, tutar, ekonomikKod: form.ekonomikKod, kalemKodu: form.kalemKodu.trim(), sureliIs }, bent, alimlar, ayarlar, limitDonemleri),
    [tarih, tutar, form.ekonomikKod, form.kalemKodu, sureliIs, bent, alimlar, ayarlar, limitDonemleri],
  );
  const bilgi = bentBilgisi(bent);
  // Kurallardaki "benzer alım" uyarısı çıktığında bölme açıklaması istenir
  const benzerAlimVar = kontroller.some((k) => /benzer alım/i.test(k.baslik));

  function alan<K extends keyof Form>(k: K, deger: string) {
    setForm((f) => ({ ...f, [k]: deger }));
    if (hatalar[k]) setHatalar((h) => ({ ...h, [k]: undefined }));
  }

  function ilerle() {
    if (adim === 0) {
      const h = formuDenetle(form);
      setHatalar(h);
      const eksik = ihtiyaclar.filter((k) => !k.ad.trim() || !(k.miktar > 0)).length;
      const ihtiyacMesaji = ihtiyaclar.length === 0 ? "İhtiyaç listesine en az bir kalem ekleyin." : eksik ? `${eksik} kalemin adı ya da miktarı eksik.` : "";
      setIhtiyacHatasi(ihtiyacMesaji);
      if (Object.keys(h).length || ihtiyacMesaji) return;
    }
    if (adim === 1 && engelVarMi(kontroller)) {
      setEngelMesaji("Kırmızı işaretli kontrol çözülmeden onay belgesine geçilemez.");
      return;
    }
    setEngelMesaji("");
    setAdim((a) => a + 1);
  }

  async function kaydet() {
    if (engelVarMi(kontroller)) {
      setEngelMesaji("Kırmızı işaretli kontrol çözülmeden dosya açılamaz.");
      return;
    }
    setEngelMesaji("");
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
        asama: "ihtiyac",
        sonIslem: tarih,
        sureliIs,
      });
      // İhtiyaç listesi piyasa araştırmasının kalemleri olur; fiyat isteme ve teklif yazıları buradan başlar.
      await depo.piyasaKaydet({
        ...bosArastirma(dosyaNo),
        kalemler: ihtiyaclar.map((k) => ({ ...k, ad: k.ad.trim(), ozellik: k.ozellik?.trim(), birim: k.birim.trim() })),
        gorevliler: gorevli.piyasaGorevlileri,
        yazi: bosYazi(tarih),
      });
      // Sihirbazda girilen ve basamaklarda kullanılan bilgiler dosya kaydına geçer.
      await depo.basamaklarKaydet(
        basamaklariTamamla({ alimId: dosyaNo, talepEden: form.birim.trim(), nitelik: form.nitelik.trim(), bolmeGerekcesi: bolmeGerekcesi.trim() }, tarih),
      );
      await olayKaydet(
        depo,
        ayarlar,
        dosyaNo,
        "olusturuldu",
        `Dosya açıldı, dayanak ${bent}, ${ihtiyaclar.length} kalem, tahmini tutar ${tl(tutar)}${bolmeGerekcesi.trim() ? `; bölme açıklaması: ${bolmeGerekcesi.trim()}` : ""}`,
      );
      await yenile();
      navigate(`/dosyalar/${dosyaNo}`);
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
              <textarea id="nitelik" rows={3} value={form.nitelik} onChange={(e) => alan("nitelik", e.target.value)} placeholder="Boş bırakılırsa ihtiyaç listesinden yazılır" />
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
            <label className="secim tam">
              <input type="checkbox" checked={sureliIs} onChange={(e) => setSureliIs(e.target.checked)} />
              <span>
                <span className="kalin">Teslimi veya yapımı belli bir süre gerektiren iş</span>
                <span className="soluk kucuk blok">Bakım, kiralama, sürekli hizmet gibi işlerde sipariş yazısı yerine sözleşme zorunludur (Doğrudan Temin Tebliği m.4/5).</span>
              </span>
            </label>
          </div>
        </section>
      )}

      {adim === 0 && (
        <section className="panel yazdirma" aria-labelledby="liste-baslik">
          <div>
            <h2 id="liste-baslik">İhtiyaç listesi</h2>
            <p className="soluk kucuk">Alınacak malzeme ya da hizmetleri yazın. Liste onay belgesine EK-1 olarak, firmalara gidecek teklif cetveline de kalem kalem girer.</p>
          </div>
          <IhtiyacListesiDuzenleyici
            kalemler={ihtiyaclar}
            degistir={(k) => {
              setIhtiyaclar(k);
              setIhtiyacHatasi("");
            }}
          />
          {ihtiyacHatasi && (
            <span className="hata-yazi" role="alert">
              {ihtiyacHatasi}
            </span>
          )}
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
            {benzerAlimVar && (
              <div className="alan">
                <label htmlFor="bolme-gerekcesi">Bölme yasağı açıklaması (4734 md. 5)</label>
                <textarea
                  id="bolme-gerekcesi"
                  rows={3}
                  value={bolmeGerekcesi}
                  onChange={(e) => setBolmeGerekcesi(e.target.value)}
                  placeholder="Önceki alım farklı dönemin ihtiyacıydı; bu ihtiyaç sonradan ortaya çıktı."
                  aria-describedby="bolme-not"
                />
                <span id="bolme-not" className="soluk kucuk">
                  Onay belgesinin açıklamalar bölümüne ve denetim izine yazılır.
                </span>
              </div>
            )}
          </aside>
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
          {adim === 0 ? (
            <button type="button" className="dugme dugme-ana" onClick={ilerle}>
              Dayanağa geç
            </button>
          ) : (
            <button type="button" className="dugme dugme-ana" onClick={() => void kaydet()} disabled={kaydediliyor}>
              {kaydediliyor ? "Kaydediliyor…" : "Dosyayı aç, ihtiyaç onayına geç"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
