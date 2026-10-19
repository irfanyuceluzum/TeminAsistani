import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { BasamakBaglami } from "../sayfalar/DosyaCalismaAlani";
import { BelgeOnizleme } from "../BelgeOnizleme";
import { KontrolSatiri } from "../KontrolSatiri";
import { KucukA4 } from "./KucukA4";
import { piyasaTutanagiSayfalari } from "./belgeler";
import { degerlendir, yasaklilikEksikleri, type Degerlendirme } from "../../domain/piyasa";
import { evrakFormu, evrakKaydiYap } from "../../domain/basamaklar";
import { bugun } from "../bicim";
import type { Kontrol } from "../../domain/sihirbaz";
import { yetkiliMi } from "../../domain/personel";

export function PiyasaTutanagiBasamagi({ b }: { b: BasamakBaglami }) {
  const navigate = useNavigate();
  const { alim, piyasa, dosya, veri, piyasaDegistir } = b;
  const { ayarlar, tedarikciler } = veri;
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [onizle, setOnizle] = useState(false);
  const [mesaj, setMesaj] = useState("");
  const [form, setForm] = useState(() => evrakFormu(b.evraklar["piyasa-tutanagi"], bugun()));
  const dd = alim.bent === "22/d";
  const sorgusuz = dd ? yasaklilikEksikleri(piyasa) : [];

  const firmaAdi = (id: string) => tedarikciler.find((t) => t.id === id)?.ad || "Bilinmeyen Firma";

  const sonuc = useMemo(() => degerlendir(piyasa), [piyasa]);

  const degerlendirmeDegistir = (tur: Degerlendirme) => piyasaDegistir((p) => ({ ...p, degerlendirme: tur }));
  const sorguTarihiDegistir = (tedarikciId: string, tarih: string) =>
    piyasaDegistir((p) => ({ ...p, teklifler: p.teklifler.map((t) => (t.tedarikciId === tedarikciId ? { ...t, yasaklilikSorgusu: tarih || null } : t)) }));

  const kontroller = useMemo((): Kontrol[] => {
    const k: Kontrol[] = [];
    const g = ayarlar.gorevler;

    if (!sonuc || sonuc.kazananlar.length === 0 || !(sonuc.toplam > 0)) {
      k.push({
        durum: "engel",
        baslik: "En uygun teklif belirlenemedi",
        detay: "6. basamakta firmalardan gelen fiyat tekliflerini eksiksiz girmelisiniz.",
      });
    } else {
      const kazananAd = firmaAdi(sonuc.kazananlar[0]);
      k.push({
        durum: "tamam",
        baslik: "En avantajlı teklif tespit edildi",
        detay: `${kazananAd} tarafından verilen ${(sonuc.toplam / 100).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL + KDV tutarındaki teklif en uygundur.`,
      });
    }

    const piyasadaYetkili = [g?.harcamaYetkilisi, g?.gerceklestirme].filter(
      (id): id is string => !!id && (g?.piyasaGorevlileri ?? []).includes(id)
    );

    if (piyasadaYetkili.length > 0) {
      k.push({
        durum: "engel",
        baslik: "Yetkili piyasa araştırmasında görev alamaz",
        detay: "Harcama Yetkilisi ve Gerçekleştirme Görevlisi 5018 ve 4734 sayılı kanunlar gereği piyasa araştırma komisyonunda yer alamaz.",
      });
    } else {
      k.push({
        durum: "tamam",
        baslik: "Komisyon üyeleri mevzuata uygun",
        detay: "Görev ayrılığı ilkesine uyulmuştur; Harcama Yetkilisi ve Gerçekleştirme Görevlisi komisyonda yer almamaktadır.",
      });
    }

    // Doğrudan Temin Tebliği m.4/8: 22/d'de seçilen firmanın yasaklı olmadığı EKAP'tan sorgulanır.
    if (dd && sonuc && sonuc.kazananlar.length > 0) {
      k.push(
        sorgusuz.length
          ? {
              durum: "engel",
              baslik: "Yasaklılık sorgusu yapılmadı",
              detay: `${sorgusuz.map(firmaAdi).join(", ")} için EKAP yasaklılık sorgusunu yapıp sorgu tarihini girin (Doğrudan Temin Tebliği m.4/8).`,
            }
          : { durum: "tamam", baslik: "Yasaklılık sorgusu yapıldı", detay: "Seçilen firmanın EKAP sorgu tarihi tutanağa yazılır." },
      );
    }
    if (form.tarih && dosya.fiyatIsteme.sonTarih && form.tarih < dosya.fiyatIsteme.sonTarih) {
      k.push({
        durum: "uyari",
        baslik: "Tutanak tarihi son teklif gününden önce",
        detay: "Teklifler son gün dolmadan değerlendiriliyor. Tutanak tarihini kontrol edin.",
      });
    }

    const gorevliSayisi = (g?.piyasaGorevlileri ?? []).filter((id) => g ? !yetkiliMi(id, g) : true).length;
    if (gorevliSayisi < 2) {
      k.push({
        durum: "uyari",
        baslik: "Görevli sayısı az",
        detay: `Piyasa araştırması şu anda ${gorevliSayisi} görevliyle yürütülüyor. En az 2 görevli atanması önerilir.`,
      });
    }

    return k;
  }, [sonuc, ayarlar.gorevler, tedarikciler, dd, sorgusuz.join(), form.tarih, dosya.fiyatIsteme.sonTarih]);

  const engelVar = kontroller.some((k) => k.durum === "engel");

  const tutanakSayfalari = useMemo(() => {
    return piyasaTutanagiSayfalari(
      { alim, ayarlar, dosya, kalemler: b.kalemler },
      piyasa,
      firmaAdi,
      form.tarih
    );
  }, [alim, ayarlar, dosya, b.kalemler, piyasa, tedarikciler, form.tarih]);

  const onaylaVeIlerle = async () => {
    setMesaj("");
    let kayit;
    try {
      kayit = evrakKaydiYap(form);
    } catch (e) {
      setMesaj(String((e as Error).message));
      return;
    }
    setKaydediliyor(true);
    try {
      const kazananId = sonuc?.kazananlar?.[0] || alim.tedarikciId;
      const toplamTutar = sonuc?.toplam || alim.tutar;

      await b.alimDegistir(
        {
          tedarikciId: kazananId,
          tutar: toplamTutar,
          asama: "siparis",
        },
        "Piyasa fiyat araştırma tutanağı onaylandı, alım sipariş aşamasına geçti."
      );

      piyasaDegistir((p) => ({ ...p, tamamlandi: true }));

      await b.evrakDegistir("piyasa-tutanagi", "Piyasa fiyat araştırma tutanağı", kayit);

      navigate(`/dosyalar/${alim.id}/basamak/8`);
    } finally {
      setKaydediliyor(false);
    }
  };

  return (
    <>
      <div className="iki-sutun">
        <section className="panel genis-form" aria-labelledby="tutanak-baslik">
          <div className="panel-baslik-satiri">
            <div>
              <h2 id="tutanak-baslik">7. Piyasa Fiyat Araştırması Tutanağı</h2>
              <p className="soluk kucuk">
                Gelen tekliflerin karşılaştırması ve mevzuata uygun görevlilerin kararıyla tutanak düzenlenir.
              </p>
            </div>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <select
                value={piyasa.degerlendirme}
                onChange={(e) => degerlendirmeDegistir(e.target.value as Degerlendirme)}
                className="kucuk"
                style={{ height: "36px", padding: "0 8px" }}
              >
                <option value="toplam">Toplam Tutar Esasına Göre</option>
                <option value="kalem">Kısmi Teklif (Kalem Bazında)</option>
              </select>
            </div>
          </div>

          {sonuc && (
            <div
              style={{
                padding: "12px 16px",
                background: "var(--zemin)",
                borderRadius: "8px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "12px",
              }}
            >
              <div>
                <span className="soluk kucuk">Tespit Edilen En Uygun Teklif:</span>
                <div style={{ fontSize: "16px", fontWeight: "bold" }}>
                  {sonuc.kazananlar.length > 0 ? firmaAdi(sonuc.kazananlar[0]) : "—"}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <span className="soluk kucuk">Teklif Bedeli (KDV Hariç):</span>
                <div className="mono kalin" style={{ fontSize: "18px", color: "var(--vurgu)" }}>
                  {(sonuc.toplam / 100).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL
                </div>
              </div>
            </div>
          )}

          <div className="form-izgara" style={{ marginTop: "12px" }}>
            <div className="alan">
              <label htmlFor="tutanak-tarih">Tutanak tarihi</label>
              <input id="tutanak-tarih" type="date" value={form.tarih} onChange={(e) => setForm((f) => ({ ...f, tarih: e.target.value }))} aria-invalid={!form.tarih} />
            </div>
          </div>

          {dd && sonuc && sonuc.kazananlar.length > 0 && (
            <fieldset className="secim-grubu" style={{ marginTop: "12px" }}>
              <legend>EKAP yasaklılık sorgusu (Doğrudan Temin Tebliği m.4/8)</legend>
              {sonuc.kazananlar.map((id) => {
                const tarih = piyasa.teklifler.find((t) => t.tedarikciId === id)?.yasaklilikSorgusu ?? "";
                return (
                  <div key={id} className="alan">
                    <label htmlFor={`yasak-${id}`}>{firmaAdi(id)} · sorgu tarihi (yasaklı değil)</label>
                    <input id={`yasak-${id}`} type="date" value={tarih} onChange={(e) => sorguTarihiDegistir(id, e.target.value)} aria-invalid={!tarih} />
                  </div>
                );
              })}
            </fieldset>
          )}

          {mesaj && (
            <div className="bant bant-hata" role="alert" style={{ marginTop: "12px" }}>
              {mesaj}
            </div>
          )}

          <div style={{ marginTop: "16px" }}>
            <h3 style={{ fontSize: "14px", marginBottom: "8px" }}>Eksik Veri ve Görev Ayrılığı Kontrolleri</h3>
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
              disabled={kaydediliyor || engelVar}
              onClick={() => void onaylaVeIlerle()}
              style={{ fontSize: "14px", padding: "10px 20px" }}
            >
              {kaydediliyor ? "Kaydediliyor…" : "Tutanağı Onayla ve Sonraki Adıma Geç (8. Sipariş Yazısı) ›"}
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

        <section className="panel kucuk-onizleme" aria-labelledby="tutanak-a4-baslik">
          <div className="panel-baslik-satiri">
            <h2 id="tutanak-a4-baslik">A4 görünüşü</h2>
            <span className="soluk kucuk">{tutanakSayfalari.length} sayfa</span>
          </div>
          <KucukA4>{tutanakSayfalari[0]}</KucukA4>
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
          baslik="Piyasa Fiyat Araştırması Tutanağı"
          sayfalar={tutanakSayfalari}
          kapat={() => setOnizle(false)}
        />
      )}
    </>
  );
}
