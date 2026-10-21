import { useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import { bentBilgisi, dayanakKontrolleri, engelVarMi, tutarCoz, yeniDosyaNo } from "../../domain/sihirbaz";
import { basamaklariTamamla } from "../../domain/basamaklar";
import { dosyaKopyasi, kopyalanabilirAlimlar, type DosyaKopyasi } from "../../domain/gecmis";
import { UYGULAMA_BENDI } from "../../domain/gorunurluk";
import { olayKaydet } from "../../data/olay";
import { belgeGorevlileri } from "../../domain/personel";
import { bosArastirma, bosYazi, type PiyasaKalemi } from "../../domain/piyasa";
import { aktarilanlariKalemYap, IhtiyacListesiDuzenleyici, yeniKalem } from "../IhtiyacListesi";
import { bugun, tl, tutarGirdisi, uzunTarih } from "../bicim";
import { KontrolSatiri } from "../KontrolSatiri";
import { useGecmisKalemler } from "../useGecmis";
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
const ADIMLAR = ["İhtiyaç", "22/d kontrolleri ve dosyanın açılması"];

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
  const { depo, alimlar, tumAlimlar, ayarlar, limitDonemleri, yenile } = useOutletContext<Veri>();
  const navigate = useNavigate();
  const tarih = bugun();
  // Numara gizli eski kayıtlar dahil bütün kayıtlardan üretilir; çakışma olmaz.
  const dosyaNo = yeniDosyaNo(tumAlimlar, Number(tarih.slice(0, 4)));

  const [adim, setAdim] = useState(0);
  const [form, setForm] = useState<Form>({ konu: "", nitelik: "", tutar: "", ekonomikKod: "", kalemKodu: "", birim: "" });
  const [sureliIs, setSureliIs] = useState(false);
  const [ihtiyaclar, setIhtiyaclar] = useState<PiyasaKalemi[]>(() => [yeniKalem()]);
  const [ihtiyacHatasi, setIhtiyacHatasi] = useState("");
  const [hatalar, setHatalar] = useState<Hatalar>({});
  // Görevliler Personel ve görevler ekranındaki atamalardan gelir; dosya için değiştirilebilir.
  const gorevli = belgeGorevlileri(ayarlar);
  const [bolmeGerekcesi, setBolmeGerekcesi] = useState("");
  const [engelMesaji, setEngelMesaji] = useState("");
  const [kayitHatasi, setKayitHatasi] = useState("");
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const gecmis = useGecmisKalemler({ depo, alimlar });
  // Tamamlanmış bir dosyanın benzeri açılırken onun bilgileri forma dolar; ?kaynak= ile dosya özetinden de gelinir.
  const [aramaParametreleri] = useSearchParams();
  const kaynaklar = useMemo(() => kopyalanabilirAlimlar(alimlar), [alimlar]);
  const [kopya, setKopya] = useState<DosyaKopyasi | null>(null);
  const [kopyaHatasi, setKopyaHatasi] = useState("");

  async function kaynaktanDoldur(id: string) {
    setKopyaHatasi("");
    const kaynak = alimlar.find((a) => a.id === id);
    if (!kaynak) return;
    try {
      const [p, d] = await Promise.all([depo.piyasaGetir(id), depo.basamaklarGetir(id)]);
      const k = dosyaKopyasi(kaynak, p, d);
      setForm({ konu: k.konu, nitelik: k.nitelik, tutar: k.tutar ? tutarGirdisi(k.tutar) : "", ekonomikKod: k.ekonomikKod, kalemKodu: k.kalemKodu, birim: k.talepEden });
      setSureliIs(k.sureliIs);
      setIhtiyaclar(k.kalemler.length ? aktarilanlariKalemYap(k.kalemler) : [yeniKalem()]);
      setHatalar({});
      setIhtiyacHatasi("");
      setKopya(k);
    } catch (e) {
      setKopyaHatasi(`${id} dosyası okunamadı. ${String(e)}`);
    }
  }

  const ilkKaynak = aramaParametreleri.get("kaynak");
  useEffect(() => {
    if (ilkKaynak) void kaynaktanDoldur(ilkKaynak);
    // Yalnız sayfa açılışında; sonraki seçimler açılır listeden yapılır.
  }, [ilkKaynak]);

  const tutar = tutarCoz(form.tutar) ?? 0;
  const kalemler = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of alimlar) if (!m.has(a.kalemKodu)) m.set(a.kalemKodu, a.konu);
    return [...m.entries()];
  }, [alimlar]);
  const kontroller = useMemo(
    () => dayanakKontrolleri({ onayTarihi: tarih, tutar, ekonomikKod: form.ekonomikKod, kalemKodu: form.kalemKodu.trim(), sureliIs }, tumAlimlar, ayarlar, limitDonemleri),
    [tarih, tutar, form.ekonomikKod, form.kalemKodu, sureliIs, tumAlimlar, ayarlar, limitDonemleri],
  );
  const bilgi = bentBilgisi(UYGULAMA_BENDI);
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
        bent: UYGULAMA_BENDI,
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
      // Benzeri açılan dosyanın teslim yeri ve şartları da geçer; tarihler, sayılar ve fiyatlar yeni dosyada yeniden girilir.
      await depo.basamaklarKaydet(
        basamaklariTamamla(
          {
            alimId: dosyaNo,
            talepEden: form.birim.trim(),
            nitelik: form.nitelik.trim(),
            bolmeGerekcesi: bolmeGerekcesi.trim(),
            ...(kopya ? { teslimYeri: kopya.teslimYeri, ...(kopya.sartlar ? { sartlar: kopya.sartlar } : {}) } : {}),
          },
          tarih,
        ),
      );
      await olayKaydet(
        depo,
        ayarlar,
        dosyaNo,
        "olusturuldu",
        `Dosya açıldı, dayanak ${UYGULAMA_BENDI}, ${ihtiyaclar.length} kalem, tahmini tutar ${tl(tutar)}${kopya ? `; ${kopya.kaynakId} dosyasının benzeri olarak` : ""}${bolmeGerekcesi.trim() ? `; bölme açıklaması: ${bolmeGerekcesi.trim()}` : ""}`,
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

      {adim === 0 && kaynaklar.length > 0 && (
        <section className="panel yazdirma" aria-labelledby="kaynak-baslik">
          <div>
            <h2 id="kaynak-baslik">Önceki dosyadan başlat</h2>
            <p className="soluk kucuk">Tamamlanmış bir alımın konusu, bütçe tertibi, ihtiyaç listesi, teslim yeri ve şartları bu dosyaya kopyalanır. Tarih, sayı, firma ve fiyatlar kopyalanmaz.</p>
          </div>
          <div className="form-izgara">
            <div className="alan tam">
              <label htmlFor="kaynak">Benzeri açılacak dosya</label>
              <select id="kaynak" value={kopya?.kaynakId ?? ""} onChange={(e) => (e.target.value ? void kaynaktanDoldur(e.target.value) : setKopya(null))}>
                <option value="">Boş dosyayla başla</option>
                {kaynaklar.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.id} · {a.konu} · {uzunTarih(a.onayTarihi)} · {tl(a.tutar)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {kopya && (
            <div className="bant bant-bilgi" role="status">
              {kopya.kaynakId} dosyasından {kopya.kalemler.length} kalem ve bilgiler kopyalandı. Tahmini tutarı ve miktarları yeni döneme göre gözden geçirin.
            </div>
          )}
          {kopyaHatasi && (
            <div className="bant bant-hata" role="alert">
              {kopyaHatasi}
            </div>
          )}
        </section>
      )}

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
                {form.ekonomikKod && !EKONOMIK_KODLAR.some(([kod]) => kod === form.ekonomikKod) && <option value={form.ekonomikKod}>{form.ekonomikKod}</option>}
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
            gecmis={gecmis}
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
              <h2 id="bent-baslik">22/d kontrolleri</h2>
              <p className="soluk">Parasal limit, yıllık %10 sınırı (md. 62/ı) ve bölme yasağı (md. 5) canlı denetlenir.</p>
            </div>
            <section className="panel" aria-labelledby="belge-baslik">
              <h2 id="belge-baslik">Dosyaya eklenecek belgeler · {UYGULAMA_BENDI}</h2>
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
