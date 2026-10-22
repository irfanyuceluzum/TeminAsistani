import { Fragment, type ReactNode } from "react";
import { SARTLAR, belgeNumarasi, harcamaYetkilisiMakami, type DosyaBasamaklari, type EvrakFormu, type MaliyetSonucu, isinTuruBul, makamBasligi } from "../../domain/basamaklar";
import { butceTertibi } from "../../domain/parametreler";
import { BOS_GOREVLER, belgeGorevlileri, kisi, komisyon } from "../../domain/personel";
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

// ---- Kurum örnek yazılarından alınan ortak parçalar ----

type Imzaci = { ad: string; unvan: string };

// 22/d alımlarında temin şekli yazısı: "22/d (Parasal Limitler Dahilinde)"
function teminSekli(alim: Alim): string {
  return alim.bent === "22/d" ? "22/d (Parasal Limitler Dahilinde)" : alim.bent;
}

// "Kırmızıdağ İlkokulu Müdürlüğü" → "KIRMIZIDAĞ İLKOKULU MÜDÜRLÜĞÜNE"; ünlüyle biten iyelikli adlara -NA/-NE, ötekilere -A/-E eklenir
// (ünsüz yumuşaması yapılmaz; kurum adları iyelik ekiyle biter).
export function yonelmeBasligi(birim: string): string {
  const b = birim.trim().toLocaleUpperCase("tr-TR");
  if (!b) return "İDAREYE";
  const unluler = [...b].filter((c) => "AEIİOÖUÜ".includes(c));
  const ek = "AIOU".includes(unluler[unluler.length - 1] ?? "E") ? "A" : "E";
  return "AEIİOÖUÜ".includes(b[b.length - 1]) ? `${b}N${ek}` : `${b}${ek}`;
}

function kisiler(ayarlar: Ayarlar, idler: (string | null)[]): Imzaci[] {
  return idler
    .map((id) => kisi(ayarlar.personel ?? [], id))
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map((p) => ({ ad: p.ad, unvan: p.unvan }));
}

// "Sayı : E-… / Konu : …" künyesi; tarih sayı satırının sağındadır.
function SayiKonu({ numara, konu }: { numara: EvrakFormu; konu: string }) {
  return (
    <div className="yazi-kunye">
      <span>Sayı</span>
      <span>: {numara.sayi || "…"}</span>
      <span className="sag">{tarihYazisi(numara.tarih)}</span>
      <span>Konu</span>
      <span>: {konu}</span>
      <span />
    </div>
  );
}

// Cetvel ve tutanakların üstündeki dört satır; onay tarihi ve sayısı doğrudan temin olurununkidir.
function KunyeSatirlari({ b, olur }: { b: BelgeBilgisi; olur: EvrakFormu }) {
  const satirlar: [string, string][] = [
    ["İdarenin Adı", b.ayarlar.idare?.birim ?? ""],
    ["Doğrudan Temin Numarası", b.alim.ekapKayitNo ?? ""],
    ["Mal/Hizmet/Yapım Adı, Niteliği", b.alim.konu],
    ["Alım/Görevlendirme Onay Tarihi/sayısı", `${tarihYazisi(olur.tarih)}   /   ${olur.sayi || "…"}`],
  ];
  return (
    <dl className="kunye-satirlari">
      {satirlar.map(([e, d]) => (
        <Fragment key={e}>
          <dt>{e}</dt>
          <dd>: {d}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

// S / Kalem/Kısım Bilgileri / Birimi / Miktarı; fiyat sütunları firmanın dolduracağı boş hücrelerdir.
function KalemTablosu({
  kalemler,
  baslik = "MAL'IN/HİZMET'İN/YAPIM İŞİ'NİN",
  miktar = (k) => k.miktar,
  fiyatSutunlari = false,
}: {
  kalemler: PiyasaKalemi[];
  baslik?: string;
  miktar?: (k: PiyasaKalemi) => number;
  fiyatSutunlari?: boolean;
}) {
  return (
    <table className="ornek-tablo">
      <thead>
        <tr>
          <th colSpan={fiyatSutunlari ? 6 : 4}>{baslik}</th>
        </tr>
        <tr>
          <th className="sira-sutunu">S</th>
          <th>Kalem/Kısım Bilgileri</th>
          <th>Birimi</th>
          <th>Miktarı</th>
          {fiyatSutunlari && (
            <>
              <th>Birim Fiyatı</th>
              <th>Toplam Fiyatı</th>
            </>
          )}
        </tr>
      </thead>
      <tbody>
        {kalemler.map((k, i) => (
          <tr key={k.id}>
            <td className="merkez">{i + 1}</td>
            <td>{k.ad}</td>
            <td className="merkez">{k.birim}</td>
            <td className="merkez">{miktarYazisi(miktar(k))}</td>
            {fiyatSutunlari && (
              <>
                <td className="bos-hucre" />
                <td className="bos-hucre" />
              </>
            )}
          </tr>
        ))}
        {fiyatSutunlari && (
          <tr>
            <th colSpan={4}>TOPLAM (KDV Hariç)</th>
            <td className="bos-hucre" />
            <td className="bos-hucre" />
          </tr>
        )}
      </tbody>
    </table>
  );
}

// Görevli adları ve unvanları üçerli sütunlarla yazılır (olurdaki görevlendirme tabloları).
function GorevliTablosu({ baslik, kisiler }: { baslik: string; kisiler: Imzaci[] }) {
  const satirlar: (Imzaci | null)[][] = [];
  for (let i = 0; i < Math.max(kisiler.length, 1); i += 3) satirlar.push([0, 1, 2].map((j) => kisiler[i + j] ?? null));
  return (
    <table className="ornek-tablo gorevli-tablosu">
      <thead>
        <tr>
          <th colSpan={3}>{baslik}</th>
        </tr>
      </thead>
      <tbody>
        {satirlar.map((s, i) => (
          <Fragment key={i}>
            <tr>
              {s.map((k, j) => (
                <td key={j} className="merkez">
                  {k ? imzaAdi(k.ad) : ""}
                </td>
              ))}
            </tr>
            <tr>
              {s.map((k, j) => (
                <td key={j} className="merkez">
                  {k?.unvan ?? ""}
                </td>
              ))}
            </tr>
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}

// Görev unvanı, (varsa) tarih, imza yeri, ad ve kadro unvanı; en az üç imza yeri açılır.
function GorevliImzalari({ kisiler, gorev, tarih, enAz = 3 }: { kisiler: Imzaci[]; gorev: string; tarih?: string; enAz?: number }) {
  const yerler = Array.from({ length: Math.max(kisiler.length, enAz) }, (_, i) => kisiler[i] ?? null);
  return (
    <div className="gorevli-imzalari">
      {yerler.map((k, i) => (
        <div key={i}>
          <span>{gorev}</span>
          {tarih !== undefined && <span>{tarihYazisi(tarih)}</span>}
          <span className="imza-bosluk" />
          {k && (
            <>
              <span>{imzaAdi(k.ad)}</span>
              <span>{k.unvan}</span>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

// Harcama yetkilisinin onayı: "OLUR/UYGUNDUR", tarih, ad, unvan.
function OlurImzasi({ ayarlar, tarih, metin = "OLUR/UYGUNDUR" }: { ayarlar: Ayarlar; tarih?: string; metin?: string }) {
  const hy = imzaci(ayarlar, ayarlar.gorevler?.harcamaYetkilisi);
  return (
    <div className="olur-imzasi">
      <span>{metin}</span>
      {tarih !== undefined && <span>{tarihYazisi(tarih)}</span>}
      <span className="imza-bosluk" />
      <span>{imzaAdi(hy.ad)}</span>
      <span>{hy.unvan}</span>
    </div>
  );
}

// Firmaların birim ve toplam fiyatları; sonuç sütunu (yaklaşık maliyet) isteğe bağlıdır.
// Toplam satırında her firmanın birim fiyatlarının ve tutarlarının toplamı yazılır; eksik fiyatlı firmanın tutar toplamı "—" kalır.
function FiyatCetveli({
  kalemler,
  firmalar,
  sonuc,
}: {
  kalemler: PiyasaKalemi[];
  firmalar: { ad: string; fiyatlar: Record<string, number | null | undefined> }[];
  sonuc?: { baslik: string; birimFiyat: (k: PiyasaKalemi) => number | null; toplam: number };
}) {
  const fiyat = (f: (typeof firmalar)[number], k: PiyasaKalemi) => {
    const v = f.fiyatlar[k.id];
    return v && v > 0 ? v : null;
  };
  const birimToplami = (bul: (k: PiyasaKalemi) => number | null) => kalemler.reduce((s, k) => s + (bul(k) ?? 0), 0);
  return (
    <table className="ornek-tablo cetvel">
      <thead>
        <tr>
          <th colSpan={4}>MAL/HİZMET/YAPIM</th>
          <th colSpan={firmalar.length * 2}>TEKLİF VEREN KİŞİLER/FİRMALAR VE TEKLİF FİYATLARI</th>
          {sonuc && (
            <th colSpan={2} rowSpan={2}>
              {sonuc.baslik}
            </th>
          )}
        </tr>
        <tr>
          <th rowSpan={2} className="sira-sutunu">
            S
          </th>
          <th rowSpan={2}>Kalem/Kısım Bilgileri</th>
          <th rowSpan={2}>Birimi</th>
          <th rowSpan={2}>Miktarı</th>
          {firmalar.map((f, i) => (
            <th key={i} colSpan={2}>
              {f.ad}
            </th>
          ))}
        </tr>
        <tr>
          {[...firmalar, ...(sonuc ? [null] : [])].map((_, i) => (
            <Fragment key={i}>
              <th>Birim Fiyat</th>
              <th>Toplam Fiyat</th>
            </Fragment>
          ))}
        </tr>
      </thead>
      <tbody>
        {kalemler.map((k, i) => {
          const sb = sonuc?.birimFiyat(k) ?? null;
          return (
            <tr key={k.id}>
              <td className="merkez">{i + 1}</td>
              <td>{k.ad}</td>
              <td className="merkez">{k.birim}</td>
              <td className="merkez">{miktarYazisi(k.miktar)}</td>
              {firmalar.map((f, j) => {
                const v = fiyat(f, k);
                return (
                  <Fragment key={j}>
                    <td className="sag">{bosIse(v, tutarMetni)}</td>
                    <td className="sag">{bosIse(v === null ? null : kalemTutari(k, v), tutarMetni)}</td>
                  </Fragment>
                );
              })}
              {sonuc && (
                <>
                  <td className="sag">{bosIse(sb, tutarMetni)}</td>
                  <td className="sag">{bosIse(sb === null ? null : kalemTutari(k, sb), tutarMetni)}</td>
                </>
              )}
            </tr>
          );
        })}
        <tr className="kalin">
          <th colSpan={4}>TOPLAM (KDV Hariç)</th>
          {firmalar.map((f, j) => (
            <Fragment key={j}>
              <td className="sag">{tutarMetni(birimToplami((k) => fiyat(f, k)))}</td>
              <td className="sag">{bosIse(firmaFiyatToplami(kalemler, f.fiyatlar as Record<string, number | null>), tutarMetni)}</td>
            </Fragment>
          ))}
          {sonuc && (
            <>
              <td className="sag">{tutarMetni(birimToplami(sonuc.birimFiyat))}</td>
              <td className="sag">{tutarMetni(sonuc.toplam)}</td>
            </>
          )}
        </tr>
      </tbody>
    </table>
  );
}

// 2. basamak: ihtiyaç ve görevlendirme tek yazıdır (Doğrudan Temin Oluru).
export function ihtiyacOnayiSayfalari(b: BelgeBilgisi): ReactNode[] {
  const olur = belgeNumarasi(b.dosya);
  const g = b.ayarlar.gorevler ?? BOS_GOREVLER;
  const arz = imzaci(b.ayarlar, g.gerceklestirme);
  const gerekce = b.dosya.ihtiyacOnayi.gerekce.trim();
  return [
    <>
      <IdareBasligi ayarlar={b.ayarlar} />
      <SayiKonu numara={olur} konu={`${b.alim.konu} Doğrudan Temin Oluru`} />
      <p className="belge-baslik normal-yazi">Harcama Yetkilisi Makamına</p>
      {gerekce && <p className="girintili">{gerekce}</p>}
      <p className="girintili">
        Kurumumuz ihtiyaçlarında kullanılmak üzere aşağıda bilgileri verilen Mal/Hizmet/Yapım İşi'nin Kamu İhale Kanunu'nun {b.alim.bent} Maddesine göre
        Doğrudan Temin yoluyla satın alınması ve aşağıda bilgileri verilen personellerin piyasa araştırma, muayene ve kabul görevlisi olarak
        görevlendirilmesi hususunu;
      </p>
      <p className="girintili">Olurlarınıza arz ederim.</p>
      <div className="sag-imza">
        <span className="imza-bosluk" />
        <span>{imzaAdi(arz.ad)}</span>
        <span>{arz.unvan}</span>
      </div>
      <KalemTablosu kalemler={b.kalemler} baslik="MAL/HİZMET/YAPIM İŞİ'NİN" />
      <GorevliTablosu baslik="PİYASA ARAŞTIRMA GÖREVLİLERİ" kisiler={kisiler(b.ayarlar, g.piyasaGorevlileri)} />
      <GorevliTablosu baslik="MUAYENE VE KABUL GÖREVLİLERİ" kisiler={kisiler(b.ayarlar, komisyon(g))} />
      <OlurImzasi ayarlar={b.ayarlar} metin="OLUR" />
    </>,
  ];
}

// 3. basamak: yaklaşık maliyet için fiyat isteme. Yazı ilgili kişilere hitap eder; firma cevabı aynı sayfadadır.
// Firma seçilirse hitap firmanın adı olur. Birim fiyat istendiğinden miktarlar 1 yazılır.
export function fiyatIstemeSayfalari(b: BelgeBilgisi, firma: Tedarikci | null): ReactNode[] {
  const numara = belgeNumarasi(b.dosya, b.dosya.fiyatIsteme.sayi, b.dosya.fiyatIsteme.tarih);
  const g = b.ayarlar.gorevler ?? BOS_GOREVLER;
  return [
    <>
      <IdareBasligi ayarlar={b.ayarlar} />
      <SayiKonu numara={numara} konu="Yaklaşık Maliyet Araştırması" />
      <p className="belge-baslik">{firma ? firma.ad.toLocaleUpperCase("tr-TR") : "İLGİLİ GERÇEK/TÜZEL KİŞİLERE"}</p>
      <p className="girintili">
        Kurumumuz ihtiyaçlarında kullanılmak üzere aşağıda bilgileri verilen Mal/Hizmet/Yapım İşi, Kamu İhale Kanunu'nun {teminSekli(b.alim)} maddesine
        göre Doğrudan Temin yoluyla satın alınacaktır.
      </p>
      <p className="girintili">
        Yaklaşık maliyetin tespitinde değerlendirilmek üzere aşağıda bilgileri verilen Mal'ın/Hizmet'in/Yapım İşi'nin KDV hariç piyasa fiyatlarının
        karşılarına yazılması ve Kurumumuza gönderilmesi hususunda;
      </p>
      <p className="girintili">Gereğini rica ederim/ederiz.</p>
      <GorevliImzalari kisiler={kisiler(b.ayarlar, g.piyasaGorevlileri)} gorev="Piyasa Araştırma Görevlisi" />
      <p className="belge-baslik">{yonelmeBasligi(b.ayarlar.idare?.birim ?? "")}</p>
      <p className="girintili">Kurumunuzca satın alınacak Mal'ın/Hizmet'in/Yapım İşi'nin piyasa fiyatları aşağıya çıkarılmıştır.</p>
      <p className="girintili">Gereğini bilgilerinize arz ederim/ederiz.</p>
      <KalemTablosu kalemler={b.kalemler} miktar={() => 1} fiyatSutunlari />
      <p className="sag-imza kalin">KİŞİ/FİRMA KAŞE/İMZA</p>
    </>,
  ];
}

// 4. basamak: yaklaşık maliyet hesap cetveli (yatay A4).
export function yaklasikMaliyetSayfalari(b: BelgeBilgisi, sonuc: MaliyetSonucu, firmaAdi: (id: string) => string): ReactNode[] {
  const y = b.dosya.yaklasik;
  const g = b.ayarlar.gorevler ?? BOS_GOREVLER;
  const olur = belgeNumarasi(b.dosya);
  const tarih = belgeNumarasi(b.dosya, undefined, b.dosya.fiyatIsteme.tarih).tarih;
  const gorevliIdler = g.yaklasikMaliyetGorevlileri && g.yaklasikMaliyetGorevlileri.length > 0 ? g.yaklasikMaliyetGorevlileri : g.piyasaGorevlileri;
  return [
    <>
      <div className="baslik-tarih">
        <span />
        <p className="belge-baslik">YAKLAŞIK MALİYET HESAP CETVELİ</p>
        <span className="sag">{tarihYazisi(tarih)}</span>
      </div>
      <KunyeSatirlari b={b} olur={olur} />
      <p className="girintili">
        Kurumumuz ihtiyaçlarında kullanılmak üzere aşağıda bilgileri verilen Mal/Hizmet/Yapım İşi Kamu İhale Kanunu'nun {b.alim.bent} maddesine göre
        Doğrudan Temin yoluyla satın alınmak üzere piyasa fiyat araştırması yapılmış olup verilen fiyatlar ve yaklaşık maliyet aşağıya çıkarılmıştır.
      </p>
      <FiyatCetveli
        kalemler={b.kalemler}
        firmalar={y.firmalar.map((f) => ({ ad: firmaAdi(f.tedarikciId), fiyatlar: f.fiyatlar }))}
        sonuc={{ baslik: "YAKLAŞIK MALİYET", birimFiyat: (k) => sonuc.satirlar.find((r) => r.kalem.id === k.id)?.birimFiyat ?? null, toplam: sonuc.toplam }}
      />
      <p>
        Piyasa araştırması sonucu yaklaşık maliyet, KDV hariç <span className="kalin">{tutarMetni(sonuc.toplam)}</span> Türk Lirası olarak hesaplanmış olup
        iş bu cetvel tarafımızca imza altına alınmıştır.
      </p>
      <div className="cetvel-imzalari">
        <GorevliImzalari kisiler={kisiler(b.ayarlar, gorevliIdler)} gorev="Piyasa Araştırma Görevlisi" enAz={2} />
        <OlurImzasi ayarlar={b.ayarlar} tarih={tarih} />
      </div>
    </>,
  ];
}

// 5. basamak: doğrudan temin onay belgesi. Arz eden ilk piyasa araştırma görevlisi, onaylayan harcama yetkilisidir.
export function dogrudanTeminOnaySayfalari(
  b: BelgeBilgisi,
  ozellestirme?: { makam?: string; sayi?: string; tarih?: string },
): ReactNode[] {
  const g = b.ayarlar.gorevler ?? BOS_GOREVLER;
  const birim = b.ayarlar.idare?.birim || "";
  const numara = belgeNumarasi(b.dosya, ozellestirme?.sayi, ozellestirme?.tarih);
  const makam = (ozellestirme?.makam || b.dosya.onayBelgesi?.makam || harcamaYetkilisiMakami(birim)).toLocaleUpperCase("tr-TR");
  const arz = kisiler(b.ayarlar, g.piyasaGorevlileri)[0] ?? imzaci(b.ayarlar, null);
  const aciklamalar = [
    b.dosya.nitelik.trim() && `İşin niteliği: ${b.dosya.nitelik.trim()}`,
    b.dosya.bolmeGerekcesi.trim() && `Bölme yasağı (4734 md. 5) açıklaması: ${b.dosya.bolmeGerekcesi.trim()}`,
  ].filter(Boolean);
  const satir = (etiket: string, deger: ReactNode) => (
    <tr>
      <th className="onay-th-etiket">{etiket}</th>
      <td className="onay-td-deger">{deger}</td>
    </tr>
  );

  return [
    <div key="dt-onay-belgesi" className="onay-sablon-kapsayici">
      <div className="onay-sablon-ana-baslik">DOĞRUDAN TEMİN ONAY BELGESİ</div>
      <table className="onay-sablon-tablo">
        <tbody>
          {satir("ALIMI YAPAN İDARENİN ADI", birim)}
          {satir("BELGE TARİH VE SAYISI", `${tarihYazisi(numara.tarih)}   /   ${numara.sayi || "…"}`)}
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
          {satir("DOĞRUDAN TEMİN NUMARASI", b.alim.ekapKayitNo ?? "")}
          {satir("İŞİN ADI", b.alim.konu)}
          {satir("TEMİN ŞEKLİ", teminSekli(b.alim))}
          {satir("İŞİN TÜRÜ", isinTuruBul(b.alim.ekonomikKod))}
          <tr>
            <td colSpan={2} className="onay-ara-bosluk"></td>
          </tr>
          {satir("KULLANILABİLİR ÖDENEK TUTARI", b.dosya.odenek > 0 ? belgeTutari(b.dosya.odenek) : "")}
          {satir("YAKLAŞIK MALİYET", b.dosya.yaklasik.hesaplanmayacak ? "Hesaplanmamıştır (Doğrudan Temin Tebliği m.4/4)" : belgeTutari(b.alim.tutar))}
          {satir("YATIRIM/PROJE NUMARASI (Varsa)", "")}
          {satir("BÜTÇE TERTİBİ (Varsa)", butceTertibi(b.ayarlar, b.alim.ekonomikKod))}
          {satir("FİYAT FARKI VERİLECEKSE ŞARTLARI", b.dosya.onayBelgesi?.fiyatFarki || "Verilmeyecektir.")}
          {satir("AVANS VERİLECEKSE ŞARTLARI", b.dosya.onayBelgesi?.avans || "Verilmeyecektir.")}
          {satir("DOKÜMAN HAZIRLANIP HAZIRLANMAYACAĞI", b.dosya.onayBelgesi?.dokuman || "Hazırlanmayacaktır.")}
          <tr>
            <th colSpan={2} className="onay-bolum-baslik">
              DOĞRUDAN TEMİN İLE İLGİLİ DİĞER AÇIKLAMALAR
            </th>
          </tr>
          <tr>
            <td colSpan={2} className="onay-aciklamalar-alani">
              {aciklamalar.map((a) => (
                <div key={a as string} className="onay-aciklama-satir">
                  {a}
                </div>
              ))}
            </td>
          </tr>
          <tr>
            <th colSpan={2} className="onay-bolum-baslik">
              ONAY
            </th>
          </tr>
          <tr>
            <td className="onay-imza-sol" style={{ width: "50%", verticalAlign: "top" }}>
              <p className="onay-arz-metni">
                Yukarıda belirtilen işin Kamu İhale Kanunu'nun {teminSekli(b.alim)} maddesine göre Doğrudan Temin yoluyla satın alınması hususunu;
                Olurlarınıza arz ederim.
              </p>
              <div className="olur-imzasi">
                <span>{tarihYazisi(numara.tarih)}</span>
                <span className="imza-bosluk" />
                <span>Piyasa Araştırma Görevlisi</span>
                <span>{imzaAdi(arz.ad)}</span>
              </div>
            </td>
            <td className="onay-imza-sag" style={{ width: "50%", verticalAlign: "top" }}>
              <OlurImzasi ayarlar={b.ayarlar} tarih={numara.tarih} />
            </td>
          </tr>
        </tbody>
      </table>
      {!b.dosya.yaklasik.hesaplanmayacak && <p className="kucuk">Ek: İdare Tarafından Hazırlanan Yaklaşık Maliyet Hesap Cetveli</p>}
    </div>,
  ];
}

// 6. basamak: teklif vermeye davet. Yazı ilgili kişilere hitap eder; firmanın teklif cetveli aynı sayfadadır.
export function teklifIstemeMektubuSayfalari(
  b: BelgeBilgisi,
  firma: Tedarikci | null,
  yazi?: { sayi?: string; tarih?: string; sonTarih?: string; sonSaat?: string; teslimYeri?: string; teslimSuresi?: string; aciklama?: string },
): ReactNode[] {
  const g = b.ayarlar.gorevler ?? BOS_GOREVLER;
  const numara = belgeNumarasi(b.dosya, yazi?.sayi, yazi?.tarih);
  const sonTarih = yazi?.sonTarih || numara.tarih;
  const sure = `${tarihYazisi(sonTarih)} tarihi ${yazi?.sonSaat ? `${yazi.sonSaat} saatine` : "mesai bitimine"} kadar`;
  const aciklama = yazi?.aciklama?.trim() ?? "";

  return [
    <>
      <IdareBasligi ayarlar={b.ayarlar} />
      <SayiKonu numara={numara} konu="Teklif Vermeye Davet" />
      <p className="belge-baslik">{firma ? firma.ad.toLocaleUpperCase("tr-TR") : "İLGİLİ GERÇEK/TÜZEL KİŞİLERE"}</p>
      <p className="girintili">
        Kurumumuz ihtiyaçlarında kullanılmak üzere aşağıda bilgileri verilen Mal/Hizmet/Yapım İşi, Kamu İhale Kanunu'nun {teminSekli(b.alim)} maddesine
        göre Doğrudan Temin yoluyla satın alınacaktır.
      </p>
      <p className="girintili">
        İlgilenmeniz halinde aşağıda bilgileri verilen Mal/Hizmet/Yapım İşi'ne ilişkin, KDV hariç teklifinizi içeren birim fiyat ve toplam fiyatlarının
        karşılarına yazılarak {sure} Kurumumuza gönderilmesi hususunda;
      </p>
      {aciklama && <p className="girintili">{aciklama}</p>}
      <p className="girintili">Gereğini rica ederim/ederiz.</p>
      <GorevliImzalari kisiler={kisiler(b.ayarlar, g.piyasaGorevlileri)} gorev="Piyasa Araştırma Görevlisi" />
      <p className="belge-baslik">{yonelmeBasligi(b.ayarlar.idare?.birim ?? "")}</p>
      <p className="girintili">Kurumunuzca satın alınacak Mal/Hizmet/Yapım İşi'ne ilişkin teklifimizi içeren birim fiyatlar ve toplam fiyatlar aşağıya çıkarılmıştır.</p>
      <p className="girintili">Gereğini arz ederim/ederiz.</p>
      <KalemTablosu kalemler={b.kalemler} fiyatSutunlari />
      <p className="sag-imza kalin">KİŞİ/FİRMA KAŞE/İMZA</p>
    </>,
  ];
}

// 7. basamak: piyasa fiyat araştırma tutanağı (yatay A4). Kazananın adresi tedarikçi kaydından gelir.
export function piyasaTutanagiSayfalari(
  b: BelgeBilgisi,
  piyasa: PiyasaArastirmasi,
  firmaAdi: (id: string) => string,
  tutanakTarihi = "",
  firmaBul: (id: string) => Tedarikci | undefined = () => undefined,
): ReactNode[] {
  const g = b.ayarlar.gorevler ?? BOS_GOREVLER;
  const olur = belgeNumarasi(b.dosya);
  const tarih = tutanakTarihi || olur.tarih;
  const sonuc = degerlendir(piyasa);
  const kazananlar = (sonuc?.kazananlar ?? []).map((id) => ({
    id,
    ad: firmaAdi(id),
    adres: firmaBul(id)?.adres ?? "",
    tutar: (sonuc?.atamalar ?? []).filter((a) => a.tedarikciId === id).reduce((s, a) => s + a.tutar, 0),
  }));

  return [
    <>
      <div className="baslik-tarih">
        <span />
        <p className="belge-baslik">PİYASA FİYAT ARAŞTIRMA TUTANAĞI</p>
        <span className="sag">{tarihYazisi(tarih)}</span>
      </div>
      <KunyeSatirlari b={b} olur={olur} />
      <FiyatCetveli kalemler={b.kalemler} firmalar={piyasa.teklifler.map((t) => ({ ad: firmaAdi(t.tedarikciId), fiyatlar: t.fiyatlar }))} />
      <table className="ornek-tablo">
        <thead>
          <tr>
            <th colSpan={3}>EN UYGUN (DÜŞÜK) TEKLİFİ VEREN VE TEKLİFİ UYGUN GÖRÜLEN GERÇEK/TÜZEL KİŞİ</th>
          </tr>
          <tr>
            <th>ADI</th>
            <th>GERÇEK/TÜZEL KİŞİNİN ADRESİ</th>
            <th>TEKLİF ETTİĞİ FİYAT</th>
          </tr>
        </thead>
        <tbody>
          {kazananlar.length ? (
            kazananlar.map((k) => (
              <tr key={k.id}>
                <td>{k.ad}</td>
                <td>{k.adres}</td>
                <td className="sag kalin">{belgeTutari(k.tutar)}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td>{BOS_DEGER}</td>
              <td />
              <td />
            </tr>
          )}
        </tbody>
      </table>
      <p className="girintili">
        Kamu İhale Kanunu'nun {b.alim.bent} maddesine göre Doğrudan Temin yoluyla satın alınacak Mal/Hizmet/Yapım İşi'ne ilişkin yapılan piyasa araştırması
        sonucu gerçek/tüzel kişilerce teklif edilen fiyatlar tarafımızca değerlendirilmiş olup Mal/Hizmet/Yapım İşi'nin yukarıda bilgileri verilen ve
        teklifi uygun görülen gerçek/tüzel kişiden alınması uygun görülmüştür. {tarihYazisi(tarih)}
      </p>
      <GorevliImzalari kisiler={kisiler(b.ayarlar, g.piyasaGorevlileri)} gorev="Piyasa Araştırma Görevlisi" enAz={2} />
    </>,
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

// 10 ve 11. basamak: muayene ve kabul tutanağı. Miktarlar kabul edilen miktarlardır; teklifler piyasa araştırmasından gelir.
export function muayeneKabulTutanagiSayfalari(
  b: BelgeBilgisi,
  muayene: Muayene | null,
  firmaAdi: (id: string) => string,
  piyasa: PiyasaArastirmasi | null = null,
): ReactNode[] {
  const olur = belgeNumarasi(b.dosya);
  const tarih = muayene?.muayeneTarihi || olur.tarih;
  const komisyonImzalari = muayeneKomisyonuImzalari(b.ayarlar, muayene).filter((u) => u.ad && u.ad !== "…");
  const kalemler: PiyasaKalemi[] = muayene
    ? muayene.kalemler.map((k) => ({ id: k.kalemId, ad: k.ad, birim: k.birim, miktar: k.kabulMiktari }))
    : b.kalemler;
  const teklifler = (piyasa?.teklifler ?? []).map((t) => ({ id: t.tedarikciId, toplam: piyasa ? firmaToplami(piyasa, t.tedarikciId) : null }));
  const sonuc = piyasa ? degerlendir(piyasa) : null;
  const kazananlar = (sonuc?.kazananlar ?? []).map((id) => ({
    id,
    tutar: (sonuc?.atamalar ?? []).filter((a) => a.tedarikciId === id).reduce((s, a) => s + a.tutar, 0),
  }));
  const kabul = muayene ? kabulSonucu(muayene).sonuc : "tam";

  return [
    <>
      <KunyeSatirlari b={b} olur={olur} />
      <p className="belge-baslik">MUAYENE VE KABUL TUTANAĞI</p>
      <KalemTablosu kalemler={kalemler} />
      <table className="ornek-tablo">
        <thead>
          <tr>
            <th className="sira-sutunu">S</th>
            <th>TEKLİF VEREN GERÇEK/TÜZEL KİŞİLER</th>
            <th>TEKLİF FİYATLARI</th>
          </tr>
        </thead>
        <tbody>
          {teklifler.map((t, i) => (
            <tr key={t.id}>
              <td className="merkez">{i + 1}</td>
              <td>{firmaAdi(t.id)}</td>
              <td className="sag">{bosIse(t.toplam, tutarMetni)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <table className="ornek-tablo">
        <thead>
          <tr>
            <th colSpan={3}>EN UYGUN (DÜŞÜK) TEKLİFİ VEREN VE TEKLİFİ UYGUN GÖRÜLEN GERÇEK/TÜZEL KİŞİ</th>
          </tr>
          <tr>
            <th className="sira-sutunu">S</th>
            <th>Adı</th>
            <th>Teklif Fiyatı</th>
          </tr>
        </thead>
        <tbody>
          {kazananlar.map((k, i) => (
            <tr key={k.id}>
              <td className="merkez">{i + 1}</td>
              <td>{firmaAdi(k.id)}</td>
              <td className="sag">{belgeTutari(k.tutar)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="girintili">
        {kabul === "ret"
          ? "Yukarıda bilgileri verilen Mal/Hizmet/Yapım İşi, idarenin belirlediği şartlar dahilinde muayene edilmiş olup şartlara uygun bulunmadığından kabul edilmemiştir."
          : kabul === "kismi"
            ? "Yukarıda bilgileri verilen Mal/Hizmet/Yapım İşi, idarenin belirlediği şartlar dahilinde muayene edilmiş olup yukarıda yazılı miktarlar kabul edilmiş, kalan miktarlar kabul edilmemiştir."
            : "Yukarıda bilgileri verilen Mal/Hizmet/Yapım İşi, idarenin belirlediği şartlar dahilinde muayenesi yapılmış olup kabule engel herhangi bir durum tespit edilmemiştir."}{" "}
        Söz konusu işin yukarıda alım yapılması uygun görülen gerçek/tüzel kişiden Doğrudan Temin yoluyla satın alınması hususunu;
      </p>
      <p className="girintili">Olurlarınıza arz ederim/ederiz.</p>
      <GorevliImzalari kisiler={komisyonImzalari} gorev="Muayene ve Kabul Görevlisi" tarih={tarih} />
      <OlurImzasi ayarlar={b.ayarlar} tarih={tarih} />
      <p className="kucuk">Ek: Piyasa Fiyat Araştırma Tutanağı</p>
    </>,
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

