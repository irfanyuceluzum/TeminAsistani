import { describe, expect, it } from "vitest";
import type { GorevAtamalari, Personel } from "./tipler";
import { BOS_GOREVLER } from "./personel";
import { ornekAlimlar, ornekPiyasa } from "../data/ornekVeri";
import { dosyaKomisyonuKontrolleri, muayeneSonrasiDosya, kabulSonucu, muayeneKalemKontrolleri, muayeneKontrolleri, muayeneOlustur, muayeneOzeti, teslimSiparisKontrolu, type Muayene } from "./muayene";

const TL = 100;
const klima = ornekAlimlar.find((a) => a.id === "DT-2026-040")!;
const klimaPiyasa = ornekPiyasa.find((p) => p.alimId === "DT-2026-040")!;

function dolu(): Muayene {
  const m = muayeneOlustur(klima, klimaPiyasa, "2026-10-16");
  m.faturaNo = "ABC2026000000123";
  m.faturaTarihi = "2026-10-15";
  m.uyeler = [
    { ad: "E. Aksoy", unvan: "Tekniker", rol: "baskan" },
    { ad: "B. Çelik", unvan: "Mühendis", rol: "uye" },
    { ad: "A. Yılmaz", unvan: "Şef", rol: "uye" },
  ];
  return m;
}

describe("muayene oluşturma", () => {
  it("kalemleri piyasa araştırması sonucundan alır", () => {
    const m = muayeneOlustur(klima, klimaPiyasa, "2026-10-16");
    expect(m.kalemler).toHaveLength(4);
    expect(m.kalemler[0]).toMatchObject({ ad: "Split klima periyodik bakımı", siparisMiktari: 24, kabulMiktari: 24, birimFiyat: 1_250 * TL });
    expect(muayeneOzeti(m).kabulToplami).toBe(46_900 * TL);
  });

  it("araştırma yoksa dosyayı tek kalem sayar", () => {
    const lisans = ornekAlimlar.find((a) => a.id === "DT-2026-035")!;
    const m = muayeneOlustur(lisans, null, "2026-10-16");
    expect(m.kalemler).toEqual([expect.objectContaining({ ad: lisans.konu, siparisMiktari: 1, birimFiyat: lisans.tutar })]);
  });
});

describe("muayene kontrolleri", () => {
  it("tam ve eksiksiz muayenede engel çıkarmaz", () => {
    const k = muayeneKontrolleri(dolu());
    expect(k.filter((x) => x.durum !== "tamam")).toEqual([]);
  });

  it("kısmi kabulde farkı hesaplar ve uyarır", () => {
    const m = dolu();
    m.kalemler[0].kabulMiktari = 22;
    expect(muayeneOzeti(m)).toMatchObject({ kabulToplami: 44_400 * TL, fark: 2_500 * TL, kismi: true });
    expect(muayeneKontrolleri(m).find((x) => x.baslik === "Kısmi kabul")?.durum).toBe("uyari");
  });

  it("başkansız ve adsız komisyonu engeller", () => {
    const m = muayeneOlustur(klima, klimaPiyasa, "2026-10-16");
    m.uyeler[0].rol = "uye";
    const basliklar = muayeneKontrolleri(m).filter((x) => x.durum === "engel").map((x) => x.baslik);
    expect(basliklar).toEqual(["Komisyon başkanı", "Üye adı eksik"]);
  });

  it("faturayı aşan kabulü ve sıfır kabulü engeller", () => {
    const m = dolu();
    m.kalemler[1].kabulMiktari = 5;
    expect(muayeneKontrolleri(m).some((x) => x.baslik === "Miktar tutarsız")).toBe(true);
    const sifir = dolu();
    sifir.kalemler.forEach((x) => (x.kabulMiktari = 0));
    expect(muayeneKontrolleri(sifir).some((x) => x.baslik === "Kabul edilen kalem yok")).toBe(true);
  });

  it("az üyede ve eksik fatura bilgisinde uyarır", () => {
    const m = dolu();
    m.uyeler = m.uyeler.slice(0, 1);
    m.faturaNo = "";
    const uyarilar = muayeneKontrolleri(m).filter((x) => x.durum === "uyari").map((x) => x.baslik);
    expect(uyarilar).toEqual(["1 kişilik komisyon", "Fatura bilgisi eksik"]);
  });

  it("verilen komisyonu satır olarak açar", () => {
    const m = muayeneOlustur(klima, klimaPiyasa, "2026-10-16", [
      { ad: "Fatma Kaya", unvan: "Öğretmen", rol: "baskan" },
      { ad: "Hasan Çelik", unvan: "Öğretmen", rol: "uye" },
    ]);
    expect(m.uyeler.map((u) => u.ad)).toEqual(["Fatma Kaya", "Hasan Çelik"]);
    expect(muayeneOlustur(klima, klimaPiyasa, "2026-10-16").uyeler).toHaveLength(3);
  });
});

describe("kabul sonucu", () => {
  it("tamamı kabul edilince 'uygundur' der", () => {
    expect(kabulSonucu(dolu())).toEqual({ sonuc: "tam", metin: "UYGUNDUR (Eksiksiz kabul edildi)" });
  });

  it("eksik kabulde eksik tutarı yazar", () => {
    const m = dolu();
    m.kalemler[0].kabulMiktari = 22;
    expect(kabulSonucu(m)).toEqual({ sonuc: "kismi", metin: "KISMEN KABUL EDİLDİ (₺2.500,00 + KDV eksik)" });
  });

  it("hiçbir kalem kabul edilmezse ret der", () => {
    const m = dolu();
    m.kalemler.forEach((x) => (x.kabulMiktari = 0));
    expect(kabulSonucu(m).sonuc).toBe("ret");
  });
});

describe("teslim ve muayene tarihi", () => {
  it("muayeneyi teslimden önce yapılmış göstermeye izin vermez", () => {
    const m = { ...dolu(), teslimTarihi: "2026-10-20", muayeneTarihi: "2026-10-18" };
    expect(muayeneKalemKontrolleri(m).find((x) => x.durum === "engel")?.baslik).toBe("Muayene teslimden önce");
    expect(muayeneKalemKontrolleri({ ...m, muayeneTarihi: "2026-10-21" }).some((x) => x.durum === "engel")).toBe(false);
  });

  it("teslim sipariş yazısından önce olamaz; boş teslim engel değil, girilecek bilgidir", () => {
    expect(teslimSiparisKontrolu("2026-10-09", "2026-10-10")).toMatchObject({ durum: "engel", baslik: "Teslim siparişten önce" });
    expect(teslimSiparisKontrolu("2026-10-10", "2026-10-10")).toBeNull();
    expect(teslimSiparisKontrolu("2026-10-12", "2026-10-10T09:00:00.000Z")).toBeNull();
    expect(teslimSiparisKontrolu("2026-10-12", undefined)).toBeNull();
    expect(teslimSiparisKontrolu("", "2026-10-10")).toMatchObject({ durum: "yapilacak", baslik: "Teslim tarihi girilmedi" });
    expect(teslimSiparisKontrolu(undefined, "2026-10-10")?.durum).toBe("yapilacak");
  });

  it("kalem kontrolleri komisyonu denetlemez", () => {
    const m = muayeneOlustur(klima, klimaPiyasa, "2026-10-16");
    expect(muayeneKalemKontrolleri(m).map((x) => x.baslik)).not.toContain("Üye adı eksik");
  });
});

describe("dosyaKomisyonuKontrolleri", () => {
  const personel: Personel[] = [
    { id: "p1", ad: "İlker Demir", unvan: "Müdür" },
    { id: "p2", ad: "Ayşe Kaya", unvan: "Öğretmen" },
    { id: "p3", ad: "Mehmet Tan", unvan: "Öğretmen" },
  ];
  const g: GorevAtamalari = { ...BOS_GOREVLER, harcamaYetkilisi: "p1", gerceklestirme: "p2", piyasaGorevlileri: ["p3"] };
  const uye = (ad: string, rol: "baskan" | "uye" = "uye") => ({ ad, unvan: "", rol });
  const uc = [uye("A Bir", "baskan"), uye("B İki"), uye("C Üç")];
  const durumlar = (u: ReturnType<typeof uye>[], gg = g) => dosyaKomisyonuKontrolleri(u, personel, gg).map((x) => `${x.durum}:${x.baslik}`);

  it("uygun komisyonda tek tamam", () => {
    expect(durumlar(uc)).toEqual(["tamam:Muayene komisyonu uygun"]);
  });
  it("başkan sayısı 1 değilse engel", () => {
    expect(durumlar([uye("A"), uye("B"), uye("C")])).toContain("engel:Komisyon başkanı");
    expect(durumlar([uye("A", "baskan"), uye("B", "baskan"), uye("C")])).toContain("engel:Komisyon başkanı");
  });
  it("adı boş üye engel", () => {
    expect(durumlar([uye("A", "baskan"), uye(" "), uye("C")])).toContain("engel:Üye adı eksik");
  });
  it("üye sayısı 3'ten az ya da çiftse uyarı", () => {
    expect(durumlar([uye("A", "baskan"), uye("B")])).toContain("uyari:2 kişilik komisyon");
    expect(durumlar([...uc, uye("D")])).toContain("uyari:4 kişilik komisyon");
  });
  it("harcama yetkilisi ya da gerçekleştirme görevlisi üyeyse engel değil uyarı (Türkçe büyük/küçük duyarsız)", () => {
    const baslik = "uyari:Muayene komisyonunda yetkili var: görevler ayrılığı";
    expect(durumlar([uye("A", "baskan"), uye("B"), uye("İLKER DEMİR")])).toContain(baslik);
    expect(durumlar([uye("A", "baskan"), uye("B"), uye("ayşe kaya")])).toContain(baslik);
    expect(durumlar([uye("A", "baskan"), uye("B"), uye("ayşe kaya")]).some((s) => s.startsWith("engel:"))).toBe(false);
    const u = dosyaKomisyonuKontrolleri([uye("A", "baskan"), uye("B"), uye("ayşe kaya")], personel, g).find((x) => x.durum === "uyari" && x.baslik.includes("görevler ayrılığı"))!;
    expect(u.detay).toContain("Standart 9");
  });
  it("piyasa görevlisi üyeyse görev çakışması uyarısı kişi adıyla", () => {
    const r = dosyaKomisyonuKontrolleri([uye("A", "baskan"), uye("B"), uye("mehmet tan")], personel, g);
    const c = r.find((x) => x.baslik === "Görev çakışması")!;
    expect(c.durum).toBe("uyari");
    expect(c.detay).toContain("Mehmet Tan");
  });
});

describe("muayeneSonrasiDosya", () => {
  it("ödeme aşaması, kabul tutarı ve açıklama", () => {
    const m = dolu();
    m.kalemler[0].kabulMiktari = m.kalemler[0].faturaMiktari - 1;
    const r = muayeneSonrasiDosya(m);
    expect(r.asama).toBe("odeme");
    expect(r.tutar).toBe(muayeneOzeti(m).kabulToplami);
    expect(r.aciklama).toContain(kabulSonucu(m).metin);
    expect(r.aciklama).toContain("kabul tutarı");
  });
});
