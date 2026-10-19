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
import { komisyon } from "../../domain/personel";
import { muayeneOlustur } from "../../domain/muayene";

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

  const firmaAdi = (id: string) => tedarikciler.find((t) => t.id === id)?.ad || "Bilinmeyen Firma";

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
      } else {
        k.push({
          durum: "tamam",
          baslik: "Talep yazısı hazır",
          detay: "Muayene komisyonuna sevk yazısı düzenlenmiştir.",
        });
      }
    } else {
      const muayeneKomisyonu = komisyon(g ?? { harcamaYetkilisi: null, gerceklestirme: null, yaklasikMaliyetGorevlileri: [], piyasaGorevlileri: [], muayeneBaskani: null, muayeneUyeleri: [] });
      const muayenedeYetkili = [g?.harcamaYetkilisi, g?.gerceklestirme].filter(
        (id): id is string => !!id && muayeneKomisyonu.includes(id)
      );

      if (muayenedeYetkili.length > 0) {
        k.push({
          durum: "engel",
          baslik: "Yetkili muayene komisyonunda yer alamaz",
          detay: "Harcama Yetkilisi ve Gerçekleştirme Görevlisi mevzuat gereği kabul komisyonuna dahil olamaz.",
        });
      } else {
        k.push({
          durum: "tamam",
          baslik: "Muayene komisyonu mevzuata uygun",
          detay: "Teslim alma ve muayene işlemi bağımsız komisyon üyelerince yürütülmektedir.",
        });
      }

      if (!g?.muayeneBaskani) {
        k.push({
          durum: "uyari",
          baslik: "Komisyon başkanı seçilmemiş",
          detay: "Ayarlar > Personel ve Görevler ekranından bir komisyon başkanı belirleyin.",
        });
      }

      if (!faturaNo.trim()) {
        k.push({
          durum: "uyari",
          baslik: "Fatura numarası henüz girilmedi",
          detay: "Yüklenici faturasının seri ve sıra numarasını kaydedebilirsiniz.",
        });
      }
    }

    return k;
  }, [isTalep, ayarlar.gorevler, faturaNo]);

  const engelVar = kontroller.some((k) => k.durum === "engel");

  const aktifMuayene = useMemo(() => {
    const m = muayene ?? muayeneOlustur(alim, piyasa, bugun());
    return {
      ...m,
      faturaNo,
      faturaTarihi: faturaTarih,
      muayeneTarihi: faturaTarih,
    };
  }, [muayene, alim, piyasa, faturaNo, faturaTarih]);

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
                <span className="etiket-yazi">Kabul Sonucu</span>
                <div className="salt kalin" style={{ color: "var(--basari)" }}>
                  UYGUNDUR (Eksiksiz Kabul Edildi)
                </div>
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
