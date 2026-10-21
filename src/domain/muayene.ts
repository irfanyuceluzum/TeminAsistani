import { tlKurus } from "./bicim";
import { degerlendir, kalemTutari, type PiyasaArastirmasi } from "./piyasa";
import type { Kontrol } from "./sihirbaz";
import { gorevAyriligiUyarisi, kisi } from "./personel";
import { gunYaz } from "./tarih";
import type { Alim, GorevAtamalari, Personel } from "./tipler";

export interface MuayeneKalemi {
  kalemId: string;
  ad: string;
  birim: string;
  siparisMiktari: number;
  faturaMiktari: number;
  kabulMiktari: number;
  // KDV hariç, kuruş
  birimFiyat: number;
}

export type UyeRolu = "baskan" | "uye";

export interface KomisyonUyesi {
  ad: string;
  unvan: string;
  rol: UyeRolu;
}

export interface Muayene {
  alimId: string;
  muayeneTarihi: string;
  // Malların idareye teslim edildiği gün; boşsa muayene tarihi kullanılır.
  teslimTarihi?: string;
  yer: string;
  faturaNo: string;
  faturaTarihi: string;
  kalemler: MuayeneKalemi[];
  uyeler: KomisyonUyesi[];
  tamamlandi: boolean;
}

// Kalemler piyasa araştırmasının sonucundan gelir; araştırma yoksa (22/d dışı) dosya tek kalem sayılır.
// Komisyon verilmezse boş üç satır (başkan ve iki üye) açılır.
export function muayeneOlustur(alim: Alim, piyasa: PiyasaArastirmasi | null, bugun: string, komisyon: KomisyonUyesi[] = []): Muayene {
  const sonuc = piyasa ? degerlendir(piyasa) : null;
  const kalemler: MuayeneKalemi[] =
    piyasa && sonuc
      ? sonuc.atamalar.map((a) => {
          const k = piyasa.kalemler.find((x) => x.id === a.kalemId)!;
          return { kalemId: k.id, ad: k.ad, birim: k.birim, siparisMiktari: k.miktar, faturaMiktari: k.miktar, kabulMiktari: k.miktar, birimFiyat: a.birimFiyat };
        })
      : [{ kalemId: "tum", ad: alim.konu, birim: "iş", siparisMiktari: 1, faturaMiktari: 1, kabulMiktari: 1, birimFiyat: alim.tutar }];
  return {
    alimId: alim.id,
    muayeneTarihi: bugun,
    yer: "",
    faturaNo: "",
    faturaTarihi: "",
    kalemler,
    uyeler: komisyon.length
      ? komisyon.map((u) => ({ ...u }))
      : [
          { ad: "", unvan: "", rol: "baskan" },
          { ad: "", unvan: "", rol: "uye" },
          { ad: "", unvan: "", rol: "uye" },
        ],
    tamamlandi: false,
  };
}

export interface MuayeneOzeti {
  faturaToplami: number;
  kabulToplami: number;
  fark: number;
  kismi: boolean;
}

function tutar(miktar: number, birimFiyat: number): number {
  return kalemTutari({ id: "", ad: "", birim: "", miktar }, birimFiyat);
}

export function kabulTutari(k: MuayeneKalemi): number {
  return tutar(k.kabulMiktari, k.birimFiyat);
}

export function muayeneOzeti(m: Muayene): MuayeneOzeti {
  const faturaToplami = m.kalemler.reduce((s, k) => s + tutar(k.faturaMiktari, k.birimFiyat), 0);
  const kabulToplami = m.kalemler.reduce((s, k) => s + kabulTutari(k), 0);
  return { faturaToplami, kabulToplami, fark: faturaToplami - kabulToplami, kismi: m.kalemler.some((k) => k.kabulMiktari < k.faturaMiktari) };
}

export function muayeneKontrolleri(m: Muayene): Kontrol[] {
  const k: Kontrol[] = [];

  const baskanlar = m.uyeler.filter((u) => u.rol === "baskan");
  const adsiz = m.uyeler.filter((u) => !u.ad.trim()).length;
  if (baskanlar.length !== 1) k.push({ durum: "engel", baslik: "Komisyon başkanı", detay: "Üyelerden birini başkan seçin." });
  if (adsiz) k.push({ durum: "engel", baslik: "Üye adı eksik", detay: `${adsiz} üyenin adı yazılmamış.` });
  if (baskanlar.length === 1 && !adsiz) {
    k.push(
      m.uyeler.length < 3
        ? { durum: "uyari", baslik: `${m.uyeler.length} kişilik komisyon`, detay: "Üye sayısını idarenizin görevlendirme onayına göre kontrol edin." }
        : { durum: "tamam", baslik: `${m.uyeler.length} kişilik komisyon`, detay: "Başkan ve üyeler belirlendi." },
    );
  }

  k.push(...muayeneKalemKontrolleri(m));
  return k;
}

// Komisyon dışındaki kontroller: tarih, fatura ve kalem miktarları. Basamaklı dosya komisyonu ayrıca denetler.
export function muayeneKalemKontrolleri(m: Muayene): Kontrol[] {
  const k: Kontrol[] = [];
  const ozet = muayeneOzeti(m);
  if (!m.muayeneTarihi) k.push({ durum: "engel", baslik: "Muayene tarihi", detay: "Muayenenin yapıldığı tarihi girin." });
  if (!m.faturaNo.trim() || !m.faturaTarihi) k.push({ durum: "uyari", baslik: "Fatura bilgisi eksik", detay: "Fatura numarası ve tarihi tutanağa yazılır." });

  const fazla = m.kalemler.filter((x) => x.kabulMiktari > x.faturaMiktari || x.faturaMiktari > x.siparisMiktari);
  if (fazla.length) k.push({ durum: "engel", baslik: "Miktar tutarsız", detay: `${fazla.map((x) => x.ad).join(", ")}: kabul faturayı, fatura siparişi aşamaz.` });

  if (ozet.kabulToplami === 0) {
    k.push({ durum: "engel", baslik: "Kabul edilen kalem yok", detay: "En az bir kalem kabul edilmeli. Tamamen ret için ayrı tutanak düzenleyin." });
  } else if (ozet.kismi) {
    k.push({
      durum: "uyari",
      baslik: "Kısmi kabul",
      detay: `Faturadan ${tlKurus(ozet.fark)} eksik kabul ediliyor. İade faturası istenmeli ya da eksik iş tamamlatılıp ek tutanak düzenlenmeli.`,
    });
  } else {
    k.push({ durum: "tamam", baslik: "Tamamı kabul", detay: `${tlKurus(ozet.kabulToplami)} + KDV kabul ediliyor.` });
  }
  if (m.teslimTarihi && m.muayeneTarihi && m.muayeneTarihi < m.teslimTarihi) {
    k.push({ durum: "engel", baslik: "Muayene teslimden önce", detay: "Muayene tarihi teslim tarihinden önce olamaz." });
  }
  return k;
}

// Teslim, sipariş yazısından önce olamaz. Boş teslim tarihi engel değil, girilmesi gereken bilgidir
// (boş metin karşılaştırmada her tarihten küçük sayıldığı için ayrıca ele alınır).
export function teslimSiparisKontrolu(teslimTarihi: string | null | undefined, siparisTarihi: string | null | undefined): Kontrol | null {
  const teslim = teslimTarihi?.slice(0, 10) ?? "";
  if (!teslim) return { durum: "yapilacak", baslik: "Teslim tarihi girilmedi", detay: "Malın teslim edildiği tarihi girin; tutanağa yazılır." };
  const siparis = siparisTarihi?.slice(0, 10);
  if (siparis && teslim < siparis) {
    return { durum: "engel", baslik: "Teslim siparişten önce", detay: `Teslim tarihi sipariş yazısının tarihinden (${gunYaz(siparis)}) önce olamaz.` };
  }
  return null;
}

export type KabulSonucu = "tam" | "kismi" | "ret";

// Tutanakta ve ekranda aynı ifade kullanılır; sonuç kabul miktarlarından çıkar.
export function kabulSonucu(m: Muayene): { sonuc: KabulSonucu; metin: string } {
  const ozet = muayeneOzeti(m);
  if (ozet.kabulToplami === 0) return { sonuc: "ret", metin: "KABUL EDİLMEDİ (Ret)" };
  if (ozet.kismi) return { sonuc: "kismi", metin: `KISMEN KABUL EDİLDİ (${tlKurus(ozet.fark)} + KDV eksik)` };
  return { sonuc: "tam", metin: "UYGUNDUR (Eksiksiz kabul edildi)" };
}

const buyuk = (s: string) => s.trim().toLocaleUpperCase("tr-TR");

// Dosyaya özel komisyon (Muayene.uyeler) kontrolleri; görevlendirme kimlikleri personel listesinden ada çevrilip üye adlarıyla karşılaştırılır.
export function dosyaKomisyonuKontrolleri(uyeler: KomisyonUyesi[], personel: Personel[], g: GorevAtamalari): Kontrol[] {
  const k: Kontrol[] = [];
  const baskanlar = uyeler.filter((u) => u.rol === "baskan");
  const adsiz = uyeler.filter((u) => !u.ad.trim()).length;
  if (baskanlar.length !== 1) k.push({ durum: "engel", baslik: "Komisyon başkanı", detay: "Üyelerden birini başkan seçin." });
  if (adsiz) k.push({ durum: "engel", baslik: "Üye adı eksik", detay: `${adsiz} üyenin adı yazılmamış.` });
  if (uyeler.length < 3 || uyeler.length % 2 === 0) {
    k.push({ durum: "uyari", baslik: `${uyeler.length} kişilik komisyon`, detay: "Komisyonun en az üç kişiden ve tek sayıda üyeden oluşması önerilir." });
  }

  const uyeAdlari = new Set(uyeler.map((u) => buyuk(u.ad)).filter(Boolean));
  const adlar = (idler: (string | null | undefined)[]) =>
    idler.map((id) => (id ? kisi(personel, id)?.ad : undefined)).filter((a): a is string => !!a && uyeAdlari.has(buyuk(a)));
  const yetkili = adlar([g.harcamaYetkilisi, g.gerceklestirme]);
  if (yetkili.length) {
    k.push(gorevAyriligiUyarisi("Muayene komisyonunda yetkili var", yetkili));
  }
  const ortak = adlar(g.piyasaGorevlileri);
  if (ortak.length) {
    k.push({
      durum: "uyari",
      baslik: "Görev çakışması",
      detay: `${ortak.join(", ")} hem piyasa fiyat araştırmasında hem muayene komisyonunda. Fiyatı araştıranın malı kabul etmemesi önerilir.`,
    });
  }
  if (!k.length) k.push({ durum: "tamam", baslik: "Muayene komisyonu uygun", detay: `${uyeler.length} kişilik komisyon; yetkililer ve piyasa görevlileri yer almıyor.` });
  return k;
}

// Muayene tamamlanınca dosya "odeme" aşamasına geçer. Aşama değeri veritabanında kalır; anlamı artık "ödeme MYS'de yapılıyor":
// ödeme emri ve taşınır işlem fişi dış sistemlerde (MYS/TKYS) düzenlenir, dosya 12. basamakta (kontrol ve kapanış) kapatılır.
// Ödeme tutarı kabul edilen tutardır.
export function muayeneSonrasiDosya(m: Muayene): { asama: "odeme"; tutar: number; aciklama: string } {
  const tutarKurus = muayeneOzeti(m).kabulToplami;
  return { asama: "odeme", tutar: tutarKurus, aciklama: `Muayene tamamlandı: ${kabulSonucu(m).metin}; kabul tutarı ${tlKurus(tutarKurus)} + KDV. Dosya ödeme aşamasına geçti.` };
}
