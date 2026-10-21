import type { Kontrol } from "./sihirbaz";
import type { Ayarlar, GorevAtamalari, Personel } from "./tipler";

// Muayene ve kabul komisyonunun kuruluş kuralı; kontrol satırlarında ve muayene ekranında aynı metin kullanılır.
export const KOMISYON_KURALI =
  "Muayene ve kabul komisyonu en az üç kişiden kurulur, üye sayısı tek olur (Mal Alımları Denetim, Muayene ve Kabul İşlemlerine Dair Yönetmelik md. 6/1; Hizmet Alımları Muayene ve Kabul Yönetmeliği md. 5).";

// 22/d'de komisyonsuz kabul yoktur: 2002 metnindeki istisna (md. 6/3) RG 22.06.2005/25853 md. 13 ile kaldırıldı.
export const KOMISYONSUZ_KABUL_NOTU =
  "Doğrudan temin (22/d) alımlarında da kabul komisyonla yapılır; komisyonsuz teslim alınabilecek bir mal türü yoktur. Yönetmeliğin 2002 metnindeki \"teslim anında idare yetkilisince kabul\" hükmü 22.07.2005'te yürürlükten kaldırıldı (RG 22.06.2005/25853, md. 13).";

export const BOS_GOREVLER: GorevAtamalari = {
  harcamaYetkilisi: null,
  gerceklestirme: null,
  yaklasikMaliyetGorevlileri: [],
  piyasaGorevlileri: [],
  muayeneBaskani: null,
  muayeneUyeleri: [],
};

export function kisi(personel: Personel[], id: string | null): Personel | undefined {
  return id ? personel.find((p) => p.id === id) : undefined;
}

// "Ali Yılmaz (Öğretmen)" biçimi; belgelerdeki görevli listelerinde kullanılır.
export function kisiYazisi(p: Personel): string {
  return p.unvan ? `${p.ad} (${p.unvan})` : p.ad;
}

export function komisyon(g: GorevAtamalari): string[] {
  const uyeler = g.muayeneUyeleri.filter((u) => u !== g.muayeneBaskani);
  return g.muayeneBaskani ? [g.muayeneBaskani, ...uyeler] : uyeler;
}

export function kisininGorevleri(id: string, g: GorevAtamalari): string[] {
  const sonuc: string[] = [];
  if (g.harcamaYetkilisi === id) sonuc.push("Harcama yetkilisi");
  if (g.gerceklestirme === id) sonuc.push("Gerçekleştirme görevlisi");
  if (g.yaklasikMaliyetGorevlileri?.includes(id)) sonuc.push("Yaklaşık maliyet");
  if (g.piyasaGorevlileri.includes(id)) sonuc.push("Piyasa araştırması");
  if (g.muayeneBaskani === id) sonuc.push("Muayene başkanı");
  else if (g.muayeneUyeleri.includes(id)) sonuc.push("Muayene üyesi");
  return sonuc;
}

// Personel çıkarılınca atamalardan da düşer.
export function personelCikar(id: string, personel: Personel[], g: GorevAtamalari): { personel: Personel[]; gorevler: GorevAtamalari } {
  const bos = (x: string | null) => (x === id ? null : x);
  return {
    personel: personel.filter((p) => p.id !== id),
    gorevler: {
      harcamaYetkilisi: bos(g.harcamaYetkilisi),
      gerceklestirme: bos(g.gerceklestirme),
      yaklasikMaliyetGorevlileri: (g.yaklasikMaliyetGorevlileri ?? []).filter((x) => x !== id),
      piyasaGorevlileri: g.piyasaGorevlileri.filter((x) => x !== id),
      muayeneBaskani: bos(g.muayeneBaskani),
      muayeneUyeleri: g.muayeneUyeleri.filter((x) => x !== id),
    },
  };
}

// Harcama yetkilisi ya da gerçekleştirme görevlisi bir komisyona/göreve atandığında verilen ortak uyarı.
// Açık bir yasak hükmü yoktur; dayanak Kamu İç Kontrol Standartları Tebliği Standart 9'dur (görevler ayrılığı).
export function gorevAyriligiUyarisi(gorevBasligi: string, adlar: string[]): Kontrol {
  return {
    durum: "uyari",
    baslik: `${gorevBasligi}: görevler ayrılığı`,
    detay: `${adlar.join(", ")} harcama yetkilisi ya da gerçekleştirme görevlisi. Mevzuatta açık yasak yok, ancak görevler ayrılığı ilkesi (Kamu İç Kontrol Standartları, Standart 9) onay ve kontrol görevlerinin farklı kişilerde olmasını ister. Personel yetersizse görevlendirmeyi bilerek yapın.`,
  };
}

// Görev ayrılığı kontrolleri (Kamu İç Kontrol Standartları, Standart 9)
export function gorevKontrolleri(personel: Personel[], g: GorevAtamalari): Kontrol[] {
  const ad = (id: string) => kisi(personel, id)?.ad ?? id;
  const k: Kontrol[] = [];
  if (!g.harcamaYetkilisi || !g.gerceklestirme) {
    k.push({ durum: "yapilacak", baslik: "Harcama görevlileri", detay: "Harcama yetkilisi ve gerçekleştirme görevlisini seçin." });
  } else if (g.harcamaYetkilisi === g.gerceklestirme) {
    k.push({ durum: "uyari", baslik: "Aynı kişi iki görevde", detay: "Harcama yetkilisi ile gerçekleştirme görevlisinin farklı kişiler olması önerilir." });
  } else {
    k.push({ durum: "tamam", baslik: "Görev ayrılığı", detay: "Harcama yetkilisi ile gerçekleştirme görevlisi farklı kişiler." });
  }

  // 1. Piyasa Fiyat Araştırması kontrolleri
  const piyasadaYetkili = [g.harcamaYetkilisi, g.gerceklestirme].filter((id): id is string => !!id && g.piyasaGorevlileri.includes(id));
  if (piyasadaYetkili.length) {
    k.push(gorevAyriligiUyarisi("Piyasa araştırmasında yetkili var", piyasadaYetkili.map(ad)));
  }

  const n = g.piyasaGorevlileri.length;
  k.push(
    n < 2
      ? { durum: "uyari", baslik: `${n} piyasa görevlisi`, detay: "Fiyat araştırmasının en az iki kişiyle yapılması önerilir." }
      : { durum: "tamam", baslik: `${n} piyasa görevlisi`, detay: "Yazı ve tutanakta imzacı olarak yer alır." },
  );

  // 2. Muayene ve Kabul (Teslim Alma) Komisyonu kontrolleri
  const kom = komisyon(g);
  const muayenedeYetkili = [g.harcamaYetkilisi, g.gerceklestirme].filter((id): id is string => !!id && kom.includes(id));
  if (muayenedeYetkili.length) {
    k.push(gorevAyriligiUyarisi("Muayene komisyonunda yetkili var", muayenedeYetkili.map(ad)));
  }

  if (!g.muayeneBaskani) {
    k.push({ durum: "yapilacak", baslik: "Komisyon başkanı", detay: "Muayene ve kabul komisyonuna başkan seçin." });
  } else if (kom.length < 3 || kom.length % 2 === 0) {
    k.push({ durum: "uyari", baslik: `${kom.length} kişilik komisyon`, detay: KOMISYON_KURALI });
  } else {
    k.push({ durum: "tamam", baslik: `${kom.length} kişilik komisyon`, detay: "Başkan ve üyeler belirlendi." });
  }

  // 3. Yaklaşık Maliyet Komisyonu kontrolleri
  const ymGorevlileri = g.yaklasikMaliyetGorevlileri ?? [];
  const ymdeYetkili = [g.harcamaYetkilisi, g.gerceklestirme].filter((id): id is string => !!id && ymGorevlileri.includes(id));
  if (ymdeYetkili.length) {
    k.push(gorevAyriligiUyarisi("Yaklaşık maliyette yetkili var", ymdeYetkili.map(ad)));
  }

  // Piyasa ve muayene ortaklığı uyarısı
  const ortak = g.piyasaGorevlileri.filter((p) => kom.includes(p));
  if (ortak.length) {
    k.push({ durum: "uyari", baslik: "Görev çakışması", detay: `${ortak.map(ad).join(", ")} hem fiyat araştırmasında hem muayene komisyonunda. Aynı alımda iki görevi birlikte almaması önerilir.` });
  }

  return k;
}

// Muayene ve kabul basamağının komisyon kontrolleri. "Uygun" sonucu ancak engel ve uyarı yoksa verilir.
export function muayeneKomisyonuKontrolleri(personel: Personel[], g: GorevAtamalari): Kontrol[] {
  const ad = (id: string) => kisi(personel, id)?.ad ?? id;
  const kom = komisyon(g);
  const k: Kontrol[] = [];
  const yetkili = [g.harcamaYetkilisi, g.gerceklestirme].filter((id): id is string => !!id && kom.includes(id));
  if (yetkili.length) {
    k.push(gorevAyriligiUyarisi("Muayene komisyonunda yetkili var", yetkili.map(ad)));
  }
  if (!g.muayeneBaskani) k.push({ durum: "uyari", baslik: "Komisyon başkanı seçilmemiş", detay: "Personel ve görevler ekranından başkan seçin." });
  if (kom.length < 3 || kom.length % 2 === 0) {
    k.push({ durum: "uyari", baslik: `${kom.length} kişilik komisyon`, detay: KOMISYON_KURALI });
  }
  const ortak = g.piyasaGorevlileri.filter((p) => kom.includes(p));
  if (ortak.length) {
    k.push({
      durum: "uyari",
      baslik: "Görev çakışması",
      detay: `${ortak.map(ad).join(", ")} hem piyasa fiyat araştırmasında hem muayene komisyonunda. Fiyatı araştıranın malı kabul etmemesi önerilir.`,
    });
  }
  if (!k.length) k.push({ durum: "tamam", baslik: "Muayene komisyonu uygun", detay: `${kom.length} kişilik komisyon; yetkililer ve piyasa görevlileri yer almıyor.` });
  return k;
}

// Belgelere dolacak görevli adları; görevlendirme olduğu gibi yansır (yetkililer de dahil, başkan görevlendirmedeki başkandır).
export function belgeGorevlileri(a: Ayarlar) {
  const personel = a.personel ?? [];
  const g = a.gorevler ?? BOS_GOREVLER;
  const yaz = (id: string | null) => {
    const p = kisi(personel, id);
    return p ? kisiYazisi(p) : "";
  };
  const piyasaTemiz = g.piyasaGorevlileri;
  const ymTemiz = g.yaklasikMaliyetGorevlileri && g.yaklasikMaliyetGorevlileri.length > 0
    ? g.yaklasikMaliyetGorevlileri
    : g.piyasaGorevlileri;
  const komisyonTemiz = komisyon(g);

  return {
    harcamaYetkilisi: yaz(g.harcamaYetkilisi),
    gerceklestirme: yaz(g.gerceklestirme),
    piyasaGorevlileri: piyasaTemiz.map((id) => kisi(personel, id)).filter((p): p is Personel => !!p).map(kisiYazisi).join(", "),
    yaklasikGorevlileri: ymTemiz.map((id) => kisi(personel, id)).filter((p): p is Personel => !!p),
    komisyon: komisyonTemiz
      .map((id, i) => {
        const p = kisi(personel, id);
        return p ? { ad: p.ad, unvan: p.unvan, rol: (i === 0 && g.muayeneBaskani ? "baskan" : "uye") as "baskan" | "uye" } : null;
      })
      .filter((x): x is { ad: string; unvan: string; rol: "baskan" | "uye" } => !!x),
  };
}

export function idareSatirlari(a: Ayarlar): { ust: string; birim: string } {
  return {
    ust: a.idare?.ustIdare.trim() ? a.idare.ustIdare.trim().toLocaleUpperCase("tr-TR") : "[ÜST İDARE]",
    birim: a.idare?.birim.trim() || "[Birim]",
  };
}
