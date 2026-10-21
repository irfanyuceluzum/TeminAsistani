import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { BasamakBaglami } from "../sayfalar/DosyaCalismaAlani";
import { BelgeOnizleme } from "../BelgeOnizleme";
import { KontrolSatiri } from "../KontrolSatiri";
import { KucukA4 } from "./KucukA4";
import { muayeneTalebiSayfalari, muayeneKabulTutanagiSayfalari } from "./belgeler";
import type { Kontrol } from "../../domain/sihirbaz";
import { evrakFormu, evrakKaydiYap } from "../../domain/basamaklar";
import { bugun } from "../bicim";
import { BOS_GOREVLER, KOMISYON_KURALI, KOMISYONSUZ_KABUL_NOTU, belgeGorevlileri } from "../../domain/personel";
import { dosyaKomisyonuKontrolleri, kabulSonucu, muayeneKalemKontrolleri, muayeneOlustur, muayeneSonrasiDosya, teslimSiparisKontrolu, type KomisyonUyesi, type Muayene } from "../../domain/muayene";

export function MuayeneBasamagi({ b }: { b: BasamakBaglami }) {
  const navigate = useNavigate();
  const { alim, dosya, muayene, basamak, piyasa, veri } = b;
  const { ayarlar, tedarikciler } = veri;
  const isTalep = basamak.no === 9; // 9: Talep yazısı, 10-11: Kabul tutanağı

  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [onizle, setOnizle] = useState(false);
  const [ilkTalep] = useState(() => evrakFormu(b.evraklar["muayene-talebi"], bugun()));
  const [talepSayi, setTalepSayi] = useState(ilkTalep.sayi);
  const [talepTarih, setTalepTarih] = useState(ilkTalep.tarih);
  const [mesaj, setMesaj] = useState("");

  const [faturaNo, setFaturaNo] = useState(muayene?.faturaNo || "");
  const [faturaTarih, setFaturaTarih] = useState(muayene?.faturaTarihi || bugun());
  const [teslimTarihi, setTeslimTarihi] = useState(muayene?.teslimTarihi || muayene?.muayeneTarihi || bugun());
  const [muayeneTarihi, setMuayeneTarihi] = useState(muayene?.muayeneTarihi || bugun());
  // Kalemler piyasa araştırmasının sonucundan gelir; kabul miktarları burada düzeltilir.
  const [taslak, setTaslak] = useState<Muayene>(() => muayene ?? muayeneOlustur(alim, piyasa, bugun(), belgeGorevlileri(ayarlar).komisyon));

  const firmaAdi = (id: string) => tedarikciler.find((t) => t.id === id)?.ad || "Bilinmeyen Firma";

  const aktifMuayene: Muayene = useMemo(
    () => ({ ...taslak, faturaNo, faturaTarihi: faturaTarih, teslimTarihi, muayeneTarihi }),
    [taslak, faturaNo, faturaTarih, teslimTarihi, muayeneTarihi],
  );
  const sonuc = kabulSonucu(aktifMuayene);
  const kabulDegistir = (kalemId: string, miktar: number) =>
    setTaslak((m) => ({ ...m, kalemler: m.kalemler.map((x) => (x.kalemId === kalemId ? { ...x, kabulMiktari: Math.max(0, miktar) } : x)) }));

  const faturaDegistir = (kalemId: string, miktar: number) =>
    setTaslak((m) => ({ ...m, kalemler: m.kalemler.map((x) => (x.kalemId === kalemId ? { ...x, faturaMiktari: Math.max(0, miktar) } : x)) }));
  const uyeDegistir = (i: number, d: Partial<KomisyonUyesi>) =>
    setTaslak((m) => ({
      ...m,
      uyeler: m.uyeler.map((u, j) => (j === i ? { ...u, ...d } : d.rol === "baskan" ? { ...u, rol: "uye" } : u)),
    }));
  const uyeleriYenidenDoldur = () => setTaslak((m) => ({ ...m, uyeler: belgeGorevlileri(ayarlar).komisyon.map((u) => ({ ...u })) }));

  const kontroller = useMemo((): Kontrol[] => {
    const k: Kontrol[] = [];
    const g = ayarlar.gorevler;

    if (isTalep) {
      if (!g?.gerceklestirme) {
        k.push({
          durum: "engel",
          baslik: "Gerçekleştirme Görevlisi tanımlanmamış",
          detay: "Muayene talep yazısını Gerçekleştirme Görevlisi imzalar.",
        });
      } else if (!talepSayi.trim()) {
        k.push({ durum: "yapilacak", baslik: "Yazı sayısı girilmedi", detay: "Talep yazısının sayısını girin." });
      } else {
        k.push({ durum: "tamam", baslik: "Talep yazısı hazır", detay: "Muayene komisyonuna sevk yazısı düzenlendi." });
      }
    } else {
      k.push(...dosyaKomisyonuKontrolleri(aktifMuayene.uyeler, ayarlar.personel ?? [], g ?? BOS_GOREVLER));

      k.push(...muayeneKalemKontrolleri(aktifMuayene));
      const teslim = teslimSiparisKontrolu(teslimTarihi, b.evraklar["siparis-yazisi"]?.tarih);
      if (teslim) k.push(teslim);
    }

    return k;
  }, [isTalep, ayarlar, aktifMuayene, b.evraklar, teslimTarihi, talepSayi]);

  const engelVar = kontroller.some((k) => k.durum === "engel");

  const belgeSayfalari = useMemo(() => {
    if (isTalep) {
      return muayeneTalebiSayfalari(
        { alim, ayarlar, dosya, kalemler: b.kalemler },
        { sayi: talepSayi, tarih: talepTarih }
      );
    }
    return muayeneKabulTutanagiSayfalari(
      { alim, ayarlar, dosya, kalemler: b.kalemler },
      aktifMuayene,
      firmaAdi
    );
  }, [isTalep, alim, ayarlar, dosya, b.kalemler, talepSayi, talepTarih, aktifMuayene, tedarikciler]);

  const onaylaVeIlerle = async () => {
    setMesaj("");
    let talep, fatura;
    try {
      talep = evrakKaydiYap({ tarih: talepTarih, sayi: talepSayi });
      fatura = evrakKaydiYap({ tarih: faturaTarih, sayi: faturaNo });
    } catch (e) {
      setMesaj((e as Error).message);
      return;
    }
    setKaydediliyor(true);
    try {
      if (isTalep) {
        await b.evrakDegistir("muayene-talebi", "Muayene talep yazısı", talep);
        navigate(`/dosyalar/${alim.id}/basamak/10`);
      } else {
        await veri.depo.muayeneKaydet({
          ...aktifMuayene,
          tamamlandi: true,
        });
        await b.evrakDegistir("muayene-raporu", "Muayene raporu", fatura);
        // Evrak kontrol listesindeki karşılıkları: fatura ve muayene ve kabul tutanağı
        await b.evrakDegistir("fatura", "Fatura", fatura);
        await b.evrakDegistir("muayene-tutanagi", "Muayene ve kabul tutanağı", { ...fatura, not: "" });
        const sonraki = muayeneSonrasiDosya(aktifMuayene);
        await b.alimDegistir({ asama: sonraki.asama, tutar: sonraki.tutar }, sonraki.aciklama);
        navigate(`/dosyalar/${alim.id}/basamak/12`);
      }
    } finally {
      setKaydediliyor(false);
    }
  };

  return (
    <>
      <div className="iki-sutun">
        <section className="panel genis-form" aria-labelledby="muayene-baslik">
          <div className="panel-baslik-satiri">
            <div>
              <h2 id="muayene-baslik">
                {basamak.no}. {basamak.ad}
              </h2>
              <p className="soluk kucuk">
                {isTalep
                  ? "Mal veya hizmet tesliminde Muayene ve Kabul Komisyonuna talep yazısı gönderilir."
                  : "Teslim edilen mallar komisyonca incelenir, şartlara uygunluğu tutanak altına alınır."}
              </p>
            </div>
          </div>

          {isTalep ? (
            <div className="form-izgara" style={{ marginTop: "12px" }}>
              <div className="alan">
                <label htmlFor="talep-sayi">Talep Yazısı Sayısı</label>
                <input
                  id="talep-sayi"
                  type="text"
                  value={talepSayi}
                  onChange={(e) => setTalepSayi(e.target.value)}
                  placeholder="Örn: E-98765432-800-45"
                />
              </div>
              <div className="alan">
                <label htmlFor="talep-tarih">Yazı Tarihi</label>
                <input
                  id="talep-tarih"
                  type="date"
                  value={talepTarih}
                  onChange={(e) => setTalepTarih(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="form-izgara" style={{ marginTop: "12px" }}>
              <div className="alan">
                <label htmlFor="fatura-no">Yüklenici Fatura No</label>
                <input
                  id="fatura-no"
                  type="text"
                  value={faturaNo}
                  onChange={(e) => setFaturaNo(e.target.value)}
                  placeholder="Örn: GIB2026000000123"
                />
              </div>
              <div className="alan">
                <label htmlFor="fatura-tarih">Fatura Tarihi</label>
                <input
                  id="fatura-tarih"
                  type="date"
                  value={faturaTarih}
                  onChange={(e) => setFaturaTarih(e.target.value)}
                />
              </div>
              <div className="alan">
                <label htmlFor="teslim-tarihi">Teslim tarihi</label>
                <input id="teslim-tarihi" type="date" value={teslimTarihi} onChange={(e) => setTeslimTarihi(e.target.value)} />
              </div>
              <div className="alan">
                <label htmlFor="muayene-tarihi">Muayene tarihi</label>
                <input id="muayene-tarihi" type="date" value={muayeneTarihi} onChange={(e) => setMuayeneTarihi(e.target.value)} />
              </div>
              <div className="alan tam">
                <label htmlFor="muayene-yeri">Muayene yeri</label>
                <input id="muayene-yeri" type="text" value={taslak.yer} onChange={(e) => setTaslak((m) => ({ ...m, yer: e.target.value }))} placeholder="Örn: Okul depo odası" />
              </div>
              <div className="alan tam">
                <span className="etiket-yazi">Kabul sonucu</span>
                <div className="salt kalin" style={{ color: sonuc.sonuc === "tam" ? "var(--basari)" : sonuc.sonuc === "kismi" ? "var(--uyari)" : "var(--tehlike)" }}>
                  {sonuc.metin}
                </div>
              </div>
              <div className="tablo-kutu">
                <table className="cetvel tam">
                  <thead>
                    <tr>
                      <th scope="col">Kalem</th>
                      <th scope="col" className="sag">
                        Sipariş
                      </th>
                      <th scope="col" className="sag">
                        Fatura
                      </th>
                      <th scope="col" className="sag">
                        Kabul
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {taslak.kalemler.map((x) => (
                      <tr key={x.kalemId}>
                        <td>{x.ad}</td>
                        <td className="sag mono">
                          {x.siparisMiktari} {x.birim}
                        </td>
                        <td className="sag">
                          <input
                            className="girdi mono fiyat-girdi"
                            type="number"
                            min={0}
                            max={x.siparisMiktari}
                            value={x.faturaMiktari}
                            aria-label={`${x.ad} fatura miktarı`}
                            onChange={(e) => faturaDegistir(x.kalemId, Number(e.target.value) || 0)}
                          />
                        </td>
                        <td className="sag">
                          <input
                            className="girdi mono fiyat-girdi"
                            type="number"
                            min={0}
                            max={x.faturaMiktari}
                            value={x.kabulMiktari}
                            aria-label={`${x.ad} kabul miktarı`}
                            onChange={(e) => kabulDegistir(x.kalemId, Number(e.target.value) || 0)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="alan tam">
                <div className="panel-baslik-satiri">
                  <span className="etiket-yazi">Muayene ve kabul komisyonu</span>
                  <div className="dugme-grubu">
                    <button type="button" className="dugme kucuk-dugme" onClick={uyeleriYenidenDoldur}>
                      Görevlendirmeden yeniden doldur
                    </button>
                    <button type="button" className="dugme kucuk-dugme" onClick={() => setTaslak((m) => ({ ...m, uyeler: [...m.uyeler, { ad: "", unvan: "", rol: "uye" }] }))}>
                      Üye ekle
                    </button>
                  </div>
                </div>
                <p className="ipucu">
                  {KOMISYON_KURALI} {KOMISYONSUZ_KABUL_NOTU}
                </p>
                {taslak.uyeler.map((u, i) => (
                  <div key={i} className="kalem-satiri">
                    <label className="onay-kutusu baskan-secimi">
                      <input type="radio" name="baskan" checked={u.rol === "baskan"} onChange={() => uyeDegistir(i, { rol: "baskan" })} />
                      Başkan
                    </label>
                    <label className="gizli" htmlFor={`uye-ad-${i}`}>
                      {i + 1}. üyenin adı
                    </label>
                    <input id={`uye-ad-${i}`} className="girdi genis-girdi" value={u.ad} onChange={(e) => uyeDegistir(i, { ad: e.target.value })} placeholder="Ad Soyad" />
                    <label className="gizli" htmlFor={`uye-unvan-${i}`}>
                      {i + 1}. üyenin unvanı
                    </label>
                    <input id={`uye-unvan-${i}`} className="girdi unvan-girdi" value={u.unvan} onChange={(e) => uyeDegistir(i, { unvan: e.target.value })} placeholder="Unvan" />
                    <button
                      type="button"
                      className="dugme kucuk-dugme"
                      aria-label={`${u.ad || `${i + 1}. üyeyi`} çıkar`}
                      onClick={() => setTaslak((m) => ({ ...m, uyeler: m.uyeler.filter((_, j) => j !== i) }))}
                    >
                      Çıkar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: "16px" }}>
            <h3 style={{ fontSize: "14px", marginBottom: "8px" }}>Kontroller ve Mevzuat Kuralları</h3>
            <div className="sutun" style={{ gap: "6px" }}>
              {kontroller.map((k, i) => (
                <KontrolSatiri key={i} k={k} />
              ))}
            </div>
          </div>

          {mesaj && (
            <div className="bant bant-hata" role="alert" style={{ marginTop: "12px" }}>
              {mesaj}
            </div>
          )}

          <div className="dugme-grubu" style={{ marginTop: "16px" }}>
            <button
              type="button"
              className="dugme dugme-ana"
              disabled={kaydediliyor || engelVar}
              onClick={() => void onaylaVeIlerle()}
              style={{ fontSize: "14px", padding: "10px 20px" }}
            >
              {kaydediliyor
                ? "Kaydediliyor…"
                : isTalep
                ? "Talep Yazısını Onayla ve Sonraki Adıma Geç (10. Muayene Tutanağı) ›"
                : "Kabul Tutanağını Onayla ve Sonraki Adıma Geç (12. Taşınır İşlem Fişi) ›"}
            </button>
            <button
              type="button"
              className="dugme"
              onClick={() => setOnizle(true)}
            >
              Tam ekran önizle ve yazdır
            </button>
          </div>
        </section>

        <section className="panel kucuk-onizleme" aria-labelledby="muayene-a4-baslik">
          <div className="panel-baslik-satiri">
            <h2 id="muayene-a4-baslik">A4 görünüşü</h2>
            <span className="soluk kucuk">{belgeSayfalari.length} sayfa</span>
          </div>
          <KucukA4>{belgeSayfalari[0]}</KucukA4>
          <button
            type="button"
            className="dugme dugme-ana"
            onClick={() => setOnizle(true)}
            style={{ width: "100%", marginTop: "10px" }}
          >
            Tam ekran önizle ve yazdır
          </button>
        </section>
      </div>

      {onizle && (
        <BelgeOnizleme
          baslik={isTalep ? "Muayene Talep Yazısı" : "Muayene ve Kabul Tutanağı"}
          sayfalar={belgeSayfalari}
          kapat={() => setOnizle(false)}
        />
      )}
    </>
  );
}
