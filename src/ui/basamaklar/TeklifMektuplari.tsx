import { useState, useMemo, useEffect, useRef } from "react";
import { belgeTutari, BOS_DEGER, bugun, tutarMetni, tutarGirdisi } from "../bicim";
import { useNavigate } from "react-router-dom";
import type { BasamakBaglami } from "../sayfalar/DosyaCalismaAlani";
import { BelgeOnizleme } from "../BelgeOnizleme";
import { KontrolSatiri } from "../KontrolSatiri";
import { KucukA4 } from "./KucukA4";
import { teklifIstemeMektubuSayfalari } from "./belgeler";
import { YeniFirmaFormu } from "./YeniFirmaFormu";
import { bosYazi, firmaToplami, kalemTutari, teklifTarihiKontrolleri, type FirmaTeklifi, type TeklifYazisi } from "../../domain/piyasa";
import { tutarCoz, type Kontrol } from "../../domain/sihirbaz";
import { teklifFirmaKontrolleri } from "../../domain/tedarikci";

function hucreKey(firmaId: string, kalemId: string): string {
  return `${firmaId}__${kalemId}`;
}

export function TeklifMektuplariBasamagi({ b }: { b: BasamakBaglami }) {
  const navigate = useNavigate();
  const { alim, piyasa, dosya, veri, piyasaDegistir } = b;
  // Teklif isteme yazısı piyasa araştırması kaydında tutulur (eski piyasa ekranıyla ortak)
  const yazi = piyasa.yazi ?? bosYazi("");
  const yaziDegistir = (d: Partial<TeklifYazisi>) => piyasaDegistir((p) => ({ ...p, yazi: { ...(p.yazi ?? bosYazi("")), ...d } }));
  const { tedarikciler } = veri;

  // Başlangıç teklif listesi: piyasa.teklifler doluysa onu kullan, yoksa yaklaşık maliyetteki firmalarla başlat
  const [teklifler, setTeklifler] = useState<FirmaTeklifi[]>(() => {
    if (piyasa.teklifler && piyasa.teklifler.length > 0) {
      return structuredClone(piyasa.teklifler);
    }
    // Yaklaşık maliyet firmaları varsa onları baz al
    if (dosya.yaklasik.firmalar && dosya.yaklasik.firmalar.length > 0) {
      return dosya.yaklasik.firmalar.map((f) => ({
        tedarikciId: f.tedarikciId,
        teklifTarihi: null,
        yasaklilikSorgusu: null,
        fiyatlar: { ...f.fiyatlar },
        belgeAlindi: f.belgeAlindi,
      }));
    }
    return [];
  });

  // Hücre bazında anlık metinler (kullanıcı yazarken silinme olmaması için kontrollü input state'i)
  const [metinler, setMetinler] = useState<Record<string, string>>(() => {
    const ilkMetinler: Record<string, string> = {};
    const kaynak = (piyasa.teklifler && piyasa.teklifler.length > 0) ? piyasa.teklifler : dosya.yaklasik.firmalar;
    for (const t of kaynak) {
      for (const k of b.kalemler) {
        const fiyat = t.fiyatlar[k.id];
        if (fiyat !== null && fiyat !== undefined && fiyat > 0) {
          ilkMetinler[hucreKey(t.tedarikciId, k.id)] = fiyat ? tutarGirdisi(fiyat) : "";
        }
      }
    }
    return ilkMetinler;
  });

  const [aktifFirmaId, setAktifFirmaId] = useState<string>(() => {
    return teklifler[0]?.tedarikciId || dosya.yaklasik.firmalar[0]?.tedarikciId || "";
  });

  const [yeniFirmaId, setYeniFirmaId] = useState("");
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [bilgiMesaji, setBilgiMesaji] = useState("");
  const [onizle, setOnizle] = useState(false);

  // Otomatik veritabanı senkronizasyonu
  const sonKayit = useRef<string>("");
  useEffect(() => {
    const jsonStr = JSON.stringify(teklifler);
    if (sonKayit.current === jsonStr) return;
    sonKayit.current = jsonStr;

    // Çalışma alanının otomatik kaydı üzerinden yazılır
    piyasaDegistir((p) => ({ ...p, teklifler }));
  }, [teklifler, piyasaDegistir]);

  const firmaAdi = (id: string) => tedarikciler.find((t) => t.id === id)?.ad || "Bilinmeyen Firma";

  const aktifFirmaTeklifi = teklifler.find((t) => t.tedarikciId === (aktifFirmaId || teklifler[0]?.tedarikciId)) ?? teklifler[0];
  const aktifTedarikci = tedarikciler.find((t) => t.id === aktifFirmaTeklifi?.tedarikciId) ?? null;

  // Yaklaşık Maliyetten Fiyatları ve Firmaları Çek
  const yaklasikMaliyettenCek = () => {
    const ymFirmalar = dosya.yaklasik.firmalar;
    if (!ymFirmalar || ymFirmalar.length === 0) {
      setBilgiMesaji("Yaklaşık maliyet basamağında henüz tanımlanmış firma ve fiyat bulunmuyor.");
      return;
    }

    const yeniTeklifler: FirmaTeklifi[] = [];
    const yeniMetinler: Record<string, string> = { ...metinler };

    for (const f of ymFirmalar) {
      yeniTeklifler.push({
        tedarikciId: f.tedarikciId,
        teklifTarihi: null,
        yasaklilikSorgusu: null,
        fiyatlar: { ...f.fiyatlar },
        belgeAlindi: f.belgeAlindi,
      });

      for (const k of b.kalemler) {
        const fiyat = f.fiyatlar[k.id];
        if (fiyat !== null && fiyat !== undefined && fiyat > 0) {
          yeniMetinler[hucreKey(f.tedarikciId, k.id)] = fiyat ? tutarGirdisi(fiyat) : "";
        }
      }
    }

    setTeklifler(yeniTeklifler);
    setMetinler(yeniMetinler);
    if (yeniTeklifler.length > 0 && !aktifFirmaId) {
      setAktifFirmaId(yeniTeklifler[0].tedarikciId);
    }
    setBilgiMesaji(`Yaklaşık maliyetteki ${ymFirmalar.length} firmanın fiyat teklifleri başarıyla aktarıldı.`);
    setTimeout(() => setBilgiMesaji(""), 4000);
  };

  // Hücre metni değiştiğinde
  const hucreMetinDegistir = (firmaId: string, kalemId: string, metin: string) => {
    const key = hucreKey(firmaId, kalemId);
    setMetinler((prev) => ({ ...prev, [key]: metin }));

    // Sayısal değeri hesapla
    // Boş ya da geçersiz metin fiyat verilmedi sayılır (geçersizlik hücrede işaretlenir)
    const kurus = metin.trim() === "" ? null : tutarCoz(metin);

    setTeklifler((prev) =>
      prev.map((t) => {
        if (t.tedarikciId !== firmaId) return t;
        return {
          ...t,
          fiyatlar: {
            ...t.fiyatlar,
            [kalemId]: kurus,
          },
        };
      })
    );
  };

  // Belge alındı kutusu
  const belgeAlindiDegistir = (alindi: boolean) => {
    if (!aktifFirmaTeklifi) return;
    setTeklifler((prev) =>
      prev.map((t) => {
        if (t.tedarikciId !== aktifFirmaTeklifi.tedarikciId) return t;
        return { ...t, belgeAlindi: alindi };
      })
    );
  };

  // Yeni Firma Ekleme
  const firmaEkleId = (id: string) => {
    if (!id) return;
    const yeniTeklif: FirmaTeklifi = {
      tedarikciId: id,
      teklifTarihi: null,
      yasaklilikSorgusu: null,
      fiyatlar: {},
      belgeAlindi: false,
    };
    setTeklifler((prev) => (prev.some((t) => t.tedarikciId === id) ? prev : [...prev, yeniTeklif]));
    setAktifFirmaId(id);
  };
  const firmaEkle = () => {
    firmaEkleId(yeniFirmaId);
    setYeniFirmaId("");
  };

  const teklifTarihiDegistir = (firmaId: string, tarih: string) =>
    setTeklifler((prev) => prev.map((t) => (t.tedarikciId === firmaId ? { ...t, teklifTarihi: tarih || null } : t)));

  // Kontroller
  const kontroller = useMemo((): Kontrol[] => {
    const k: Kontrol[] = [];
    if (teklifler.length === 0) {
      k.push({
        durum: "engel",
        baslik: "Hiç firma teklifi yok",
        detay: "Fiyat teklifi verecek firmaları ekleyin veya “Yaklaşık maliyetten çek” düğmesini kullanın.",
      });
      return k;
    }

    const belgeliSayisi = teklifler.filter((t) => t.belgeAlindi).length;
    if (belgeliSayisi === 0) {
      k.push({
        durum: "uyari",
        baslik: "Kaşeli teklif mektubu işaretlenmedi",
        detay: "En az bir firmanın kaşeli/imzalı teklif mektubu aldığını işaretleyin.",
      });
    } else {
      k.push({
        durum: "tamam",
        baslik: `${belgeliSayisi} firmanın kaşeli teklifi hazır`,
        detay: "Teklif mektupları idareye teslim edildi.",
      });
    }

    const fiyatiTamFirmalar = teklifler.filter((t) =>
      b.kalemler.every((kalem) => {
        const f = t.fiyatlar[kalem.id];
        return f !== null && f !== undefined && f > 0;
      })
    );

    if (fiyatiTamFirmalar.length === 0) {
      k.push({
        durum: "uyari",
        baslik: "Kalem fiyatları eksik",
        detay: "Firmaların tüm kalemler için teklif ettiği birim fiyatları girin.",
      });
    } else {
      k.push({
        durum: "tamam",
        baslik: `${fiyatiTamFirmalar.length} firmanın teklif cetveli tam`,
        detay: "Piyasa fiyat araştırması tutanağı düzenlemek için yeterli teklif mevcuttur.",
      });
    }

    k.push(...teklifFirmaKontrolleri(teklifler.map((t) => t.tedarikciId), tedarikciler));
    k.push(...teklifTarihiKontrolleri({ ...piyasa, teklifler, yazi }, firmaAdi));

    return k;
  }, [teklifler, b.kalemler, piyasa, yazi, tedarikciler]);

  const belgeSayfalari = useMemo(() => {
    return teklifIstemeMektubuSayfalari(
      { alim, ayarlar: veri.ayarlar, dosya, kalemler: b.kalemler },
      aktifTedarikci,
      { sayi: yazi.sayi, tarih: yazi.tarih, sonTarih: yazi.sonTeklifTarihi, sonSaat: yazi.sonTeklifSaati, teslimYeri: yazi.teslimYeri, teslimSuresi: yazi.teslimSuresi, aciklama: yazi.aciklama }
    );
  }, [alim, veri.ayarlar, dosya, b.kalemler, aktifTedarikci, yazi]);

  const onaylaVeIlerle = async () => {
    setKaydediliyor(true);
    try {
      piyasaDegistir((p) => ({ ...p, teklifler }));

      await b.evrakDegistir("fiyat-teklifi", "Teklif mektupları", {
        tamam: true,
        tarih: bugun(),
        not: "",
      });
      navigate(`/dosyalar/${alim.id}/basamak/7`);
    } finally {
      setKaydediliyor(false);
    }
  };

  // Eksik fiyatlı firmanın toplamı yoktur (null); kısmi toplam gösterilmez
  const aktifFirmaToplam = aktifFirmaTeklifi
    ? firmaToplami({ ...piyasa, kalemler: b.kalemler, teklifler }, aktifFirmaTeklifi.tedarikciId)
    : null;

  return (
    <>
      <div className="iki-sutun">
        <section className="panel genis-form" aria-labelledby="teklifler-baslik">
          <div className="panel-baslik-satiri">
            <div>
              <h2 id="teklifler-baslik">6. Teklif Mektupları ve Fiyat Girişi</h2>
              <p className="soluk kucuk">
                Firmalardan gelen kaşeli teklif mektuplarının birim fiyatlarını girebilir veya 4. basamaktaki yaklaşık maliyet verilerini tek tıkla çekebilirsiniz.
              </p>
            </div>
            <div className="dugme-grubu baslik-araclari">
              <button
                type="button"
                className="dugme kucuk-dugme"
                onClick={yaklasikMaliyettenCek}
                title="4. Basamakta tespit edilen firma ve birim fiyatları teklif cetveline kopyalar"
                style={{ fontWeight: 600, background: "var(--zemin)", border: "1px solid var(--vurgu)", color: "var(--vurgu)" }}
              >
                Yaklaşık maliyetten çek
              </button>

              <select
                value={yeniFirmaId}
                onChange={(e) => setYeniFirmaId(e.target.value)}
                className="kucuk"
                style={{ height: "36px", padding: "0 8px" }}
              >
                <option value="">+ Başka firma ekle…</option>
                {tedarikciler
                  .filter((t) => !teklifler.some((tk) => tk.tedarikciId === t.id))
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.ad}
                    </option>
                  ))}
              </select>
              {yeniFirmaId && (
                <button type="button" className="dugme dugme-ana kucuk-dugme" onClick={firmaEkle}>
                  Ekle
                </button>
              )}
            </div>
          </div>

          {/* Teklif mektubu isteyen yazı, 3. basamaktaki fiyat isteme yazısından ayrı bir resmî yazıdır; kendi sayısı ve tarihi olur. */}
          <div className="form-izgara" style={{ marginTop: "12px" }}>
            <div className="alan">
              <label htmlFor="teklif-yazi-sayi">Teklif isteme yazısı sayısı</label>
              <input id="teklif-yazi-sayi" className="mono" value={yazi.sayi} onChange={(e) => yaziDegistir({ sayi: e.target.value })} placeholder={dosya.ihtiyacOnayi.sayi || "E-12345678-934.01-…"} />
            </div>
            <div className="alan">
              <label htmlFor="teklif-yazi-tarih">Yazı tarihi</label>
              <input id="teklif-yazi-tarih" type="date" value={yazi.tarih} onChange={(e) => yaziDegistir({ tarih: e.target.value })} />
            </div>
            <div className="alan">
              <label htmlFor="teklif-son-tarih">Son teklif tarihi</label>
              <input
                id="teklif-son-tarih"
                type="date"
                value={yazi.sonTeklifTarihi}
                min={yazi.tarih || undefined}
                aria-invalid={!!yazi.tarih && !!yazi.sonTeklifTarihi && yazi.sonTeklifTarihi < yazi.tarih}
                onChange={(e) => yaziDegistir({ sonTeklifTarihi: e.target.value })}
              />
            </div>
            <div className="alan">
              <label htmlFor="teklif-son-saat">Son teklif saati</label>
              <input id="teklif-son-saat" type="time" value={yazi.sonTeklifSaati ?? ""} onChange={(e) => yaziDegistir({ sonTeklifSaati: e.target.value })} />
            </div>
          </div>

          <div className="form-izgara" style={{ marginTop: "12px" }}>
            <div className="alan">
              <label htmlFor="teklif-teslim-yeri">Teslim yeri</label>
              <input id="teklif-teslim-yeri" value={yazi.teslimYeri} onChange={(e) => yaziDegistir({ teslimYeri: e.target.value })} placeholder={dosya.teslimYeri} />
            </div>
            <div className="alan">
              <label htmlFor="teklif-teslim-suresi">Teslim süresi</label>
              <input id="teklif-teslim-suresi" value={yazi.teslimSuresi} onChange={(e) => yaziDegistir({ teslimSuresi: e.target.value })} placeholder={dosya.sartlar.teslimSuresi} />
            </div>
            <div className="alan">
              <label htmlFor="teklif-aciklama">Açıklama</label>
              <input id="teklif-aciklama" value={yazi.aciklama} onChange={(e) => yaziDegistir({ aciklama: e.target.value })} />
            </div>
          </div>

          <YeniFirmaFormu b={b} kimlik="tm-yeni" onEklendi={firmaEkleId} />

          {bilgiMesaji && (
            <div className="bant bant-bilgi" role="status" style={{ margin: "10px 0" }}>
              {bilgiMesaji}
            </div>
          )}

          {/* Firma Sekmeleri */}
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", borderBottom: "1px solid var(--cizgi)", paddingBottom: "8px", marginTop: "10px" }}>
            {teklifler.map((t) => {
              const seciliMi = aktifFirmaTeklifi?.tedarikciId === t.tedarikciId;
              return (
                <button
                  key={t.tedarikciId}
                  type="button"
                  className={`dugme kucuk-dugme ${seciliMi ? "dugme-ana" : ""}`}
                  onClick={() => setAktifFirmaId(t.tedarikciId)}
                >
                  {firmaAdi(t.tedarikciId)} {t.belgeAlindi ? "✓" : ""}
                </button>
              );
            })}
          </div>

          {aktifFirmaTeklifi && (
            <div style={{ marginTop: "14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", background: "var(--zemin)", padding: "10px 14px", borderRadius: "8px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontWeight: 500 }}>
                  <input
                    type="checkbox"
                    checked={!!aktifFirmaTeklifi.belgeAlindi}
                    onChange={(e) => belgeAlindiDegistir(e.target.checked)}
                    style={{ width: "18px", height: "18px" }}
                  />
                  <span>Bu firmaya ait kaşeli ve imzalı teklif mektubu idaremize ulaştı</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>Teklif tarihi</span>
                  <input
                    type="date"
                    aria-label={`${firmaAdi(aktifFirmaTeklifi.tedarikciId)} teklif tarihi`}
                    value={aktifFirmaTeklifi.teklifTarihi ?? ""}
                    onChange={(e) => teklifTarihiDegistir(aktifFirmaTeklifi.tedarikciId, e.target.value)}
                  />
                </label>
                <span className="mono kalin" style={{ fontSize: "14px" }}>
                  {aktifFirmaToplam === null
                    ? "Toplam: Eksik fiyat"
                    : `Toplam: ${belgeTutari(aktifFirmaToplam)} + KDV`}
                </span>
              </div>

              <div className="tablo-kutu">
                <table className="genis-tablo" style={{ fontSize: "13px" }}>
                  <thead>
                    <tr>
                      <th style={{ width: "5%" }}>Sıra</th>
                      <th style={{ width: "45%" }}>Mal / Hizmet Kalemi</th>
                      <th style={{ width: "15%", textAlign: "center" }}>Miktar</th>
                      <th style={{ width: "20%", textAlign: "right" }}>KDV Hariç Birim (TL)</th>
                      <th style={{ width: "15%", textAlign: "right" }}>Tutar (TL)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {b.kalemler.map((kalem, idx) => {
                      const key = hucreKey(aktifFirmaTeklifi.tedarikciId, kalem.id);
                      const degerMetin = metinler[key] ?? "";
                      const kurus = aktifFirmaTeklifi.fiyatlar[kalem.id];
                      const satirTutar = kurus && kurus > 0 ? kalemTutari(kalem, kurus) : 0;
                      const gecersiz = degerMetin.trim() !== "" && tutarCoz(degerMetin) === null;

                      return (
                        <tr key={kalem.id}>
                          <td style={{ textAlign: "center" }}>{idx + 1}</td>
                          <td>
                            <strong>{kalem.ad}</strong>
                            {kalem.ozellik && <div className="soluk kucuk">{kalem.ozellik}</div>}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            {kalem.miktar.toLocaleString("tr-TR")} {kalem.birim}
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <input
                              type="text"
                              value={degerMetin}
                              onChange={(e) => hucreMetinDegistir(aktifFirmaTeklifi.tedarikciId, kalem.id, e.target.value)}
                              placeholder="0,00"
                              className={`mono sag ${gecersiz ? "fiyat-gecersiz" : ""}`}
                              aria-invalid={gecersiz}
                              aria-label={`${kalem.ad} birim fiyatı`}
                              title={gecersiz ? "Geçersiz tutar" : undefined}
                              style={{ width: "120px", padding: "6px 8px", height: "34px", borderRadius: "6px" }}
                            />
                            {gecersiz && <div className="soluk kucuk" role="alert">Geçersiz tutar</div>}
                          </td>
                          <td style={{ textAlign: "right", fontWeight: 500 }} className="mono">
                            {satirTutar > 0 ? tutarMetni(satirTutar) : BOS_DEGER}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div style={{ marginTop: "16px" }}>
            <h3 style={{ fontSize: "14px", marginBottom: "8px" }}>Eksik Veri ve Uygunluk Kontrolleri</h3>
            <div className="sutun" style={{ gap: "6px" }}>
              {kontroller.map((k, i) => (
                <KontrolSatiri key={i} k={k} />
              ))}
            </div>
          </div>

          <div className="dugme-grubu" style={{ marginTop: "16px" }}>
            <button
              type="button"
              className="dugme dugme-ana"
              disabled={kaydediliyor}
              onClick={() => void onaylaVeIlerle()}
              style={{ fontSize: "14px", padding: "10px 20px" }}
            >
              {kaydediliyor ? "Kaydediliyor…" : "Teklifleri Onayla ve Sonraki Adıma Geç (7. Tutanak) ›"}
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

        <section className="panel kucuk-onizleme" aria-labelledby="teklif-a4-baslik">
          <div className="panel-baslik-satiri">
            <h2 id="teklif-a4-baslik">A4 görünüşü</h2>
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
          baslik={`Fiyat Teklif Mektubu: ${aktifTedarikci?.ad || "Teklif Cetveli"}`}
          sayfalar={belgeSayfalari}
          kapat={() => setOnizle(false)}
        />
      )}
    </>
  );
}
