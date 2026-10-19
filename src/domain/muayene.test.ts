import { describe, expect, it } from "vitest";
import { ornekAlimlar, ornekPiyasa } from "../data/ornekVeri";
import { kabulSonucu, muayeneKalemKontrolleri, muayeneKontrolleri, muayeneOlustur, muayeneOzeti, type Muayene } from "./muayene";

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
    expect(m.kalemler).toEqual([expect.objectContaining({ ad: "Lisans yenileme", siparisMiktari: 1, birimFiyat: lisans.tutar })]);
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
    expect(kabulSonucu(m)).toEqual({ sonuc: "kismi", metin: "KISMEN KABUL EDİLDİ (₺2.500 + KDV eksik)" });
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

  it("kalem kontrolleri komisyonu denetlemez", () => {
    const m = muayeneOlustur(klima, klimaPiyasa, "2026-10-16");
    expect(muayeneKalemKontrolleri(m).map((x) => x.baslik)).not.toContain("Üye adı eksik");
  });
});
