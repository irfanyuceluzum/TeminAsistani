import type { DosyaBasamaklari } from "./basamaklar";
import type { AktarilanKalem } from "./ihtiyacAktar";
import type { PiyasaArastirmasi } from "./piyasa";
import type { Alim, Asama } from "./tipler";

// Önceki dosyalarda alınmış kalem; ihtiyaç listesinde öneri olarak çıkar.
export interface GecmisKalem {
  ad: string;
  ozellik: string;
  miktar: number;
  birim: string;
  // En son alındığı dosya ve tarihi
  alimId: string;
  tarih: string;
  // Kaç ayrı dosyada geçtiği
  kez: number;
}

// Büyük/küçük harf ve fazla boşluk farkı aynı kalem sayılır.
export function kalemAnahtari(ad: string): string {
  return ad.trim().replace(/\s+/g, " ").toLocaleLowerCase("tr-TR");
}

// İptal edilen dosyaların kalemleri önerilmez; aynı kalemin en son alındığı hâli tutulur.
export function gecmisKalemler(piyasalar: PiyasaArastirmasi[], alimlar: Alim[], haricAlimId?: string): GecmisKalem[] {
  const alimHaritasi = new Map(alimlar.map((a) => [a.id, a]));
  const sonuc = new Map<string, GecmisKalem>();
  for (const p of piyasalar) {
    const alim = alimHaritasi.get(p.alimId);
    if (!alim || alim.id === haricAlimId || alim.asama === "iptal") continue;
    const buDosyada = new Set<string>();
    for (const k of p.kalemler) {
      const anahtar = kalemAnahtari(k.ad);
      if (!anahtar || buDosyada.has(anahtar)) continue;
      buDosyada.add(anahtar);
      const onceki = sonuc.get(anahtar);
      const yeni = !onceki || alim.onayTarihi > onceki.tarih;
      const kayit: GecmisKalem = yeni
        ? { ad: k.ad.trim().replace(/\s+/g, " "), ozellik: (k.ozellik ?? "").trim(), miktar: k.miktar, birim: k.birim.trim(), alimId: alim.id, tarih: alim.onayTarihi, kez: 0 }
        : onceki;
      kayit.kez = (onceki?.kez ?? 0) + 1;
      sonuc.set(anahtar, kayit);
    }
  }
  return [...sonuc.values()].sort((x, y) => y.tarih.localeCompare(x.tarih) || x.ad.localeCompare(y.ad, "tr"));
}

export function gecmisKalemBul(liste: GecmisKalem[], ad: string): GecmisKalem | undefined {
  const anahtar = kalemAnahtari(ad);
  return anahtar ? liste.find((g) => kalemAnahtari(g.ad) === anahtar) : undefined;
}

// Ad, özellik ya da birimde geçen kelimeyle süzer; boş arama bütün listeyi verir.
export function gecmisKalemAra(liste: GecmisKalem[], arama: string): GecmisKalem[] {
  const a = kalemAnahtari(arama);
  if (!a) return liste;
  return liste.filter((g) => kalemAnahtari(`${g.ad} ${g.ozellik} ${g.birim}`).includes(a));
}

// Yeni döneme benzeri açılabilecek dosyalar: kabul edilmiş ya da kapanmış olanlar, en yenisi başta.
const KOPYALANABILIR: Asama[] = ["odeme", "tamamlandi"];

export function kopyalanabilirAlimlar(alimlar: Alim[]): Alim[] {
  return alimlar.filter((a) => KOPYALANABILIR.includes(a.asama)).sort((x, y) => y.onayTarihi.localeCompare(x.onayTarihi) || y.id.localeCompare(x.id));
}

// Kaynak dosyadan yeni dosyanın sihirbaz formuna geçen bilgiler. Tarihler, sayılar, firmalar, fiyatlar
// ve evraklar taşınmaz; yeni dosya bunları kendi sürecinde üretir.
export interface DosyaKopyasi {
  kaynakId: string;
  konu: string;
  nitelik: string;
  tutar: number;
  ekonomikKod: string;
  kalemKodu: string;
  talepEden: string;
  teslimYeri: string;
  sureliIs: boolean;
  sartlar: DosyaBasamaklari["sartlar"] | null;
  kalemler: AktarilanKalem[];
}

export function dosyaKopyasi(alim: Alim, piyasa: PiyasaArastirmasi | null, dosya: DosyaBasamaklari | null): DosyaKopyasi {
  return {
    kaynakId: alim.id,
    konu: alim.konu,
    nitelik: dosya?.nitelik ?? "",
    tutar: alim.tutar,
    ekonomikKod: alim.ekonomikKod,
    kalemKodu: alim.kalemKodu,
    talepEden: dosya?.talepEden ?? "",
    teslimYeri: dosya?.teslimYeri ?? "",
    sureliIs: !!alim.sureliIs,
    sartlar: dosya ? { ...dosya.sartlar } : null,
    kalemler: (piyasa?.kalemler ?? [])
      .filter((k) => k.ad.trim())
      .map((k) => ({ ad: k.ad.trim(), ozellik: (k.ozellik ?? "").trim(), miktar: k.miktar, birim: k.birim.trim() })),
  };
}
