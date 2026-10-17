import type { Kontrol } from "./sihirbaz";
import type { Ayarlar, GorevAtamalari, Personel } from "./tipler";

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

export function yetkiliMi(id: string | null | undefined, g: GorevAtamalari): boolean {
  if (!id) return false;
  return id === g.harcamaYetkilisi || id === g.gerceklestirme;
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

// Görev ayrılığı ve mevzuat kontrolleri (5018 ve 4734 sayılı kanunlar gereği)
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
    k.push({
      durum: "engel",
      baslik: "Yetkili piyasa araştırmasında yer alamaz",
      detay: `${piyasadaYetkili.map(ad).join(", ")} Harcama Yetkilisi veya Gerçekleştirme Görevlisidir. Mevzuat gereği piyasa araştırmasında görev alamaz.`,
    });
  }

  const n = g.piyasaGorevlileri.filter((id) => !yetkiliMi(id, g)).length;
  k.push(
    n < 2
      ? { durum: "uyari", baslik: `${n} piyasa görevlisi`, detay: "Fiyat araştırmasının en az iki kişiyle yapılması önerilir." }
      : { durum: "tamam", baslik: `${n} piyasa görevlisi`, detay: "Yazı ve tutanakta imzacı olarak yer alır." },
  );

  // 2. Muayene ve Kabul (Teslim Alma) Komisyonu kontrolleri
  const kom = komisyon(g);
  const muayenedeYetkili = [g.harcamaYetkilisi, g.gerceklestirme].filter((id): id is string => !!id && kom.includes(id));
  if (muayenedeYetkili.length) {
    k.push({
      durum: "engel",
      baslik: "Yetkili muayene komisyonunda yer alamaz",
      detay: `${muayenedeYetkili.map(ad).join(", ")} Harcama Yetkilisi veya Gerçekleştirme Görevlisidir. Muayene ve kabul (teslim alma) komisyonunda yer alamaz.`,
    });
  }

  if (!g.muayeneBaskani) {
    k.push({ durum: "yapilacak", baslik: "Komisyon başkanı", detay: "Muayene ve kabul komisyonuna başkan seçin." });
  } else if (kom.length < 3 || kom.length % 2 === 0) {
    k.push({ durum: "uyari", baslik: `${kom.length} kişilik komisyon`, detay: "Komisyonun en az üç kişiden ve tek sayıda üyeden oluşması önerilir." });
  } else {
    k.push({ durum: "tamam", baslik: `${kom.length} kişilik komisyon`, detay: "Başkan ve üyeler belirlendi." });
  }

  // 3. Yaklaşık Maliyet Komisyonu kontrolleri
  const ymGorevlileri = g.yaklasikMaliyetGorevlileri ?? [];
  const ymdeYetkili = [g.harcamaYetkilisi, g.gerceklestirme].filter((id): id is string => !!id && ymGorevlileri.includes(id));
  if (ymdeYetkili.length) {
    k.push({
      durum: "engel",
      baslik: "Yetkili yaklaşık maliyette yer alamaz",
      detay: `${ymdeYetkili.map(ad).join(", ")} Harcama Yetkilisi veya Gerçekleştirme Görevlisidir. Yaklaşık maliyet komisyonunda yer alamaz.`,
    });
  }

  // Piyasa ve muayene ortaklığı uyarısı
  const ortak = g.piyasaGorevlileri.filter((p) => kom.includes(p) && !yetkiliMi(p, g));
  if (ortak.length) {
    k.push({ durum: "uyari", baslik: "Görev çakışması", detay: `${ortak.map(ad).join(", ")} hem fiyat araştırmasında hem muayene komisyonunda. Aynı alımda iki görevi birlikte almaması önerilir.` });
  }

  return k;
}

// Belgelere dolacak görevli adları; yetkililer komisyonlardan hariç tutulur.
export function belgeGorevlileri(a: Ayarlar) {
  const personel = a.personel ?? [];
  const g = a.gorevler ?? BOS_GOREVLER;
  const yaz = (id: string | null) => {
    const p = kisi(personel, id);
    return p ? kisiYazisi(p) : "";
  };
  const piyasaTemiz = g.piyasaGorevlileri.filter((id) => !yetkiliMi(id, g));
  const ymTemiz = (g.yaklasikMaliyetGorevlileri && g.yaklasikMaliyetGorevlileri.length > 0
    ? g.yaklasikMaliyetGorevlileri
    : g.piyasaGorevlileri
  ).filter((id) => !yetkiliMi(id, g));
  const komisyonTemiz = komisyon(g).filter((id) => !yetkiliMi(id, g));

  return {
    harcamaYetkilisi: yaz(g.harcamaYetkilisi),
    gerceklestirme: yaz(g.gerceklestirme),
    piyasaGorevlileri: piyasaTemiz.map((id) => kisi(personel, id)).filter((p): p is Personel => !!p).map(kisiYazisi).join(", "),
    yaklasikGorevlileri: ymTemiz.map((id) => kisi(personel, id)).filter((p): p is Personel => !!p),
    komisyon: komisyonTemiz
      .map((id, i) => {
        const p = kisi(personel, id);
        return p ? { ad: p.ad, unvan: p.unvan, rol: (i === 0 && g.muayeneBaskani && !yetkiliMi(g.muayeneBaskani, g) ? "baskan" : "uye") as "baskan" | "uye" } : null;
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
