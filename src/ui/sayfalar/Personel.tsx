import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { BOS_GOREVLER, gorevKontrolleri, kisi, kisininGorevleri, kisiYazisi, personelCikar } from "../../domain/personel";
import type { GorevAtamalari, Personel as PersonelKaydi } from "../../domain/tipler";
import { IdareBasligi } from "../IdareBasligi";
import { KontrolSatiri } from "../KontrolSatiri";
import type { Veri } from "../useVeri";

function bas(ad: string): string {
  return ad
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((k) => k[0].toLocaleUpperCase("tr-TR"))
    .join("");
}

export function Personel() {
  const { depo, ayarlar, yenile } = useOutletContext<Veri>();
  const [personel, setPersonel] = useState<PersonelKaydi[]>(ayarlar.personel ?? []);
  const [gorevler, setGorevler] = useState<GorevAtamalari>(ayarlar.gorevler ?? BOS_GOREVLER);
  const [yeni, setYeni] = useState({ ad: "", unvan: "" });
  const [ekleHatasi, setEkleHatasi] = useState("");
  const [mesaj, setMesaj] = useState<{ tur: "tamam" | "hata"; metin: string } | null>(null);

  // Kaydedilen ayarlar değişince (başka ekrandan da olabilir) taslak yeniden kurulur.
  const kayitli = JSON.stringify({ p: ayarlar.personel ?? [], g: ayarlar.gorevler ?? BOS_GOREVLER });
  useEffect(() => {
    setPersonel(ayarlar.personel ?? []);
    setGorevler(ayarlar.gorevler ?? BOS_GOREVLER);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kayitli]);

  const degisti = JSON.stringify({ p: personel, g: gorevler }) !== kayitli;
  const kontroller = useMemo(() => gorevKontrolleri(personel, gorevler), [personel, gorevler]);
  const ad = (id: string | null) => kisi(personel, id);

  function ata(d: Partial<GorevAtamalari>) {
    setMesaj(null);
    setGorevler((g) => ({ ...g, ...d }));
  }

  function yetkiliSec(alan: "harcamaYetkilisi" | "gerceklestirme", id: string | null) {
    setMesaj(null);
    setGorevler((g) => {
      const digerAlan = alan === "harcamaYetkilisi" ? "gerceklestirme" : "harcamaYetkilisi";
      const diger = g[digerAlan] === id ? null : g[digerAlan];
      return { ...g, [alan]: id, [digerAlan]: diger };
    });
  }

  function listeDegistir(alan: "piyasaGorevlileri" | "muayeneUyeleri" | "yaklasikMaliyetGorevlileri", id: string) {
    const liste = gorevler[alan] ?? [];
    ata({ [alan]: liste.includes(id) ? liste.filter((x) => x !== id) : [...liste, id] });
  }

  function ekle() {
    if (!yeni.ad.trim() || !yeni.unvan.trim()) {
      setEkleHatasi("Ad soyad ve unvanı yazın.");
      return;
    }
    if (personel.some((p) => p.ad.trim().toLocaleLowerCase("tr-TR") === yeni.ad.trim().toLocaleLowerCase("tr-TR"))) {
      setEkleHatasi("Bu adla kayıtlı bir personel var.");
      return;
    }
    setMesaj(null);
    setPersonel([...personel, { id: "p" + Date.now().toString(36), ad: yeni.ad.trim(), unvan: yeni.unvan.trim() }]);
    setYeni({ ad: "", unvan: "" });
  }

  function cikar(id: string) {
    const sonuc = personelCikar(id, personel, gorevler);
    setMesaj(null);
    setPersonel(sonuc.personel);
    setGorevler(sonuc.gorevler);
  }

  async function kaydet() {
    try {
      await depo.ayarlarKaydet({ ...ayarlar, personel, gorevler });
      await yenile();
      setMesaj({ tur: "tamam", metin: "Görevlendirmeler kaydedildi." });
    } catch (e) {
      setMesaj({ tur: "hata", metin: `Kaydedilemedi. ${String(e)}` });
    }
  }

  const secim = (id: string, deger: string | null, degis: (v: string | null) => void, etiket: string, adaylar: PersonelKaydi[] = personel) => (
    <div className="alan">
      <label htmlFor={id}>{etiket}</label>
      <select id={id} value={deger ?? ""} onChange={(e) => degis(e.target.value || null)}>
        <option value="">Seçin</option>
        {adaylar.map((p) => (
          <option key={p.id} value={p.id}>
            {p.ad} · {p.unvan}
          </option>
        ))}
      </select>
    </div>
  );

  const hy = ad(gorevler.harcamaYetkilisi);
  const gg = ad(gorevler.gerceklestirme);
  const yetkiliIdler = new Set([gorevler.harcamaYetkilisi, gorevler.gerceklestirme].filter(Boolean));

  return (
    <div className="sayfa">
      <header className="sayfa-ust">
        <div>
          <h1>Personel ve görevler</h1>
          <p className="soluk">Görevlendirmeler onay belgesine, yaklaşık maliyet cetveline, teklif isteme yazısına ve muayene komisyonuna kendiliğinden dolar. Dosya bazında değiştirilebilir.</p>
        </div>
        <div className="satir">
          {degisti && (
            <button
              type="button"
              className="dugme"
              onClick={() => {
                setPersonel(ayarlar.personel ?? []);
                setGorevler(ayarlar.gorevler ?? BOS_GOREVLER);
                setMesaj(null);
              }}
            >
              Değişiklikleri geri al
            </button>
          )}
          <button type="button" className="dugme dugme-ana" onClick={kaydet}>
            Görevlendirmeleri kaydet
          </button>
        </div>
      </header>

      {mesaj && (
        <div className={mesaj.tur === "tamam" ? "bant bant-bilgi" : "bant bant-hata"} role="status">
          {mesaj.metin}
        </div>
      )}

      <div className="iki-sutun">
        <section className="panel bosluksuz personel-listesi" aria-labelledby="personel-baslik">
          <div className="panel-ust">
            <h2 id="personel-baslik">Kurum personeli</h2>
            <span className="soluk kucuk">{personel.length} kişi</span>
          </div>
          {personel.length === 0 && <p className="soluk bos">Henüz personel yok. Aşağıdan ekleyin.</p>}
          <ul className="personel-satirlari">
            {personel.map((p) => {
              const g = kisininGorevleri(p.id, gorevler);
              return (
                <li key={p.id} className="personel-satiri">
                  <span className="firma-bas" aria-hidden="true">
                    {bas(p.ad)}
                  </span>
                  <span className="firma-satir-metin">
                    <span>
                      <span className="kalin">{p.ad}</span> <span className="soluk kucuk">· {p.unvan}</span>
                    </span>
                    <span className="gorev-etiketleri">
                      {(g.length ? g : ["Görevi yok"]).map((x) => (
                        <span key={x} className={g.length ? "gorev-etiketi" : "gorev-etiketi soluk"}>
                          {x}
                        </span>
                      ))}
                    </span>
                  </span>
                  <button type="button" className="dugme kucuk-dugme" aria-label={`${p.ad} kişisini çıkar`} onClick={() => cikar(p.id)}>
                    Çıkar
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="personel-ekle">
            <span className="kalin kucuk">Personel ekle</span>
            <div className="satir">
              <label htmlFor="yeni-ad" className="gizli">
                Ad soyad
              </label>
              <input
                id="yeni-ad"
                className="girdi"
                value={yeni.ad}
                onChange={(e) => {
                  setYeni({ ...yeni, ad: e.target.value });
                  setEkleHatasi("");
                }}
                placeholder="Ad Soyad"
              />
              <label htmlFor="yeni-unvan" className="gizli">
                Unvan
              </label>
              <input
                id="yeni-unvan"
                className="girdi"
                value={yeni.unvan}
                onChange={(e) => {
                  setYeni({ ...yeni, unvan: e.target.value });
                  setEkleHatasi("");
                }}
                placeholder="Öğretmen"
              />
              <button type="button" className="dugme kucuk-dugme" onClick={ekle}>
                Ekle
              </button>
            </div>
            {ekleHatasi && (
              <span className="hata-yazi" role="alert">
                {ekleHatasi}
              </span>
            )}
          </div>
        </section>

        <div className="genis-panel sutun">
          <section className="panel" aria-labelledby="harcama-baslik">
            <div>
              <h2 id="harcama-baslik">Harcama görevlileri</h2>
              <p className="soluk kucuk">
                Onay belgesinin ve ödeme emrinin imzacılarıdır. <strong>Görevler ayrılığı ilkesi (Kamu İç Kontrol Standartları, Standart 9) gereği teslim alma, piyasa araştırması ve yaklaşık maliyet komisyonlarında yer almamaları önerilir; açık bir yasak yoktur, seçerseniz uyarı görürsünüz.</strong>
              </p>
            </div>
            <div className="form-izgara">
              {secim("hy", gorevler.harcamaYetkilisi, (v) => yetkiliSec("harcamaYetkilisi", v), "Harcama yetkilisi")}
              {secim("gg", gorevler.gerceklestirme, (v) => yetkiliSec("gerceklestirme", v), "Gerçekleştirme görevlisi")}
            </div>
          </section>

          <section className="panel" aria-labelledby="ym-baslik">
            <div>
              <h2 id="ym-baslik">Yaklaşık maliyet komisyonu / görevlileri</h2>
              <p className="soluk kucuk">Fiyat araştırmasını derler ve resmi Yaklaşık Maliyet Hesap Cetveli'ni imzalar. Harcama Yetkilisi ve Gerçekleştirme Görevlisinin seçilmesi görevler ayrılığı açısından önerilmez.</p>
            </div>
            <div className="filtreler" role="group" aria-labelledby="ym-baslik">
              {personel.map((p) => {
                const yasakli = yetkiliIdler.has(p.id);
                const secili = (gorevler.yaklasikMaliyetGorevlileri ?? []).includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    className="filtre secim-cipi"
                    aria-pressed={secili}
                    onClick={() => listeDegistir("yaklasikMaliyetGorevlileri", p.id)}
                    title={yasakli ? "Harcama Yetkilisi veya Gerçekleştirme Görevlisi: görevler ayrılığı: önerilmez" : ""}
                  >
                    {p.ad} {yasakli ? "(Yetkili)" : ""}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="panel" aria-labelledby="piyasa-baslik">
            <div>
              <h2 id="piyasa-baslik">Piyasa fiyat araştırması görevlileri</h2>
              <p className="soluk kucuk">Teklif isteme yazısını imzalar, teklifleri toplar ve piyasa tutanağını düzenler. Harcama Yetkilisi ve Gerçekleştirme Görevlisinin seçilmesi görevler ayrılığı açısından önerilmez.</p>
            </div>
            <div className="filtreler" role="group" aria-labelledby="piyasa-baslik">
              {personel.map((p) => {
                const yasakli = yetkiliIdler.has(p.id);
                const secili = gorevler.piyasaGorevlileri.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    className="filtre secim-cipi"
                    aria-pressed={secili}
                    onClick={() => listeDegistir("piyasaGorevlileri", p.id)}
                    title={yasakli ? "Harcama Yetkilisi veya Gerçekleştirme Görevlisi: görevler ayrılığı: önerilmez" : ""}
                  >
                    {p.ad} {yasakli ? "(Yetkili)" : ""}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="panel" aria-labelledby="muayene-baslik">
            <div>
              <h2 id="muayene-baslik">Muayene ve kabul komisyonu (Teslim Alma)</h2>
              <p className="soluk kucuk">Muayene ve kabul tutanağına başkan ve üyeler olarak yazılır. Harcama Yetkilisi ve Gerçekleştirme Görevlisinin seçilmesi görevler ayrılığı açısından önerilmez.</p>
            </div>
            <div className="form-izgara">
              {secim(
                "baskan",
                gorevler.muayeneBaskani,
                (v) => ata({ muayeneBaskani: v, muayeneUyeleri: gorevler.muayeneUyeleri.filter((u) => u !== v) }),
                "Komisyon başkanı",
              )}
            </div>
            <span id="uye-baslik" className="soluk kucuk">
              Üyeler
            </span>
            <div className="filtreler" role="group" aria-labelledby="uye-baslik">
              {personel
                .filter((p) => p.id !== gorevler.muayeneBaskani)
                .map((p) => {
                  const yasakli = yetkiliIdler.has(p.id);
                  const secili = gorevler.muayeneUyeleri.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className="filtre secim-cipi"
                      aria-pressed={secili}
                      onClick={() => listeDegistir("muayeneUyeleri", p.id)}
                      title={yasakli ? "Harcama Yetkilisi veya Gerçekleştirme Görevlisi: görevler ayrılığı: önerilmez" : ""}
                    >
                      {p.ad} {yasakli ? "(Yetkili)" : ""}
                    </button>
                  );
                })}
            </div>
          </section>

          <div className="iki-sutun">
            <section className="panel yan" aria-labelledby="kontrol-baslik" aria-live="polite">
              <h2 id="kontrol-baslik">Kontroller</h2>
              {kontroller.map((k) => (
                <KontrolSatiri key={k.baslik} k={k} />
              ))}
            </section>
            <section className="baslik-onizleme yan" aria-label="Onay belgesinde görünüş">
              <span className="kucuk kalin">Onay belgesinde görünüş</span>
              <article className="belge kucuk-belge">
                <IdareBasligi ayarlar={ayarlar} />
                <div className="belge-baslik">DOĞRUDAN TEMİN ONAY BELGESİ</div>
                <div className="belge-imzalar">
                  <div>
                    <span className="kalin">{gg?.ad ?? "…"}</span>
                    <span>{gg?.unvan}</span>
                    <span>Gerçekleştirme görevlisi</span>
                  </div>
                  <div>
                    <span className="kalin">OLUR</span>
                    <span className="kalin">{hy?.ad ?? "…"}</span>
                    <span>{hy?.unvan}</span>
                    <span>Harcama yetkilisi</span>
                  </div>
                </div>
                <span className="kucuk">
                  Piyasa fiyat araştırması görevlileri:{" "}
                  {gorevler.piyasaGorevlileri
                    .map((id) => ad(id))
                    .filter((p): p is PersonelKaydi => !!p)
                    .map(kisiYazisi)
                    .join(", ") || "…"}
                </span>
              </article>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
