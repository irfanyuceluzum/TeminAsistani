import { Fragment, type ReactNode } from "react";
import { SARTLAR, type DosyaBasamaklari, type MaliyetSonucu, isinTuruBul, makamBasligi } from "../../domain/basamaklar";
import { butceTertibi } from "../../domain/parametreler";
import { belgeGorevlileri, kisi } from "../../domain/personel";
import type { PiyasaKalemi } from "../../domain/piyasa";
import type { PiyasaArastirmasi } from "../../domain/piyasa";
import { degerlendir, firmaToplami, kalemTutari } from "../../domain/piyasa";
import { kabulSonucu, type Muayene } from "../../domain/muayene";
import type { DizinSatiri } from "../../domain/kapanis";
import { bentBilgisi } from "../../domain/sihirbaz";
import type { Alim, Ayarlar, Tedarikci } from "../../domain/tipler";
import { belgeTutari, BOS_DEGER, bosIse, tutarMetni, uzunTarih } from "../bicim";
import { IdareBasligi } from "../IdareBasligi";
import { IhtiyacTablosu, miktarYazisi } from "../IhtiyacListesi";



// Basamak belgelerinin A4 sayfaları. Her işlev BelgeOnizleme'ye verilecek sayfa dizisini döndürür.

export interface BelgeBilgisi {
  alim: Alim;
  ayarlar: Ayarlar;
  dosya: DosyaBasamaklari;
  kalemler: PiyasaKalemi[];
}

// Bir firmanın kalem fiyatlarından toplamı (kuruş). Fiyatı olmayan ya da 0 TL olan kalem varsa null döner;
// kısmi toplam üretilmez. Kural domain'deki firmaToplami ile aynıdır.
export function firmaFiyatToplami(kalemler: PiyasaKalemi[], fiyatlar: Record<string, number | null>): number | null {
  return firmaToplami(
    {
      alimId: "",
      kalemler,
      teklifler: [{ tedarikciId: "f", teklifTarihi: null, yasaklilikSorgusu: null, fiyatlar }],
      degerlendirme: "toplam",
      gorevliler: "",
      tamamlandi: false,
    },
    "f",
  );
}

function imzaci(ayarlar: Ayarlar, id: string | null | undefined): { ad: string; unvan: string } {
  const p = kisi(ayarlar.personel ?? [], id ?? null);
  return p ? { ad: p.ad, unvan: p.unvan } : { ad: "…", unvan: "" };
}

// Resmî yazışmada imza adı: "Ayşe DEMİR"
function imzaAdi(ad: string): string {
  const parcalar = ad.trim().split(/\s+/);
  if (parcalar.length < 2) return ad;
  const soyad = parcalar.pop()!;
  return `${parcalar.join(" ")} ${soyad.toLocaleUpperCase("tr-TR")}`;
}

function tarihYazisi(t: string): string {
  return t ? uzunTarih(t) : "…/…/……";
}

export function SartlarListesi({ dosya }: { dosya: DosyaBasamaklari }) {
  return (
    <>
      <p className="kalin">İdari ve teknik şartlar</p>
      <ol className="sart-listesi">
        {SARTLAR.map((s) => (
          <li key={s.kod}>
            {s.ad}: {dosya.sartlar[s.kod].trim() || "Yoktur."}
          </li>
        ))}
      </ol>
    </>
  );
}

function EkIhtiyacListesi({ b, imzalayan }: { b: BelgeBilgisi; imzalayan: { ad: string; unvan: string; gorev: string } }) {
  return (
    <>
      <IdareBasligi ayarlar={b.ayarlar} />
      <p className="belge-baslik">İHTİYAÇ LİSTESİ</p>
      <div className="belge-satir">
        <span>İşin adı: {b.alim.konu}</span>
        <span>Dosya: {b.alim.id}</span>
      </div>
      <IhtiyacTablosu kalemler={b.kalemler} />
      <SartlarListesi dosya={b.dosya} />
      <div className="belge-imzalar">
        <div />
        <div>
          <span className="imza-bosluk" />
          <span>{imzaAdi(imzalayan.ad)}</span>
          <span>{imzalayan.unvan}</span>
          <span>{imzalayan.gorev}</span>
        </div>
      </div>
    </>
  );
}

export function ihtiyacOnayiSayfalari(b: BelgeBilgisi): ReactNode[] {
  const o = b.dosya.ihtiyacOnayi;
  const g = b.ayarlar.gorevler;
  const arz = imzaci(b.ayarlar, g?.gerceklestirme);
  const olur = imzaci(b.ayarlar, g?.harcamaYetkilisi);
  return [
    <>
      <IdareBasligi ayarlar={b.ayarlar} />
      <div className="belge-satir">
        <span>Sayı: {o.sayi || "…"}</span>
        <span>{tarihYazisi(o.tarih)}</span>
      </div>
      <p>Konu: İhtiyaç onayı</p>
      <p className="belge-baslik">{makamBasligi(b.ayarlar.idare?.birim ?? "")}</p>
      {o.gerekce.trim() && <p className="girintili">{o.gerekce.trim()}</p>}
      <p className="girintili">
        Bu nedenle ekli listede cinsi ve miktarı belirtilen {b.kalemler.length} kalem ihtiyacın ("{b.alim.konu}") 4734 sayılı Kamu İhale Kanununun 22 nci
        maddesinin ({bentBilgisi(b.alim.bent).harf}) bendi uyarınca doğrudan temin usulüyle
        {b.alim.ekonomikKod ? `, ${butceTertibi(b.ayarlar, b.alim.ekonomikKod)} tertibindeki ödenekten karşılanmak üzere` : ""} satın alınmasını olurlarınıza arz ederim.
      </p>
      <div className="belge-imzalar">
        <div />
        <div>
          <span className="imza-bosluk" />
          <span>{imzaAdi(arz.ad)}</span>
          <span>{arz.unvan}</span>
          <span>Gerçekleştirme Görevlisi</span>
        </div>
      </div>
      <div className="belge-onay">
        <span className="kalin">OLUR</span>
        <span>{tarihYazisi(o.tarih)}</span>
        <span className="imza-bosluk" />
        <span>{imzaAdi(olur.ad)}</span>
        <span>{olur.unvan}</span>
        <span>Harcama Yetkilisi</span>
      </div>
      <p className="kucuk">EK: İhtiyaç listesi (1 sayfa)</p>
    </>,
    <EkIhtiyacListesi b={b} imzalayan={{ ...arz, gorev: "Gerçekleştirme Görevlisi" }} />,
  ];
}

export function fiyatIstemeSayfalari(b: BelgeBilgisi, firma: Tedarikci | null): ReactNode[] {
  const f = b.dosya.fiyatIsteme;
  const g = b.ayarlar.gorevler;
  const gorevli = imzaci(b.ayarlar, g?.piyasaGorevlileri[0]);
  return [
    <>
      <IdareBasligi ayarlar={b.ayarlar} />
      <div className="belge-satir">
        <span>Sayı: {f.sayi || "…"}</span>
        <span>{tarihYazisi(f.tarih)}</span>
      </div>
      <p>Konu: Yaklaşık maliyet için fiyat istenmesi</p>
      <p className="kalin">{firma ? firma.ad : "Sayın Yetkili"}</p>
      <p className="girintili">
        İdaremizce 4734 sayılı Kamu İhale Kanununun 22 nci maddesinin ({bentBilgisi(b.alim.bent).harf}) bendi uyarınca doğrudan temin usulüyle alınması
        planlanan "{b.alim.konu}" işinin yaklaşık maliyetinin tespiti amacıyla, ekli listede nitelik ve miktarları belirtilen kalemlere ilişkin KDV hariç birim
        fiyatlarınızın kaşeli ve imzalı olarak en geç <span className="kalin">{tarihYazisi(f.sonTarih)}</span> tarihine kadar idaremize bildirilmesini rica ederim.
      </p>
      <p className="girintili">Bu yazı teklif isteme niteliğinde değildir; bildirilen fiyatlar yalnızca yaklaşık maliyetin hesaplanmasında kullanılır.</p>
      {b.dosya.teslimYeri && (
        <table className="belge-tablo">
          <tbody>
            <tr>
              <th scope="row">Teslim yeri</th>
              <td>{b.dosya.teslimYeri}</td>
            </tr>
          </tbody>
        </table>
      )}
      <div className="belge-imzalar">
        <div />
        <div>
          <span className="imza-bosluk" />
          <span>{imzaAdi(gorevli.ad)}</span>
          <span>{gorevli.unvan}</span>
          <span>Piyasa Fiyat Araştırması Görevlisi</span>
        </div>
      </div>
      <p className="kucuk">EK: Fiyat cetveli ve şartlar (1 sayfa)</p>
    </>,
    <>
      <div className="belge-satir">
        <span className="kalin">FİYAT CETVELİ</span>
        <span>EK-1</span>
      </div>
      <div className="belge-satir">
        <span>İşin adı: {b.alim.konu}</span>
        <span>Dosya: {b.alim.id}</span>
      </div>
      <IhtiyacTablosu kalemler={b.kalemler} fiyatSutunlari />
      <SartlarListesi dosya={b.dosya} />
      <div className="firma-kase">
        <div className="firma-kase-bilgi">
          <span>Firma unvanı: {firma?.ad ?? ""}</span>
          <span>Vergi dairesi ve no: {firma ? [firma.vergiDairesi, firma.vkn].filter(Boolean).join(" · ") : ""}</span>
          <span>Adres ve telefon: {firma ? [firma.adres, firma.telefon].filter(Boolean).join(" · ") : ""}</span>
          <span>Tarih: …/…/……</span>
        </div>
        <div className="firma-kase-alan">Kaşe ve imza</div>
      </div>
    </>,
  ];
}

export function yaklasikMaliyetSayfalari(b: BelgeBilgisi, sonuc: MaliyetSonucu, firmaAdi: (id: string) => string): ReactNode[] {
  const y = b.dosya.yaklasik;
  const g = b.ayarlar.gorevler;
  const idareAdi =
    [b.ayarlar.idare?.ustIdare, b.ayarlar.idare?.birim].filter(Boolean).join(" - ").toLocaleUpperCase("tr-TR") || "T.C. İDARE MÜDÜRLÜĞÜ";
  const isinAdi = b.alim.konu.toLocaleUpperCase("tr-TR");
  const duzenlemeTarihi = b.dosya.fiyatIsteme.tarih
    ? b.dosya.fiyatIsteme.tarih.split("-").reverse().join("/")
    : b.alim.onayTarihi
      ? b.alim.onayTarihi.split("-").reverse().join("/")
      : "…/…/……";

  // En az 4 firma sütun alanı oluşturulur
  const firmaSlotSayisi = Math.max(y.firmalar.length, 4);
  const firmaSlotlari = Array.from({ length: firmaSlotSayisi }, (_, i) => {
    const f = y.firmalar[i];
    return {
      no: i + 1,
      id: f?.tedarikciId ?? "",
      ad: f ? firmaAdi(f.tedarikciId).toLocaleUpperCase("tr-TR") : "",
      fiyatlar: f?.fiyatlar ?? {},
    };
  });

  // Eksik fiyatlı firmanın toplamı null'dır ve belgede "—" basılır; boş sütun 0,00 kalır
  const firmaToplamlari = firmaSlotlari.map((slot) => (slot.id ? firmaFiyatToplami(b.kalemler, slot.fiyatlar) : 0));

  // Görevlendirme olduğu gibi yansır (yetkililer de dahil; görevler ayrılığı uyarısı alan kontrolündedir).
  const gorevliIdler = g?.yaklasikMaliyetGorevlileri && g.yaklasikMaliyetGorevlileri.length > 0
    ? g.yaklasikMaliyetGorevlileri
    : g?.piyasaGorevlileri ?? [];

  const gorevliUyeler = gorevliIdler.map((id) => imzaci(b.ayarlar, id));
  const imzacilar = Array.from({ length: Math.max(gorevliUyeler.length, 3) }, (_, i) => gorevliUyeler[i] ?? { ad: "…", unvan: "GÖREVLİ" });

  const toplamSutun = 5 + firmaSlotSayisi * 2 + 2;

  return [
    <div key="ym-cetvel" className="ym-sablon-kapsayici">
      <table className="ym-sablon-tablo">
        <thead>
          <tr>
            <th colSpan={toplamSutun} className="ym-ana-baslik">
              YAKLAŞIK MALİYET HESAP CETVELİ
            </th>
          </tr>
          <tr>
            <th colSpan={2} className="ym-bilgi-etiket">
              İdarenin Adı
            </th>
            <td colSpan={toplamSutun - 2} className="ym-bilgi-deger kalin">
              {idareAdi}
            </td>
          </tr>
          <tr>
            <th colSpan={2} className="ym-bilgi-etiket">
              İşin / Alımın Adı
            </th>
            <td colSpan={toplamSutun - 2} className="ym-bilgi-deger kalin">
              {isinAdi}
            </td>
          </tr>
          <tr>
            <th colSpan={2} className="ym-bilgi-etiket">
              Düzenleme Tarihi
            </th>
            <td colSpan={3} className="ym-bilgi-deger kalin">
              {duzenlemeTarihi}
            </td>
            <th colSpan={2} className="ym-bilgi-etiket">
              Yasal Dayanak
            </th>
            <td colSpan={toplamSutun - 7} className="ym-bilgi-deger">
              4734 Sayılı Kamu İhale Kanunu Madde 9
            </td>
          </tr>
          <tr>
            <th rowSpan={2} style={{ width: "3%" }}>
              Sıra No
            </th>
            <th rowSpan={2} style={{ width: "17%" }}>
              Satın Alınacak Malın / Hizmetin Cinsi
            </th>
            <th rowSpan={2} style={{ width: "12%" }}>
              Özelliği
            </th>
            <th rowSpan={2} style={{ width: "5%" }}>
              Miktarı
            </th>
            <th rowSpan={2} style={{ width: "5%" }}>
              Ölçüsü
            </th>
            {firmaSlotlari.map((f) => (
              <th key={f.no} colSpan={2} className="ym-firma-baslik">
                <div className="ym-firma-baslik-icerik">
                  <span className="ym-firma-sira">{f.no}. FİRMA</span>
                  <span className="ym-firma-adi">{f.ad || "(Teklif Alınmadı)"}</span>
                </div>
              </th>
            ))}
            <th colSpan={2} className="ym-sonuc-baslik">
              İdarece Tespit Edilen Yaklaşık Maliyet (KDV Hariç)
            </th>
          </tr>
          <tr>
            {firmaSlotlari.map((f) => (
              <Fragment key={f.no}>
                <th style={{ width: "6%" }}>Birim Fiyat</th>
                <th style={{ width: "6%" }}>Toplam Tutar</th>
              </Fragment>
            ))}
            <th style={{ width: "7%" }}>Birim Fiyat</th>
            <th style={{ width: "8%" }}>Toplam Tutar</th>
          </tr>
        </thead>
        <tbody>
          {b.kalemler.map((kalem, idx) => {
            const satir = sonuc.satirlar.find((r) => r.kalem.id === kalem.id);
            return (
              <tr key={kalem.id}>
                <td className="merkez">{idx + 1}</td>
                <td className="kalin">{kalem.ad}</td>
                <td>{kalem.ozellik?.trim() || "-"}</td>
                <td className="merkez">{miktarYazisi(kalem.miktar)}</td>
                <td className="merkez">{kalem.birim.toLocaleUpperCase("tr-TR")}</td>
                {firmaSlotlari.map((slot) => {
                  const bf = slot.id ? slot.fiyatlar[kalem.id] : null;
                  const tf = bf && bf > 0 ? kalemTutari(kalem, bf) : 0;
                  return (
                    <Fragment key={slot.no}>
                      <td className="sag">{bosIse(bf || null, tutarMetni)}</td>
                      <td className="sag">{bosIse(tf || null, tutarMetni)}</td>
                    </Fragment>
                  );
                })}
                <td className="sag kalin">{bosIse(satir?.birimFiyat || null, tutarMetni)}</td>
                <td className="sag kalin">{bosIse(satir?.tutar || null, tutarMetni)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <th colSpan={5} className="sag kalin" style={{ padding: "4pt" }}>
              Kişiler / Firmalarca Bildirilen Fiyatlar ve Yaklaşık Maliyet Toplamı (KDV Hariç)
            </th>
            {firmaSlotlari.map((slot, i) => (
              <Fragment key={slot.no}>
                <td className="merkez kalin kucuk">TOPLAM</td>
                <td className="sag kalin">{bosIse(firmaToplamlari[i], tutarMetni)}</td>
              </Fragment>
            ))}
            <td className="merkez kalin kucuk">TOPLAM</td>
            <td className="sag kalin">{tutarMetni(sonuc.toplam)}</td>
          </tr>
        </tfoot>
      </table>

      <div className="ym-aciklama-kutusu">
        <p>
          İdaremizce 4734 sayılı Kamu İhale Kanunu'nun 9'uncu maddesi gereğince yaklaşık maliyetin tespitine esas olmak üzere piyasa fiyat araştırması
          yapılmış olup, ilgili firmalardan KDV hariç olarak temin edilen birim ve toplam fiyat teklifleri yukarıdaki cetvelde gösterilmiştir.
        </p>
        <p>
          Yapılan piyasa fiyat araştırması neticesinde; 4734 sayılı İhale Kanunu'nun 9'uncu maddesi gereğince yaklaşık maliyet KDV hariç yukarıda
          belirtildiği gibi takdir ve tespit edilerek işbu Hesap Cetveli tarafımızca düzenlenip imza altına alınmıştır.
        </p>
      </div>

      <div className="ym-imza-bolumu">
        <p className="ym-imza-baslik">YAKLAŞIK MALİYETİ TESPİT EDEN GÖREVLİLER</p>
        <div className="ym-imzalar-sirasi">
          {imzacilar.map((u, i) => (
            <div key={i} className="ym-imza-kutusu">
              <span className="kalin">{imzaAdi(u.ad)}</span>
              <span>{u.unvan || "Görevli"}</span>
              <span className="soluk kucuk">{i === 0 ? "Komisyon Başkanı / Yetkili" : "Üye"}</span>
              <span className="imza-cizgi" />
            </div>
          ))}
        </div>
      </div>

      <div className="ym-dipnot">Not: Yaklaşık Maliyet Hesap Cetveli ve ekleri İhale / Doğrudan Temin Onay Belgesi'ne eklenecektir.</div>
    </div>,
  ];
}

export function dogrudanTeminOnaySayfalari(
  b: BelgeBilgisi,
  ozellestirme?: { makam?: string; sayi?: string; tarih?: string },
): ReactNode[] {
  const g = b.ayarlar.gorevler;
  const ustIdare = (b.ayarlar.idare?.ustIdare || "T.C. İDARE MÜDÜRLÜĞÜ").toLocaleUpperCase("tr-TR");
  const birim = b.ayarlar.idare?.birim || "";
  const makam = (ozellestirme?.makam || b.dosya.onayBelgesi?.makam || makamBasligi(b.ayarlar.idare?.birim ?? "")).toLocaleUpperCase("tr-TR");
  const isinTuru = isinTuruBul(b.alim.ekonomikKod);

  const gg = imzaci(b.ayarlar, g?.gerceklestirme);
  const hy = imzaci(b.ayarlar, g?.harcamaYetkilisi);
  const piyasaGorevlileriYazisi = (g?.piyasaGorevlileri ?? [])
    .map((id) => imzaci(b.ayarlar, id))
    .filter((u) => u.ad && u.ad !== "…")
    .map((u) => `${imzaAdi(u.ad)} (${u.unvan || "Görevli"})`)
    .join(", ");

  const ilgiYazisi = b.dosya.ihtiyacOnayi.sayi
    ? `${b.dosya.ihtiyacOnayi.tarih ? uzunTarih(b.dosya.ihtiyacOnayi.tarih) : ""} tarihli ve ${b.dosya.ihtiyacOnayi.sayi} sayılı İhtiyaç Belgesi`
    : `${b.dosya.ihtiyacOnayi.tarih ? uzunTarih(b.dosya.ihtiyacOnayi.tarih) : ""} tarihli İhtiyaç Belgesi`;

  return [
    <div key="dt-onay-belgesi" className="onay-sablon-kapsayici">
      <div className="onay-sablon-ana-baslik">DOĞRUDAN TEMİN ONAY BELGESİ</div>

      <table className="onay-sablon-tablo">
        <tbody>
          <tr>
            <th className="onay-th-etiket" style={{ width: "42%" }}>
              ALIMI YAPAN İDARENİN ADI
            </th>
            <td className="onay-td-deger" style={{ width: "58%" }}>
              <div className="kalin">{ustIdare}</div>
              {birim && <div>{birim}</div>}
            </td>
          </tr>
          <tr>
            <td colSpan={2} className="onay-ara-bosluk"></td>
          </tr>
          <tr>
            <th colSpan={2} className="onay-makam-baslik">
              {makam}
            </th>
          </tr>
          <tr>
            <th colSpan={2} className="onay-bolum-baslik">
              DOĞRUDAN TEMİN İLE İLGİLİ BİLGİLER
            </th>
          </tr>
          <tr>
            <th className="onay-th-etiket">EKAP DOĞRUDAN TEMİN NUMARASI</th>
            <td className="onay-td-deger">{b.alim.ekapKayitNo || "—"}</td>
          </tr>
          <tr>
            <th className="onay-th-etiket">İŞİN ADI</th>
            <td className="onay-td-deger kalin">{b.alim.konu}</td>
          </tr>
          <tr>
            <th className="onay-th-etiket">TEMİN ŞEKLİ</th>
            <td className="onay-td-deger">4734 Sayılı Kamu İhale Kanunu Madde {b.alim.bent}</td>
          </tr>
          <tr>
            <th className="onay-th-etiket">İŞİN TÜRÜ</th>
            <td className="onay-td-deger">{isinTuru}</td>
          </tr>
          <tr>
            <td colSpan={2} className="onay-ara-bosluk"></td>
          </tr>
          <tr>
            <th className="onay-th-etiket">YAKLAŞIK MALİYET TUTARI</th>
            <td className="onay-td-deger kalin">
              {b.dosya.yaklasik.hesaplanmayacak
                ? "Hesaplanmamıştır (Doğrudan Temin Tebliği m.4/4)"
                : `${belgeTutari(b.alim.tutar)} (KDV Hariç)`}
            </td>
          </tr>
          <tr>
            <th className="onay-th-etiket">KULLANILABİLİR ÖDENEK TUTARI</th>
            <td className="onay-td-deger">{b.dosya.odenek > 0 ? belgeTutari(b.dosya.odenek) : BOS_DEGER}</td>
          </tr>
          <tr>
            <th className="onay-th-etiket">YATIRIM PROJE NUMARASI (Varsa)</th>
            <td className="onay-td-deger">Yoktur</td>
          </tr>
          <tr>
            <th className="onay-th-etiket">BÜTÇE TERTİBİ (Varsa)</th>
            <td className="onay-td-deger">{butceTertibi(b.ayarlar, b.alim.ekonomikKod)}</td>
          </tr>
          <tr>
            <th className="onay-th-etiket">FİYAT FARKI VERİLECEKSE ŞARTLARI</th>
            <td className="onay-td-deger">{b.dosya.onayBelgesi?.fiyatFarki || "Verilmeyecektir"}</td>
          </tr>
          <tr>
            <th className="onay-th-etiket">AVANS VERİLECEKSE ŞARTLARI</th>
            <td className="onay-td-deger">{b.dosya.onayBelgesi?.avans || "Verilmeyecektir"}</td>
          </tr>
          <tr>
            <th className="onay-th-etiket">DOKÜMAN HAZIRLANIP HAZIRLANMAYACAĞI</th>
            <td className="onay-td-deger">{b.dosya.onayBelgesi?.dokuman || "İhtiyaç Listesi ve Şartlar hazırlanmıştır"}</td>
          </tr>
          <tr>
            <th colSpan={2} className="onay-bolum-baslik">
              DOĞRUDAN TEMİN İLE İLGİLİ DİĞER AÇIKLAMALAR
            </th>
          </tr>
          <tr>
            <td colSpan={2} className="onay-aciklamalar-alani">
              <div className="onay-aciklama-satir">
                <strong>İLGİ:</strong> {ilgiYazisi}
              </div>
              <div className="onay-aciklama-satir">
                <strong>GÖREVLENDİRME:</strong> Piyasa Fiyat Araştırması Görevlileri: {piyasaGorevlileriYazisi || "—"}
              </div>
              <div className="onay-aciklama-satir">
                <strong>GEREKÇELERİ:</strong> {b.dosya.ihtiyacOnayi.gerekce || "İdaremizin ihtiyacının karşılanması."}
              </div>
              {b.dosya.nitelik.trim() && (
                <div className="onay-aciklama-satir">
                  <strong>İŞİN NİTELİĞİ:</strong> {b.dosya.nitelik.trim()}
                </div>
              )}
              {b.dosya.bolmeGerekcesi.trim() && (
                <div className="onay-aciklama-satir">
                  <strong>BÖLME YASAĞI (4734 md. 5) AÇIKLAMASI:</strong> {b.dosya.bolmeGerekcesi.trim()}
                </div>
              )}
              <div className="onay-ekler-satir">
                <strong>Ekler:</strong>
                <ul style={{ margin: "2pt 0 0 16pt", padding: 0 }}>
                  <li>Malzeme İhtiyaç Listesi ({b.kalemler.length} Kalem)</li>
                  {!b.dosya.yaklasik.hesaplanmayacak && <li>Yaklaşık Maliyet Hesap Cetveli (1 Sayfa)</li>}
                </ul>
              </div>
            </td>
          </tr>
          <tr>
            <th colSpan={2} className="onay-bolum-baslik">
              ONAY
            </th>
          </tr>
          <tr>
            <td className="onay-imza-sol" style={{ width: "50%", verticalAlign: "top" }}>
              <p style={{ margin: "0 0 16pt 0", fontSize: "8.5pt", lineHeight: 1.4, textAlign: "justify" }}>
                Yukarıda belirtilen işin Kamu İhale Kanunu’nun {b.alim.bent} ({bentBilgisi(b.alim.bent).ad}) maddesi kapsamında
                doğrudan temin yoluyla satın alınması hususunda onaylarınızı arz ederim.
              </p>
              <div className="onay-imza-kutu">
                <span className="kalin">Gerçekleştirme Görevlisi</span>
                <span className="kalin">{imzaAdi(gg.ad)}</span>
                <span>{gg.unvan}</span>
                <span className="imza-cizgi" />
              </div>
            </td>
            <td className="onay-imza-sag" style={{ width: "50%", verticalAlign: "top" }}>
              <div style={{ textAlign: "center", marginBottom: "16pt", fontWeight: "bold", fontSize: "9pt" }}>
                UYGUNDUR
              </div>
              <div className="onay-imza-kutu">
                <span className="kalin">Harcama Yetkilisi</span>
                <span className="kalin">{imzaAdi(hy.ad)}</span>
                <span>{hy.unvan}</span>
                <span className="imza-cizgi" />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>,
    <div key="dt-onay-ek1">
      <div className="belge-satir">
        <span className="kalin">EK-1 İHTİYAÇ LİSTESİ</span>
        <span>Dosya: {b.alim.id}</span>
      </div>
      <p>
        <span className="kalin">İşin adı:</span> {b.alim.konu}
      </p>
      <IhtiyacTablosu kalemler={b.kalemler} />
    </div>,
  ];
}

// 6. Basamak: Teklif Mektubu ve Fiyat Cetveli (Firmaya Gönderilen Teklif İsteme Mektubu)
export function teklifIstemeMektubuSayfalari(
  b: BelgeBilgisi,
  firma: Tedarikci | null,
  yazi?: { sayi?: string; tarih?: string; sonTarih?: string; teslimYeri?: string; teslimSuresi?: string; aciklama?: string },
): ReactNode[] {
  const ustIdare = (b.ayarlar.idare?.ustIdare || "T.C. İDARE MÜDÜRLÜĞÜ").toLocaleUpperCase("tr-TR");
  const birim = b.ayarlar.idare?.birim || "";
  const teslimYeri = yazi?.teslimYeri?.trim() || b.dosya.teslimYeri;
  const teslimSuresi = yazi?.teslimSuresi?.trim() || b.dosya.sartlar.teslimSuresi;
  const aciklama = yazi?.aciklama?.trim() ?? "";
  const sayi = yazi?.sayi || b.dosya.fiyatIsteme?.sayi || "…";
  const tarih = yazi?.tarih || b.dosya.fiyatIsteme?.tarih || "";
  const sonTarih = yazi?.sonTarih || b.dosya.fiyatIsteme?.sonTarih || "";
  const g = b.ayarlar.gorevler;
  const gorevli = imzaci(b.ayarlar, g?.piyasaGorevlileri?.[0]);

  return [
    <div key="teklif-mektubu" className="onay-sablon-kapsayici">
      <IdareBasligi ayarlar={b.ayarlar} />
      <div className="belge-satir" style={{ marginTop: "12pt" }}>
        <span>Sayı: {sayi}</span>
        <span>Tarih: {tarihYazisi(tarih)}</span>
      </div>
      <p style={{ margin: "4pt 0" }}>
        <strong>Konu:</strong> Fiyat Teklifi İsteme ({b.alim.konu})
      </p>
      <div style={{ margin: "16pt 0 8pt 0", textAlign: "center", fontWeight: "bold", fontSize: "11pt" }}>
        {firma ? firma.ad.toLocaleUpperCase("tr-TR") : "SAYIN YETKİLİ"}
      </div>
      <p style={{ textIndent: "24pt", lineHeight: 1.5, textAlign: "justify" }}>
        İdaremiz ihtiyacı olan ve aşağıda cinsi, özelliği ve miktarı belirtilen ("{b.alim.konu}") alımı 4734 sayılı
        Kamu İhale Kanunu’nun 22 nci maddesinin ({bentBilgisi(b.alim.bent).harf}) bendi gereğince Doğrudan Temin
        usulüyle satın alınacaktır.
      </p>
      <p style={{ textIndent: "24pt", lineHeight: 1.5, textAlign: "justify" }}>
        Söz konusu işe ait KDV hariç birim ve toplam fiyat teklifinizi ekte yer alan Teklif Mektubu ve Fiyat Cetvelini
        doldurarak kaşeli ve imzalı şekilde en geç <strong>{tarihYazisi(sonTarih)}</strong> günü mesai bitimine kadar
        idaremize ulaştırmanızı rica ederim.
      </p>
      {teslimYeri && (
        <p style={{ margin: "4pt 0" }}>
          <strong>Teslim yeri:</strong> {teslimYeri}
        </p>
      )}
      {teslimSuresi && (
        <p style={{ margin: "4pt 0" }}>
          <strong>Teslim süresi:</strong> {teslimSuresi}
        </p>
      )}
      {aciklama && (
        <p style={{ margin: "4pt 0" }}>
          <strong>Açıklama:</strong> {aciklama}
        </p>
      )}
      <div className="belge-imzalar" style={{ marginTop: "24pt" }}>
        <div />
        <div style={{ textAlign: "center" }}>
          <span className="imza-bosluk" />
          <span className="kalin">{imzaAdi(gorevli.ad)}</span>
          <span>{gorevli.unvan}</span>
          <span>Piyasa Fiyat Araştırması Görevlisi</span>
        </div>
      </div>
      <div style={{ marginTop: "20pt", fontSize: "8pt" }}>
        <strong>EK:</strong> Fiyat Teklif Cetveli ve Şartlar (1 Sayfa)
      </div>
    </div>,
    <div key="teklif-cetveli" className="onay-sablon-kapsayici">
      <div style={{ textAlign: "center", fontWeight: "bold", fontSize: "11pt", marginBottom: "8pt" }}>
        FİYAT TEKLİF CETVELİ (EK-1)
      </div>
      <div className="belge-satir">
        <span>İdare: {ustIdare} {birim}</span>
        <span>Dosya No: {b.alim.id}</span>
      </div>
      <div className="belge-satir" style={{ marginBottom: "6pt" }}>
        <span>İşin Adı: {b.alim.konu}</span>
        <span>Tarih: …/…/20…</span>
      </div>
      <IhtiyacTablosu kalemler={b.kalemler} fiyatSutunlari />
      <SartlarListesi dosya={b.dosya} />
      <div className="firma-kase" style={{ marginTop: "16pt" }}>
        <div className="firma-kase-bilgi">
          <span><strong>Teklif Veren Firma:</strong> {firma?.ad || "……………………………………………………"}</span>
          <span><strong>Vergi Dairesi / VKN:</strong> {firma ? [firma.vergiDairesi, firma.vkn].filter(Boolean).join(" · ") : "…………………………………………"}</span>
          <span><strong>Adres / Tel:</strong> {firma ? [firma.adres, firma.telefon].filter(Boolean).join(" · ") : "…………………………………………"}</span>
          <span>Yukarıda belirtilen şartları okudum, kabul ettim. Teklif ettiğim fiyatlar KDV hariçtir.</span>
        </div>
        <div className="firma-kase-alan">Firma Kaşe ve Yetkili İmza</div>
      </div>
    </div>,
  ];
}

// 7. Basamak: Piyasa Fiyat Araştırması Tutanağı (Resmî Monokrom Şablon)
export function piyasaTutanagiSayfalari(
  b: BelgeBilgisi,
  piyasa: PiyasaArastirmasi,
  firmaAdi: (id: string) => string,
  tutanakTarihi = "",
): ReactNode[] {
  const ustIdare = (b.ayarlar.idare?.ustIdare || "T.C. İDARE MÜDÜRLÜĞÜ").toLocaleUpperCase("tr-TR");
  const birim = b.ayarlar.idare?.birim || "";
  const sonuc = degerlendir(piyasa);
  const g = b.ayarlar.gorevler;
  // Piyasa görevlileri görevlendirmedeki gibi yazılır.
  const gorevliIdler = g?.piyasaGorevlileri ?? [];
  const gorevliUyeler = gorevliIdler.map((id) => imzaci(b.ayarlar, id));
  const imzacilar = Array.from({ length: Math.max(gorevliUyeler.length, 2) }, (_, i) => gorevliUyeler[i] ?? { ad: "…", unvan: "GÖREVLİ" });

  const kazanan = sonuc && sonuc.kazananlar.length > 0 ? firmaAdi(sonuc.kazananlar[0]) : "—";
  const toplamKurus = sonuc?.toplam ?? 0;

  return [
    <div key="piyasa-tutanak" className="onay-sablon-kapsayici">
      <div style={{ textAlign: "center", fontWeight: "bold", fontSize: "12pt", marginBottom: "4pt" }}>
        PİYASA FİYAT ARAŞTIRMASI TUTANAĞI
      </div>
      <div style={{ textAlign: "center", fontSize: "8.5pt", marginBottom: "8pt" }}>
        {ustIdare} {birim && `· ${birim}`}
      </div>

      <table className="onay-sablon-tablo" style={{ marginBottom: "6pt" }}>
        <tbody>
          <tr>
            <th className="onay-th-etiket" style={{ width: "25%" }}>İŞİN ADI</th>
            <td className="onay-td-deger kalin" colSpan={3}>{b.alim.konu}</td>
          </tr>
          <tr>
            <th className="onay-th-etiket">ALIM USULÜ VE YASAL DAYANAK</th>
            <td className="onay-td-deger">4734 Sayılı KİK Madde {b.alim.bent}</td>
            <th className="onay-th-etiket" style={{ width: "18%" }}>DOSYA / DT NO</th>
            <td className="onay-td-deger">{b.alim.ekapKayitNo || b.alim.id}</td>
          </tr>
          <tr>
            <th className="onay-th-etiket">TUTANAK TARİHİ</th>
            <td className="onay-td-deger">{tutanakTarihi ? uzunTarih(tutanakTarihi) : "…/…/20…"}</td>
            <th className="onay-th-etiket">DEĞERLENDİRME ŞEKLİ</th>
            <td className="onay-td-deger">{piyasa.degerlendirme === "kalem" ? "Kısmi Teklif (Kalem Bazında)" : "Toplam Tutar Esasına Göre"}</td>
          </tr>
        </tbody>
      </table>

      <table className="onay-sablon-tablo" style={{ fontSize: "7.5pt" }}>
        <thead>
          <tr>
            <th style={{ width: "3%", textAlign: "center" }}>S.No</th>
            <th style={{ width: "22%", textAlign: "left" }}>Malın / Hizmetin Cinsi</th>
            <th style={{ width: "6%", textAlign: "center" }}>Miktar</th>
            <th style={{ width: "6%", textAlign: "center" }}>Birim</th>
            {piyasa.teklifler.map((t, idx) => (
              <th key={t.tedarikciId} style={{ textAlign: "center" }}>
                <div style={{ fontWeight: "bold" }}>{idx + 1}. {firmaAdi(t.tedarikciId)}</div>
                <div style={{ fontSize: "6.5pt", color: "#333" }}>{t.belgeAlindi ? "(Kaşeli Belge Alındı)" : "(Belge Bekleniyor)"}</div>
              </th>
            ))}
            <th style={{ width: "12%", textAlign: "center", fontWeight: "bold" }}>
              {piyasa.degerlendirme === "kalem" ? "EN UYGUN FİYAT" : "SEÇİLEN TEKLİF"}
            </th>
          </tr>
        </thead>
        <tbody>
          {b.kalemler.map((k, idx) => {
            // Değerlendirmenin sonucu: toplam esasında kazananın fiyatı, kalem esasında kalemin en düşük fiyatı.
            // Böylece sütunun toplamı her zaman sonuç toplamına eşit olur.
            const atama = sonuc?.atamalar.find((a) => a.kalemId === k.id);
            const enUygun = atama?.birimFiyat ?? null;
            return (
              <tr key={k.id}>
                <td style={{ textAlign: "center" }}>{idx + 1}</td>
                <td className="kalin">{k.ad}</td>
                <td style={{ textAlign: "center" }}>{miktarYazisi(k.miktar)}</td>
                <td style={{ textAlign: "center" }}>{k.birim}</td>
                {piyasa.teklifler.map((t) => {
                  const f = t.fiyatlar[k.id];
                  const uygunMu = atama?.tedarikciId === t.tedarikciId;
                  return (
                    <td key={t.tedarikciId} style={{ textAlign: "right", fontWeight: uygunMu ? "bold" : "normal" }}>
                      {f ? belgeTutari(f) : BOS_DEGER}
                    </td>
                  );
                })}
                <td style={{ textAlign: "right", fontWeight: "bold" }}>
                  {enUygun ? belgeTutari(enUygun) : BOS_DEGER}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <th colSpan={4} style={{ textAlign: "right", fontWeight: "bold" }}>
              TOPLAM TUTAR (KDV HARİÇ):
            </th>
            {piyasa.teklifler.map((t) => {
              const top = firmaToplami(piyasa, t.tedarikciId);
              const enUygunToplam = sonuc?.toplam === top;
              return (
                <td key={t.tedarikciId} style={{ textAlign: "right", fontWeight: "bold", background: enUygunToplam ? "#f5f5f5" : "#fff" }}>
                  {bosIse(top, belgeTutari)}
                </td>
              );
            })}
            <td style={{ textAlign: "right", fontWeight: "bold" }}>
              {sonuc ? belgeTutari(sonuc.toplam) : BOS_DEGER}
            </td>
          </tr>
        </tfoot>
      </table>

      <div style={{ marginTop: "6pt", padding: "6pt", border: "1px solid #000", fontSize: "8pt", lineHeight: 1.35, textAlign: "justify" }}>
        <strong>KARAR:</strong> İdaremizce 4734 sayılı Kamu İhale Kanunu’nun 22 nci maddesinin ({bentBilgisi(b.alim.bent).harf}) bendi uyarınca yapılan piyasa fiyat araştırması neticesinde; teklif veren firmaların fiyat teklifleri ve şartları incelenmiş olup, en uygun ve avantajlı teklifin KDV hariç <strong>{belgeTutari(toplamKurus)}</strong> ile <strong>{kazanan}</strong> tarafından verildiği tespit edilmiştir.{" "}
        {sonuc?.kazananlar
          .map((id) => ({ id, tarih: piyasa.teklifler.find((t) => t.tedarikciId === id)?.yasaklilikSorgusu }))
          .filter((x) => x.tarih)
          .map((x) => `${firmaAdi(x.id)} hakkında ${uzunTarih(x.tarih!)} tarihinde EKAP üzerinden yapılan sorgulamada ihalelere katılmaktan yasaklı olmadığı görülmüştür. `)
          .join("")}
        Alımın anılan firmadan yapılması uygun görülerek işbu tutanak tarafımızca müştereken tanzim ve imza edilmiştir.
      </div>

      <div style={{ marginTop: "10pt" }}>
        <div style={{ textAlign: "center", fontWeight: "bold", fontSize: "8.5pt", marginBottom: "6pt" }}>
          PİYASA FİYAT ARAŞTIRMASI GÖREVLİLERİ
        </div>
        <div style={{ display: "flex", justifyContent: "space-around" }}>
          {imzacilar.map((u, i) => (
            <div key={i} className="onay-imza-kutu" style={{ minWidth: "140px" }}>
              <span className="kalin">{imzaAdi(u.ad)}</span>
              <span>{u.unvan || "Görevli"}</span>
              <span style={{ fontSize: "7pt", color: "#333" }}>{i === 0 ? "Komisyon Üyesi" : "Komisyon Üyesi"}</span>
              <span className="imza-cizgi" />
            </div>
          ))}
        </div>
      </div>
    </div>,
  ];
}

// 8. Basamak: Sipariş Mektubu / Sipariş Yazısı
export function siparisYazisiSayfalari(
  b: BelgeBilgisi,
  yuklenici: Tedarikci | null,
  tutar: number,
  siparis?: { sayi?: string; tarih?: string; tebligTarihi?: string },
): ReactNode[] {
  const ustIdare = (b.ayarlar.idare?.ustIdare || "T.C. İDARE MÜDÜRLÜĞÜ").toLocaleUpperCase("tr-TR");
  const birim = b.ayarlar.idare?.birim || "";
  const sayi = siparis?.sayi || "…";
  const tarih = siparis?.tarih || "";
  const g = b.ayarlar.gorevler;
  const hy = imzaci(b.ayarlar, g?.harcamaYetkilisi);

  return [
    <div key="siparis-yazisi" className="onay-sablon-kapsayici">
      <IdareBasligi ayarlar={b.ayarlar} />
      <div className="belge-satir" style={{ marginTop: "12pt" }}>
        <span>Sayı: {sayi}</span>
        <span>Tarih: {tarihYazisi(tarih)}</span>
      </div>
      <p style={{ margin: "4pt 0" }}>
        <strong>Konu:</strong> Sipariş Mektubu ({b.alim.konu})
      </p>
      <div style={{ margin: "16pt 0 8pt 0", textAlign: "center", fontWeight: "bold", fontSize: "11pt" }}>
        {yuklenici ? yuklenici.ad.toLocaleUpperCase("tr-TR") : "YÜKLENİCİ FİRMA"}
      </div>
      <p style={{ textIndent: "24pt", lineHeight: 1.5, textAlign: "justify" }}>
        İdaremizce 4734 sayılı Kamu İhale Kanunu’nun 22 nci maddesinin ({bentBilgisi(b.alim.bent).harf}) bendi kapsamında doğrudan temin usulüyle alımı kararlaştırılan "<strong>{b.alim.konu}</strong>" işi, vermiş olduğunuz teklif mektubu doğrultusunda KDV hariç <strong>{belgeTutari(tutar)}</strong> bedelle firmanız uhdesinde kalmıştır.
      </p>
      <p style={{ textIndent: "24pt", lineHeight: 1.5, textAlign: "justify" }}>
        Söz konusu malzemelerin/hizmetin ekte belirtilen şartlar dahilinde ve süresi içerisinde idaremize teslim edilmesi hususunda gereğini rica ederim.
      </p>

      <table className="onay-sablon-tablo" style={{ margin: "10pt 0", fontSize: "8.5pt" }}>
        <tbody>
          <tr>
            <th className="onay-th-etiket" style={{ width: "30%" }}>Teslim Süresi</th>
            <td className="onay-td-deger">{b.dosya.sartlar.teslimSuresi || "Tebliğden itibaren 10 gün"}</td>
          </tr>
          <tr>
            <th className="onay-th-etiket">Teslim Yeri</th>
            <td className="onay-td-deger">{b.dosya.teslimYeri || "İdaremiz Taşınır Kayıt Kontrol Servisi"}</td>
          </tr>
          <tr>
            <th className="onay-th-etiket">Sipariş Bedeli (KDV Hariç)</th>
            <td className="onay-td-deger kalin">{belgeTutari(tutar)}</td>
          </tr>
        </tbody>
      </table>

      <div className="belge-imzalar" style={{ marginTop: "24pt" }}>
        <div />
        <div style={{ textAlign: "center" }}>
          <span className="imza-bosluk" />
          <span className="kalin">{imzaAdi(hy.ad)}</span>
          <span>{hy.unvan}</span>
          <span>Harcama Yetkilisi</span>
        </div>
      </div>

      <div style={{ marginTop: "30pt", borderTop: "1px dashed #666", paddingTop: "8pt", fontSize: "8pt" }}>
        <div style={{ fontWeight: "bold", marginBottom: "4pt" }}>TEBELLÜĞ (Yüklenici Tarafından Doldurulacaktır):</div>
        <div>İşbu sipariş mektubunu teslim aldım, şartları aynen kabul ediyorum.</div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "12pt" }}>
          <span>Tebliğ Tarihi: …/…/20…</span>
          <span>Firma Yetkilisi Kaşe ve İmza: ………………………………</span>
        </div>
      </div>
    </div>,
    <div key="siparis-ek1" className="onay-sablon-kapsayici">
      <div style={{ textAlign: "center", fontWeight: "bold", fontSize: "11pt", marginBottom: "8pt" }}>
        SİPARİŞ LİSTESİ (EK-1)
      </div>
      <div className="belge-satir">
        <span>İdare: {ustIdare} {birim}</span>
        <span>Yüklenici: {yuklenici?.ad}</span>
      </div>
      <IhtiyacTablosu kalemler={b.kalemler} />
    </div>,
  ];
}

// 9. Basamak: Muayene Talep Yazısı
export function muayeneTalebiSayfalari(
  b: BelgeBilgisi,
  talep?: { sayi?: string; tarih?: string },
): ReactNode[] {
  const g = b.ayarlar.gorevler;
  const gg = imzaci(b.ayarlar, g?.gerceklestirme);
  return [
    <div key="muayene-talep" className="onay-sablon-kapsayici">
      <IdareBasligi ayarlar={b.ayarlar} />
      <div className="belge-satir" style={{ marginTop: "12pt" }}>
        <span>Sayı: {talep?.sayi || "…"}</span>
        <span>Tarih: {tarihYazisi(talep?.tarih || "")}</span>
      </div>
      <p style={{ margin: "4pt 0" }}>
        <strong>Konu:</strong> Muayene ve Kabul Talebi
      </p>
      <div style={{ margin: "16pt 0 8pt 0", textAlign: "center", fontWeight: "bold", fontSize: "11pt" }}>
        MUAYENE VE KABUL KOMİSYONU BAŞKANLIĞINA
      </div>
      <p style={{ textIndent: "24pt", lineHeight: 1.5, textAlign: "justify" }}>
        İdaremizce 4734 sayılı Kamu İhale Kanunu’nun 22 nci maddesi kapsamında satın alınan ("{b.alim.konu}") işine ait malzemeler/hizmet yüklenici tarafından idaremize teslim edilmiştir.
      </p>
      <p style={{ textIndent: "24pt", lineHeight: 1.5, textAlign: "justify" }}>
        Teslim edilen malların/işlerin teknik ve idari şartnamelere, sipariş mektubuna ve faturaya uygunluğunun incelenerek Muayene ve Kabul Tutanağının düzenlenmesini rica ederim.
      </p>
      <div className="belge-imzalar" style={{ marginTop: "30pt" }}>
        <div />
        <div style={{ textAlign: "center" }}>
          <span className="imza-bosluk" />
          <span className="kalin">{imzaAdi(gg.ad)}</span>
          <span>{gg.unvan}</span>
          <span>Gerçekleştirme Görevlisi</span>
        </div>
      </div>
    </div>,
  ];
}

// Tutanaktaki komisyon imzaları: dosyaya özel üyeler (adı dolu olanlar) varsa onlar, yoksa görevlendirmeden
// domain kuralıyla kurulan komisyon (başkan başta, kişi bir kez). Kimse yoksa tek boş imza yeri.
export function muayeneKomisyonuImzalari(ayarlar: Ayarlar, muayene: Muayene | null): { ad: string; unvan: string; baskan: boolean }[] {
  const dosyaUyeleri = (muayene?.uyeler ?? []).filter((u) => u.ad.trim());
  if (dosyaUyeleri.length) {
    return [...dosyaUyeleri.filter((u) => u.rol === "baskan"), ...dosyaUyeleri.filter((u) => u.rol !== "baskan")].map((u) => ({
      ad: u.ad,
      unvan: u.unvan,
      baskan: u.rol === "baskan",
    }));
  }
  const kom = belgeGorevlileri(ayarlar).komisyon.map((u) => ({ ad: u.ad, unvan: u.unvan, baskan: u.rol === "baskan" }));
  return kom.length ? kom : [{ ...imzaci(ayarlar, null), baskan: true }];
}

// 10 & 11. Basamak: Muayene ve Kabul Tutanağı
export function muayeneKabulTutanagiSayfalari(
  b: BelgeBilgisi,
  muayene: Muayene | null,
  firmaAdi: (id: string) => string,
): ReactNode[] {
  const ustIdare = (b.ayarlar.idare?.ustIdare || "T.C. İDARE MÜDÜRLÜĞÜ").toLocaleUpperCase("tr-TR");
  const birim = b.ayarlar.idare?.birim || "";
  const komisyon = muayeneKomisyonuImzalari(b.ayarlar, muayene);
  const yukleniciAdi = b.alim.tedarikciId ? firmaAdi(b.alim.tedarikciId) : "—";
  const faturaNo = muayene?.faturaNo || "—";
  const faturaTarih = muayene?.faturaTarihi ? uzunTarih(muayene.faturaTarihi) : "—";
  const teslimTarih = muayene?.teslimTarihi || muayene?.muayeneTarihi;
  const sonuc = muayene ? kabulSonucu(muayene) : null;

  return [
    <div key="muayene-kabul-tutanak" className="onay-sablon-kapsayici">
      <div style={{ textAlign: "center", fontWeight: "bold", fontSize: "12pt", marginBottom: "4pt" }}>
        MUAYENE VE KABUL TUTANAĞI
      </div>
      <div style={{ textAlign: "center", fontSize: "8.5pt", marginBottom: "8pt" }}>
        {ustIdare} {birim && `· ${birim}`}
      </div>

      <table className="onay-sablon-tablo" style={{ marginBottom: "6pt" }}>
        <tbody>
          <tr>
            <th className="onay-th-etiket" style={{ width: "25%" }}>İŞİN / ALIMIN ADI</th>
            <td className="onay-td-deger kalin" colSpan={3}>{b.alim.konu}</td>
          </tr>
          <tr>
            <th className="onay-th-etiket">YÜKLENİCİ ADI</th>
            <td className="onay-td-deger">{yukleniciAdi}</td>
            <th className="onay-th-etiket" style={{ width: "20%" }}>FATURA NO / TARİH</th>
            <td className="onay-td-deger">{faturaNo} / {faturaTarih}</td>
          </tr>
          <tr>
            <th className="onay-th-etiket">TESLİM / MUAYENE TARİHİ</th>
            <td className="onay-td-deger">
              {teslimTarih ? uzunTarih(teslimTarih) : "…/…/20…"} / {muayene?.muayeneTarihi ? uzunTarih(muayene.muayeneTarihi) : "…/…/20…"}
            </td>
            <th className="onay-th-etiket">KABUL SONUCU</th>
            <td className="onay-td-deger kalin">{sonuc?.metin ?? "—"}</td>
          </tr>
          {muayene?.yer?.trim() && (
            <tr>
              <th className="onay-th-etiket">MUAYENE YERİ</th>
              <td className="onay-td-deger" colSpan={3}>{muayene.yer.trim()}</td>
            </tr>
          )}
        </tbody>
      </table>

      {muayene ? (
        <table className="belge-tablo ek-tablo">
          <thead>
            <tr>
              <th scope="col">Sıra</th>
              <th scope="col">Malzeme veya hizmet</th>
              <th scope="col">Sipariş</th>
              <th scope="col">Fatura</th>
              <th scope="col">Kabul</th>
              <th scope="col">Birim</th>
            </tr>
          </thead>
          <tbody>
            {muayene.kalemler.map((k, i) => (
              <tr key={k.kalemId}>
                <td>{i + 1}</td>
                <td>{k.ad}</td>
                <td>{miktarYazisi(k.siparisMiktari)}</td>
                <td>{miktarYazisi(k.faturaMiktari)}</td>
                <td>{miktarYazisi(k.kabulMiktari)}</td>
                <td>{k.birim}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <IhtiyacTablosu kalemler={b.kalemler} />
      )}

      <div style={{ marginTop: "6pt", padding: "6pt", border: "1px solid #000", fontSize: "8pt", lineHeight: 1.35, textAlign: "justify" }}>
        <strong>MUAYENE RAPORU:</strong>{" "}
        {sonuc?.sonuc === "kismi"
          ? "Yukarıda nitelik ve miktarları yazılı malzemeler komisyonumuzca fiziki, teknik ve idari açıdan muayene edilmiş; kabul sütununda gösterilen miktarlar sipariş şartlarına uygun bulunarak kabul edilmiş, kalan miktarlar kabul edilmemiştir."
          : sonuc?.sonuc === "ret"
            ? "Yukarıda nitelik ve miktarları yazılı malzemeler komisyonumuzca muayene edilmiş, sipariş şartlarına uygun bulunmadığından kabul edilmemiştir."
            : "Yukarıda nitelik ve miktarları yazılı malzemeler komisyonumuzca fiziki, teknik ve idari açıdan muayene edilmiş olup, sipariş şartlarına uygun olduğu, ayıpsız ve noksansız olarak teslim alındığı tespit edilmiştir."}{" "}
        İşbu tutanak tarafımızca tanzim edilerek müştereken imza altına alınmıştır.
      </div>

      <div style={{ marginTop: "12pt" }}>
        <div style={{ textAlign: "center", fontWeight: "bold", fontSize: "8.5pt", marginBottom: "6pt" }}>
          MUAYENE VE KABUL KOMİSYONU
        </div>
        <div style={{ display: "flex", justifyContent: "space-around" }}>
          {komisyon.map((u, i) => (
            <div key={i} className="onay-imza-kutu" style={{ minWidth: "140px" }}>
              <span className="kalin">{imzaAdi(u.ad)}</span>
              <span>{u.unvan || "Görevli"}</span>
              <span style={{ fontSize: "7pt", color: "#333" }}>{u.baskan ? "Komisyon Başkanı" : "Üye"}</span>
              <span className="imza-cizgi" />
            </div>
          ))}
        </div>
      </div>
    </div>,
  ];
}

// 12. Basamak (Kontrol ve kapanış): dosya kapağı ve dizini. Kapak ilk sayfa, dizin ikinci sayfadır.
export function kapakVeDizinSayfalari(
  b: BelgeBilgisi,
  satirlar: DizinSatiri[],
  yuklenici: Tedarikci | null,
  kapanisTarihi: string | null,
): ReactNode[] {
  const ustIdare = (b.ayarlar.idare?.ustIdare || "T.C. İDARE MÜDÜRLÜĞÜ").toLocaleUpperCase("tr-TR");
  const birim = b.ayarlar.idare?.birim || "";
  const makam = makamBasligi(birim).toLocaleUpperCase("tr-TR");
  return [
    <div key="dosya-kapagi" className="onay-sablon-kapsayici">
      <IdareBasligi ayarlar={b.ayarlar} />
      <div style={{ textAlign: "center", fontWeight: "bold", fontSize: "16pt", margin: "48pt 0 6pt 0" }}>DOĞRUDAN TEMİN DOSYASI</div>
      <div style={{ textAlign: "center", fontSize: "10pt", marginBottom: "24pt" }}>4734 sayılı Kanun md. 22/d</div>
      <table className="onay-sablon-tablo">
        <tbody>
          <tr>
            <th className="onay-th-etiket" style={{ width: "34%" }}>İdare</th>
            <td className="onay-td-deger">
              <div className="kalin">{ustIdare}</div>
              {birim && <div>{birim}</div>}
            </td>
          </tr>
          <tr>
            <th className="onay-th-etiket">Makam</th>
            <td className="onay-td-deger">{makam}</td>
          </tr>
          <tr>
            <th className="onay-th-etiket">Dosya no</th>
            <td className="onay-td-deger kalin">{b.alim.id}</td>
          </tr>
          <tr>
            <th className="onay-th-etiket">İşin adı</th>
            <td className="onay-td-deger kalin">{b.alim.konu}</td>
          </tr>
          <tr>
            <th className="onay-th-etiket">Dayanak</th>
            <td className="onay-td-deger">4734 sayılı Kanun md. 22/{bentBilgisi(b.alim.bent).harf}</td>
          </tr>
          <tr>
            <th className="onay-th-etiket">Onay tarihi</th>
            <td className="onay-td-deger">{tarihYazisi(b.alim.onayTarihi)}</td>
          </tr>
          <tr>
            <th className="onay-th-etiket">Yüklenici</th>
            <td className="onay-td-deger">{yuklenici ? yuklenici.ad : BOS_DEGER}</td>
          </tr>
          <tr>
            <th className="onay-th-etiket">Sipariş tutarı (KDV hariç)</th>
            <td className="onay-td-deger kalin">{belgeTutari(b.alim.tutar)}</td>
          </tr>
          <tr>
            <th className="onay-th-etiket">Dosya kapanış tarihi</th>
            <td className="onay-td-deger">{kapanisTarihi ? uzunTarih(kapanisTarihi) : BOS_DEGER}</td>
          </tr>
        </tbody>
      </table>
    </div>,
    <div key="dosya-dizini" className="onay-sablon-kapsayici">
      <IdareBasligi ayarlar={b.ayarlar} />
      <div style={{ textAlign: "center", fontWeight: "bold", fontSize: "12pt", margin: "16pt 0 4pt 0" }}>DOSYA DİZİNİ</div>
      <div style={{ textAlign: "center", fontSize: "9pt", marginBottom: "10pt" }}>
        {b.alim.id} · {b.alim.konu}
      </div>
      <table className="belge-tablo ek-tablo" style={{ margin: "0 0 12pt 0" }}>
        <thead>
          <tr>
            <th scope="col">Sıra</th>
            <th scope="col">Evrak</th>
            <th scope="col">Tarih</th>
            <th scope="col">Sayı</th>
            <th scope="col">Açıklama</th>
          </tr>
        </thead>
        <tbody>
          {satirlar.map((s) => (
            <tr key={s.sira}>
              <td>{s.sira}</td>
              <td>{s.ad}</td>
              <td>{bosIse(s.tarih, uzunTarih)}</td>
              <td>{bosIse(s.sayi, (x) => x)}</td>
              <td>{s.not}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>,
  ];
}

