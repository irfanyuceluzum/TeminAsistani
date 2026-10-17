import { useState } from "react";
import { Link } from "react-router-dom";
import { degerlendir, teklifVerenler } from "../../domain/piyasa";
import { muayeneOzeti } from "../../domain/muayene";
import { sozlesmeZorunlu } from "../../domain/sihirbaz";
import { bugun, tlKurus, uzunTarih } from "../bicim";
import type { BasamakBaglami } from "../sayfalar/DosyaCalismaAlani";

// Belge şablonu henüz uygulamada olmayan basamaklar: belge dışarıda hazırlanır, burada tarihiyle işaretlenir.
function aciklama(b: BasamakBaglami): string {
  switch (b.basamak.no) {
    case 5:
      return "Doğrudan temin onay belgesi; yaklaşık maliyet, ödenek ve görevlilerle harcama yetkilisince onaylanır. Yeni alım sihirbazının son adımında yazdırılır.";
    case 6:
      return "22/d dışındaki bentlerde firmadan alınan fiyat teklifi dosyaya konur.";
    case 8:
      return sozlesmeZorunlu(b.alim)
        ? "Süreye yayılan işlerde ve 22/c'de sözleşme yapılır (Tebliğ m.4/5); damga vergisi ödeme basamağında hesaplanır."
        : "Seçilen firmaya sipariş yazısı gönderilir; teslim süresi sipariş yazısının tebliğinden başlar.";
    case 9:
      return "Teslimattan sonra muayene ve kabul komisyonuna muayenenin yapılması için yazı gönderilir.";
    case 10:
      return "Komisyon muayeneyi yapar, uygunluğu raporla bildirir.";
    case 12:
      return "Taşınır mal alımlarında kabulden sonra taşınır işlem fişi düzenlenir; hizmet alımında gerekmez.";
    default:
      return "";
  }
}

export function EvrakBasamagi({ b }: { b: BasamakBaglami }) {
  const kod = b.basamak.evrakKodu!;
  const kayit = b.evraklar[kod];
  const [tarih, setTarih] = useState(kayit?.tarih || bugun());
  const [not, setNot] = useState(kayit?.not ?? "");
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const tamam = !!kayit?.tamam;

  async function kaydet(yeniTamam: boolean) {
    setKaydediliyor(true);
    await b.evrakDegistir(kod, b.basamak.ad, { tamam: yeniTamam, tarih, not: not.trim() });
    setKaydediliyor(false);
  }

  return (
    <section className="panel" aria-labelledby="evrak-baslik">
      <div className="panel-baslik-satiri">
        <h2 id="evrak-baslik">
          {b.basamak.no}. {b.basamak.ad}
        </h2>
        <span className={`durum-rozeti${tamam ? " durum-tamam" : ""}`}>{tamam ? `Tamamlandı · ${uzunTarih(kayit!.tarih)}` : "Bekliyor"}</span>
      </div>
      <p>{aciklama(b)}</p>
      <div className="bant bant-bilgi">Bu belgenin şablonu henüz uygulamada yok. Belgeyi hazırlayıp imzalattıktan sonra tarihiyle işaretleyin.</div>
      <div className="form-izgara">
        <div className="alan">
          <label htmlFor="evrak-tarih">Belge tarihi</label>
          <input id="evrak-tarih" type="date" value={tarih} onChange={(e) => setTarih(e.target.value)} />
        </div>
        <div className="alan">
          <label htmlFor="evrak-not">Sayı veya not</label>
          <input id="evrak-not" value={not} onChange={(e) => setNot(e.target.value)} placeholder="E-12345678-934-55" />
        </div>
      </div>
      <div className="dugme-grubu">
        <button type="button" className="dugme dugme-ana" disabled={kaydediliyor || !tarih} onClick={() => void kaydet(true)}>
          {tamam ? "Bilgileri güncelle" : "Hazırlandı olarak işaretle"}
        </button>
        {tamam && (
          <button type="button" className="dugme" disabled={kaydediliyor} onClick={() => void kaydet(false)}>
            İşareti geri al
          </button>
        )}
      </div>
    </section>
  );
}

// Kendi ekranı olan basamaklar: durum özeti ve ekrana geçiş.
export function BaglantiBasamagi({ b }: { b: BasamakBaglami }) {
  const { alim, piyasa, muayene, odeme } = b;
  const no = b.basamak.no;
  let yol = "";
  let dugme = "";
  let ozet = "";
  let aciklamaMetni = "";

  if (no === 6 || no === 7) {
    yol = `/piyasa/${alim.id}`;
    dugme = "Piyasa araştırması ekranını aç";
    const verenler = teklifVerenler(piyasa);
    const belgeli = piyasa.teklifler.filter((t) => t.belgeAlindi).length;
    const sonuc = degerlendir(piyasa);
    aciklamaMetni =
      no === 6
        ? "Teklif mektubu isteyen yazı firmalara gönderilir; kaşeli ve imzalı teklifler gelince fiyatları girilir."
        : "Teklifler karşılaştırılır, yasaklılık sorgusu yapılır ve piyasa fiyat araştırma tutanağı düzenlenir.";
    ozet =
      no === 6
        ? `${verenler.length} firmanın fiyatı girildi, ${belgeli} kaşeli teklif belgesi alındı.`
        : piyasa.tamamlandi
          ? `Tutanak tamamlandı. Sonuç ${sonuc ? tlKurus(sonuc.toplam) : "—"} + KDV.`
          : sonuc
            ? `Şu anki en uygun sonuç ${tlKurus(sonuc.toplam)} + KDV; tutanak henüz tamamlanmadı.`
            : "Karşılaştırma için teklif bekleniyor.";
  } else if (no === 11) {
    yol = `/muayene/${alim.id}`;
    dugme = "Muayene ve kabul ekranını aç";
    aciklamaMetni = "Fatura kalemleri, kabul miktarları ve komisyon üyeleriyle muayene ve kabul belgesi düzenlenir.";
    ozet = muayene
      ? muayene.tamamlandi
        ? `Kabul tamamlandı: ${tlKurus(muayeneOzeti(muayene).kabulToplami)} + KDV.`
        : "Muayene kaydı açıldı, henüz tamamlanmadı."
      : "Muayene kaydı henüz açılmadı.";
  } else {
    yol = `/odeme/${alim.id}`;
    dugme = "Ödeme ekranını aç";
    aciklamaMetni = "KDV tevkifatı, damga vergisi, borç sorgusu ve ödeme emri belgesinin ekleri hazırlanır.";
    ozet = odeme ? (odeme.tamamlandi ? `Ödeme tamamlandı${odeme.oebNo ? `, ÖEB no ${odeme.oebNo}` : ""}.` : "Ödeme kaydı açıldı, henüz tamamlanmadı.") : "Ödeme kaydı henüz açılmadı.";
  }

  return (
    <section className="panel" aria-labelledby="baglanti-baslik">
      <div className="panel-baslik-satiri">
        <h2 id="baglanti-baslik">
          {no}. {b.basamak.ad}
        </h2>
        <span className="soluk kucuk">{b.basamak.not}</span>
      </div>
      <p>{aciklamaMetni}</p>
      <div className="kutu">{ozet}</div>
      <Link to={yol} className="dugme dugme-ana kendi-genisligi">
        {dugme}
      </Link>
    </section>
  );
}
