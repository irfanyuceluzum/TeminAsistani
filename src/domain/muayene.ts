import { degerlendir, kalemTutari, type PiyasaArastirmasi } from "./piyasa";
import type { Kontrol } from "./sihirbaz";
import type { Alim } from "./tipler";

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

function tl(kurus: number): string {
  return "₺" + (kurus / 100).toLocaleString("tr-TR", { maximumFractionDigits: 2 });
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
      detay: `Faturadan ${tl(ozet.fark)} eksik kabul ediliyor. İade faturası istenmeli ya da eksik iş tamamlatılıp ek tutanak düzenlenmeli.`,
    });
  } else {
    k.push({ durum: "tamam", baslik: "Tamamı kabul", detay: `${tl(ozet.kabulToplami)} + KDV kabul ediliyor.` });
  }
  if (m.teslimTarihi && m.muayeneTarihi && m.muayeneTarihi < m.teslimTarihi) {
    k.push({ durum: "engel", baslik: "Muayene teslimden önce", detay: "Muayene tarihi teslim tarihinden önce olamaz." });
  }
  return k;
}

export type KabulSonucu = "tam" | "kismi" | "ret";

// Tutanakta ve ekranda aynı ifade kullanılır; sonuç kabul miktarlarından çıkar.
export function kabulSonucu(m: Muayene): { sonuc: KabulSonucu; metin: string } {
  const ozet = muayeneOzeti(m);
  if (ozet.kabulToplami === 0) return { sonuc: "ret", metin: "KABUL EDİLMEDİ (Ret)" };
  if (ozet.kismi) return { sonuc: "kismi", metin: `KISMEN KABUL EDİLDİ (${tl(ozet.fark)} + KDV eksik)` };
  return { sonuc: "tam", metin: "UYGUNDUR (Eksiksiz kabul edildi)" };
}
