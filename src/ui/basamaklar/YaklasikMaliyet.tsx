import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { yaklasikHesapla, yaklasikKontrolleri, yaklasikTutarYazilir, type YaklasikMaliyet } from "../../domain/basamaklar";
import { bosIse, tlKurus } from "../bicim";
import { BelgeOnizleme } from "../BelgeOnizleme";
import { miktarYazisi } from "../IhtiyacListesi";
import { KontrolSatiri } from "../KontrolSatiri";
import type { BasamakBaglami } from "../sayfalar/DosyaCalismaAlani";
import { firmaFiyatToplami, yaklasikMaliyetSayfalari } from "./belgeler";

export function YaklasikMaliyetBasamagi({ b }: { b: BasamakBaglami }) {
  const { alim, piyasa, dosya, dosyaDegistir } = b;
  const { ayarlar, tedarikciler, limitDonemleri } = b.veri;
  const y = dosya.yaklasik;
  const kalemler = piyasa.kalemler;

  const [onizleme, setOnizleme] = useState(false);
  const [onaylaniyor, setOnaylaniyor] = useState(false);

  const firmaAdi = (id: string) => tedarikciler.find((t) => t.id === id)?.ad ?? id;
  const sonuc = useMemo(() => yaklasikHesapla(kalemler, y), [kalemler, y]);
  const kontroller = yaklasikKontrolleri(dosya, sonuc, alim, ayarlar, limitDonemleri, firmaAdi);
  const belge = { alim, ayarlar, dosya, kalemler };

  const maliyetDegistir = (d: Partial<YaklasikMaliyet>) => dosyaDegistir((x) => ({ ...x, yaklasik: { ...x.yaklasik, ...d } }));

  async function onayla(yeniDurum: boolean) {
    setOnaylaniyor(true);
    maliyetDegistir({ onaylandi: yeniDurum });
    if (yeniDurum && sonuc.hesaplanabilir && yaklasikTutarYazilir(piyasa, sonuc.toplam, alim.tutar)) {
      await b.alimDegistir({ tutar: sonuc.toplam }, `Yaklaşık maliyet ${tlKurus(sonuc.toplam)} (KDV hariç) olarak onaylandı ve onay tutarı güncellendi`);
    }
    setOnaylaniyor(false);
  }

  if (y.hesaplanmayacak) {
    return (
      <section className="panel" aria-labelledby="ym-baslik">
        <h2 id="ym-baslik">4. Yaklaşık maliyet cetveli</h2>
        <p>
          Bu dosyada yaklaşık maliyet hesaplanmayacak olarak işaretlendi. Doğrudan Temin Tebliği m.4/4 uyarınca 22/d alımlarında yaklaşık maliyet zorunlu değildir; bu basamak atlanır.
        </p>
        <button type="button" className="dugme kendi-genisligi" onClick={() => maliyetDegistir({ hesaplanmayacak: false, onaylandi: false })}>
          Yaklaşık maliyeti hesapla
        </button>
      </section>
    );
  }

  // Her firmanın toplam teklif tutarı (KDV hariç)
  // Eksik fiyatlı firmada null (kısmi toplam gösterilmez)
  const firmaToplamlari = y.firmalar.map((fi) => firmaFiyatToplami(kalemler, fi.fiyatlar));

  return (
    <>
      <section className="panel bosluksuz" aria-labelledby="cetvel-baslik">
        <div className="panel-ust">
          <div>
            <div className="satir-aralikli">
              <h2 id="cetvel-baslik">4. Yaklaşık maliyet cetveli</h2>
              <span className={`durum-rozeti ${y.onaylandi ? "durum-tamam" : ""}`}>
                {y.onaylandi ? "Cetvel onaylandı" : "Onay bekliyor"}
              </span>
            </div>
            <p className="soluk kucuk">
              Firmalardan KDV hariç olarak alınan fiyat tekliflerinin ortalaması hesaplanır. Yaklaşık maliyet piyasa fiyatlarını tespit amaçlıdır, ödeneğe bağlı değildir.
            </p>
          </div>
          <div className="filtreler" role="group" aria-label="Hesap yöntemi">
            <button
              type="button"
              className="filtre"
              aria-pressed={y.yontem === "ortalama"}
              onClick={() => maliyetDegistir({ yontem: "ortalama", onaylandi: false })}
            >
              Aritmetik Ortalama
            </button>
            <button
              type="button"
              className="filtre"
              aria-pressed={y.yontem === "enDusuk"}
              onClick={() => maliyetDegistir({ yontem: "enDusuk", onaylandi: false })}
            >
              En Düşük Fiyat
            </button>
          </div>
        </div>
        {kalemler.length === 0 || y.firmalar.length === 0 ? (
          <div className="bos-kutu">
            <p className="soluk">
              {kalemler.length === 0
                ? "İhtiyaç listesi boş; önce 1. basamakta kalemleri girin."
                : "Fiyat teklifleri girilmemiş; 3. basamakta firma ekleyip fiyatlarını girin."}
            </p>
            <Link to={`/dosyalar/${alim.id}/basamak/3`} className="dugme kucuk-dugme">
              ‹ 3. Fiyat isteme basamağına git
            </Link>
          </div>
        ) : (
          <div className="tablo-kutu">
            <table className="cetvel">
              <thead>
                <tr>
                  <th scope="col" style={{ width: "40px" }}>Sıra</th>
                  <th scope="col">Satın Alınacak Malın Cinsi</th>
                  <th scope="col">Özelliği</th>
                  <th scope="col" className="sag">Miktar</th>
                  {y.firmalar.map((fi, i) => (
                    <th key={fi.tedarikciId} scope="col" className="sag">
                      {i + 1}. Firma · {firmaAdi(fi.tedarikciId).split(" ")[0]} (KDV Hariç)
                    </th>
                  ))}
                  <th scope="col" className="sag">
                    {y.yontem === "ortalama" ? "Ortalama Birim" : "En Düşük Birim"}
                  </th>
                  <th scope="col" className="sag">
                    Toplam Yaklaşık Maliyet (KDV Hariç)
                  </th>
                </tr>
              </thead>
              <tbody>
                {sonuc.satirlar.map((r, idx) => (
                  <tr key={r.kalem.id}>
                    <td className="merkez soluk">{idx + 1}</td>
                    <td className="kalin">{r.kalem.ad || "Adsız kalem"}</td>
                    <td className="soluk">{r.kalem.ozellik?.trim() || "0"}</td>
                    <td className="sag">
                      {miktarYazisi(r.kalem.miktar)} {r.kalem.birim}
                    </td>
                    {y.firmalar.map((fi, i) => {
                      const kurus = fi.fiyatlar[r.kalem.id];
                      const durum = r.aykirilar.includes(i) ? "aykiri" : kurus !== null && kurus === r.enDusuk ? "dusuk" : kurus === null ? "bos" : "";
                      return (
                        <td key={fi.tedarikciId} className={`sag mono fiyat-${durum}`}>
                          {bosIse(kurus, tlKurus)}
                        </td>
                      );
                    })}
                    <td className="sag mono">{bosIse(r.birimFiyat, tlKurus)}</td>
                    <td className="sag mono kalin">{tlKurus(r.tutar)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" colSpan={4} className="sag">
                    Kişiler / Firmalarca Bildirilen Fiyatlar Toplamı (KDV Hariç)
                  </th>
                  {y.firmalar.map((fi, i) => (
                    <td key={fi.tedarikciId} className="sag mono kalin">
                      {firmaToplamlari[i] === null ? "Eksik fiyat" : tlKurus(firmaToplamlari[i] as number)}
                    </td>
                  ))}
                  <th scope="row" className="sag">
                    Genel Toplam (KDV Hariç)
                  </th>
                  <td className="sag mono kalin" style={{ fontSize: "14px" }}>
                    {tlKurus(sonuc.toplam)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      <div className="kutular">
        <div className="kutu kutu-vurgu">
          <span className="kucuk">Tespit Edilen Yaklaşık Maliyet (KDV Hariç)</span>
          <span className="kutu-deger mono">{tlKurus(sonuc.toplam)}</span>
          <span className="kart-not">Piyasada bildirilen fiyatların ortalamasıdır.</span>
        </div>
        <div className="kutu">
          <span className="kucuk">{piyasa.tamamlandi ? "Sipariş Tutarı (KDV Hariç, tutanaktan)" : "Onay Belgesindeki Tutar (KDV Hariç)"}</span>
          <span className="kutu-deger mono">{tlKurus(alim.tutar)}</span>
          {sonuc.hesaplanabilir && yaklasikTutarYazilir(piyasa, sonuc.toplam, alim.tutar) && (
            <button
              type="button"
              className="metin-dugme kendi-genisligi"
              onClick={() => void b.alimDegistir({ tutar: sonuc.toplam }, `Onay tutarı yaklaşık maliyete göre ${tlKurus(sonuc.toplam)} yapıldı`)}
            >
              Onay tutarını yaklaşık maliyete eşitle
            </button>
          )}
        </div>
      </div>

      <section className="panel" aria-labelledby="kontrol-baslik" aria-live="polite">
        <div className="panel-baslik-satiri">
          <h2 id="kontrol-baslik">Mevzuat ve Uygunluk Kontrolleri</h2>
          <div className="dugme-grubu">
            <button
              type="button"
              className="dugme kucuk-dugme"
              onClick={() => setOnizleme(true)}
              disabled={!sonuc.satirlar.length || !y.firmalar.length}
            >
              Cetveli önizle ve yazdır (A4 yatay)
            </button>
            <button
              type="button"
              className={`dugme kucuk-dugme ${y.onaylandi ? "" : "dugme-ana"}`}
              disabled={onaylaniyor || !sonuc.hesaplanabilir}
              onClick={() => void onayla(!y.onaylandi)}
            >
              {y.onaylandi ? "Onayı geri al" : "✓ Yaklaşık maliyeti onayla ve tamamla"}
            </button>
          </div>
        </div>

        {kontroller.map((k) => (
          <KontrolSatiri key={k.baslik} k={k} />
        ))}

        <label className="onay-kutusu kucuk">
          <input type="checkbox" checked={false} onChange={() => maliyetDegistir({ hesaplanmayacak: true, onaylandi: false })} />
          Bu dosyada yaklaşık maliyet hesaplanmayacak (Tebliğ m.4/4)
        </label>
      </section>

      {onizleme && (
        <BelgeOnizleme
          baslik={`Yaklaşık maliyet hesap cetveli · ${alim.id}`}
          sayfalar={yaklasikMaliyetSayfalari(belge, sonuc, firmaAdi)}
          kapat={() => setOnizleme(false)}
          yatay={true}
        />
      )}
    </>
  );
}
