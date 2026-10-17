import type { Kontrol } from "./sihirbaz";
import type { Ayarlar, GorevAtamalari, Personel } from "./tipler";

export const BOS_GOREVLER: GorevAtamalari = {
  harcamaYetkilisi: null,
  gerceklestirme: null,
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
      piyasaGorevlileri: g.piyasaGorevlileri.filter((x) => x !== id),
      muayeneBaskani: bos(g.muayeneBaskani),
      muayeneUyeleri: g.muayeneUyeleri.filter((x) => x !== id),
    },
  };
}

// Görev ayrılığı ve komisyon büyüklüğü için öneriler; mevzuat teyidi yapılmadığı için hiçbiri engel değildir.
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
  const n = g.piyasaGorevlileri.length;
  k.push(
    n < 2
      ? { durum: "uyari", baslik: `${n} piyasa görevlisi`, detay: "Fiyat araştırmasının en az iki kişiyle yapılması önerilir." }
      : { durum: "tamam", baslik: `${n} piyasa görevlisi`, detay: "Yazı ve tutanakta imzacı olarak yer alır." },
  );
  const kom = komisyon(g);
  if (!g.muayeneBaskani) {
    k.push({ durum: "yapilacak", baslik: "Komisyon başkanı", detay: "Muayene ve kabul komisyonuna başkan seçin." });
  } else if (kom.length < 3 || kom.length % 2 === 0) {
    k.push({ durum: "uyari", baslik: `${kom.length} kişilik komisyon`, detay: "Komisyonun en az üç kişiden ve tek sayıda üyeden oluşması önerilir." });
  } else {
    k.push({ durum: "tamam", baslik: `${kom.length} kişilik komisyon`, detay: "Başkan ve üyeler belirlendi." });
  }
  const ortak = g.piyasaGorevlileri.filter((p) => kom.includes(p));
  if (ortak.length) {
    k.push({ durum: "uyari", baslik: "Görev çakışması", detay: `${ortak.map(ad).join(", ")} hem fiyat araştırmasında hem muayene komisyonunda. Aynı alımda iki görevi birlikte almaması önerilir.` });
  }
  if (g.harcamaYetkilisi && kom.includes(g.harcamaYetkilisi)) {
    k.push({ durum: "uyari", baslik: "Harcama yetkilisi komisyonda", detay: "Harcama yetkilisinin muayene komisyonunda yer almaması önerilir." });
  }
  return k;
}

// Belgelere dolacak görevli adları; atama yoksa boş kalır.
export function belgeGorevlileri(a: Ayarlar) {
  const personel = a.personel ?? [];
  const g = a.gorevler ?? BOS_GOREVLER;
  const yaz = (id: string | null) => {
    const p = kisi(personel, id);
    return p ? kisiYazisi(p) : "";
  };
  return {
    harcamaYetkilisi: yaz(g.harcamaYetkilisi),
    gerceklestirme: yaz(g.gerceklestirme),
    piyasaGorevlileri: g.piyasaGorevlileri.map((id) => kisi(personel, id)).filter((p): p is Personel => !!p).map(kisiYazisi).join(", "),
    komisyon: komisyon(g)
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
