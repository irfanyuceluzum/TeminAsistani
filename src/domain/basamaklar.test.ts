import { describe, expect, it } from "vitest";
import { ornekAlimlar, ornekAyarlar, ornekLimitDonemleri, ornekPiyasa } from "../data/ornekVeri";
import {
  acilisBasamagi,
  basamaklar,
  basamaklariTamamla,
  bosBasamaklar,
  evrakFormu,
  evrakKaydiYap,
  ilerleme,
  ihtiyacOnayiKontrolleri,
  isinTuruBul,
  onayBelgesiKontrolleri,
  oncekiSonraki,
  veriKontrolleri,
  yaklasikHesapla,
  yaklasikKontrolleri,
  type BasamakGirdisi,
  type YaklasikMaliyet,
} from "./basamaklar";

import type { PiyasaKalemi } from "./piyasa";

const TL = 100;
const temizlik = ornekAlimlar.find((a) => a.id === "DT-2026-041")!;
const temizlikPiyasa = ornekPiyasa.find((p) => p.alimId === "DT-2026-041")!;
const lisans = ornekAlimlar.find((a) => a.id === "DT-2026-035")!;

const kalemler: PiyasaKalemi[] = [
  { id: "a", ad: "Çamaşır suyu", miktar: 40, birim: "adet" },
  { id: "b", ad: "Sabun", miktar: 30, birim: "adet" },
];

function maliyet(d: Partial<YaklasikMaliyet> = {}): YaklasikMaliyet {
  return {
    hesaplanmayacak: false,
    yontem: "ortalama",
    kdvOrani: 20,
    firmalar: [
      { tedarikciId: "toros", belgeAlindi: true, fiyatlar: { a: 85 * TL, b: 210 * TL } },
      { tedarikciId: "ece", belgeAlindi: true, fiyatlar: { a: 92 * TL, b: 198 * TL } },
      { tedarikciId: "kaya", belgeAlindi: true, fiyatlar: { a: 89 * TL, b: 225 * TL } },
    ],
    ...d,
  };
}

function girdi(d: Partial<BasamakGirdisi> = {}): BasamakGirdisi {
  return { alim: temizlik, piyasa: temizlikPiyasa, dosya: bosBasamaklar(temizlik.id, "2026-10-17"), evraklar: {}, muayene: null, odeme: null, ...d };
}

describe("yaklaşık maliyet", () => {
  it("ortalamayı kuruşa yuvarlar, KDV'yi ekler", () => {
    const s = yaklasikHesapla(kalemler, maliyet());
    expect(s.satirlar[0].birimFiyat).toBe(8_867); // (85+92+89)/3 = 88,666…
    expect(s.satirlar[1].birimFiyat).toBe(211 * TL);
    expect(s.toplam).toBe(40 * 8_867 + 30 * 211 * TL);
    expect(s.kdv).toBe(Math.round(s.toplam * 0.2));
    expect(s.hesaplanabilir).toBe(true);
  });

  it("en düşük yönteminde en düşük fiyatı alır", () => {
    const s = yaklasikHesapla(kalemler, maliyet({ yontem: "enDusuk" }));
    expect(s.satirlar.map((r) => r.birimFiyat)).toEqual([85 * TL, 198 * TL]);
  });

  it("eksik fiyatı hesaba katmaz, aykırı fiyatı işaretler", () => {
    const y = maliyet();
    y.firmalar[2].fiyatlar = { a: null, b: 500 * TL };
    const s = yaklasikHesapla(kalemler, y);
    expect(s.satirlar[0].birimFiyat).toBe(Math.round((85 + 92) * TL / 2));
    expect(s.satirlar[1].aykirilar).toEqual([2]);
    const k = yaklasikKontrolleri({ ...bosBasamaklar("x", "2026-10-17"), yaklasik: y, odenek: 85_000 * TL }, s, temizlik, ornekAyarlar, ornekLimitDonemleri, (id) => id);
    expect(k.filter((x) => x.durum === "uyari").map((x) => x.baslik)).toEqual(["Eksik fiyat", "Aykırı fiyat"]);
    expect(k.find((x) => x.baslik === "22/d limiti içinde")).toBeTruthy();
  });

  it("fiyatsız kalemi engeller", () => {
    const y = maliyet();
    y.firmalar.forEach((f) => (f.fiyatlar.b = null));
    const s = yaklasikHesapla(kalemler, y);
    expect(s.hesaplanabilir).toBe(false);
    const k = yaklasikKontrolleri({ ...bosBasamaklar("x", "2026-10-17"), yaklasik: y }, s, temizlik, ornekAyarlar, ornekLimitDonemleri, (id) => id);
    expect(k.filter((x) => x.durum === "engel").map((x) => x.baslik)).toEqual(["Fiyatı olmayan kalem"]);
  });

  it("hesaplanmayacaksa tek tamam kontrolü verir", () => {
    const d = { ...bosBasamaklar("x", "2026-10-17"), yaklasik: maliyet({ hesaplanmayacak: true }) };
    const k = yaklasikKontrolleri(d, yaklasikHesapla(kalemler, d.yaklasik), temizlik, ornekAyarlar, ornekLimitDonemleri, (id) => id);
    expect(k).toHaveLength(1);
    expect(k[0].durum).toBe("tamam");
  });
});

describe("basamak listesi", () => {
  it("13 basamak çıkarır; ilk eksik basamak sürüyor olur", () => {
    const b = basamaklar(girdi());
    expect(b).toHaveLength(13);
    expect(b[0].durum).toBe("tamam"); // örnek araştırmada kalemler hazır
    expect(b[1]).toMatchObject({ no: 2, durum: "suruyor" });
    expect(b.filter((x) => x.durum === "suruyor")).toHaveLength(1);
    expect(acilisBasamagi(b)).toBe(2);
  });

  it("teklif mektuplarını piyasa araştırmasından, sonraki basamakları kayıtlardan okur", () => {
    const dosya = bosBasamaklar(temizlik.id, "2026-10-17");
    dosya.ihtiyacOnayi.imzali = true;
    dosya.yaklasik.hesaplanmayacak = true;
    const b = basamaklar(girdi({ dosya, evraklar: { "onay-belgesi": { tamam: true, tarih: "2026-10-10", not: "" } } }));
    expect(b.slice(2, 4).map((x) => x.durum)).toEqual(["gerekmiyor", "gerekmiyor"]);
    expect(b[4].durum).toBe("tamam");
    expect(b[5]).toMatchObject({ ad: "Teklif mektupları", durum: "tamam" });
    expect(b[6]).toMatchObject({ no: 7, durum: "suruyor" });
    expect(ilerleme(b)).toEqual({ biten: 4, gerekli: 11 });
  });

  it("22/d dışında tutanak gerekmez, teklif evraktan gelir", () => {
    const b = basamaklar(girdi({ alim: lisans, piyasa: null }));
    expect(b[0].durum).toBe("suruyor");
    expect(b[5]).toMatchObject({ ad: "Firmadan fiyat teklifi", evrakKodu: "fiyat-teklifi" });
    expect(b[6].durum).toBe("gerekmiyor");
  });

  it("sözleşme gerekiyorsa 8. basamağın adı değişir", () => {
    expect(basamaklar(girdi())[7].ad).toBe("Sipariş yazısı");
    expect(basamaklar(girdi({ alim: { ...temizlik, sureliIs: true } }))[7].ad).toBe("Sözleşme");
  });

  it("3. basamak fiyat girilince tamamlanır, 4. basamak onay bekler ve onaylanınca tamamlanır", () => {
    const dosya = bosBasamaklar(temizlik.id, "2026-10-17");
    dosya.ihtiyacOnayi.imzali = true;
    dosya.fiyatIsteme.tarih = "2026-10-18";
    dosya.yaklasik = maliyet({ onaylandi: false });
    const p = { ...temizlikPiyasa, kalemler };

    // 3. basamak tamam olmalı, 4. basamak sürüyor olmalı
    let b = basamaklar(girdi({ dosya, piyasa: p }));
    expect(b[2]).toMatchObject({ no: 3, ad: "Fiyat isteme yazısı", durum: "tamam" });
    expect(b[3]).toMatchObject({ no: 4, ad: "Yaklaşık maliyet cetveli", durum: "suruyor" });

    // 4. basamak onaylanınca tamam olmalı ve 5. basamak sürmeli
    dosya.yaklasik.onaylandi = true;
    b = basamaklar(girdi({ dosya, piyasa: p }));
    expect(b[3]).toMatchObject({ no: 4, ad: "Yaklaşık maliyet cetveli", durum: "tamam" });
    expect(b[4]).toMatchObject({ no: 5, ad: "Onay belgesi", durum: "suruyor" });
  });

  it("3, 4 ve 5. basamaklar arasında sıralı gezinir", () => {
    const dosya = bosBasamaklar(temizlik.id, "2026-10-17");
    const b = basamaklar(girdi({ dosya }));
    expect(oncekiSonraki(b, 3).sonraki?.no).toBe(4);
    expect(oncekiSonraki(b, 4).onceki?.no).toBe(3);
    expect(oncekiSonraki(b, 4).sonraki?.no).toBe(5);
    expect(oncekiSonraki(b, 5).onceki?.no).toBe(4);
  });

  it("önceki ve sonraki basamakta gerekmeyenleri atlar", () => {
    const dosya = bosBasamaklar(temizlik.id, "2026-10-17");
    dosya.yaklasik.hesaplanmayacak = true;
    const b = basamaklar(girdi({ dosya }));
    const { onceki, sonraki } = oncekiSonraki(b, 2);
    expect(onceki?.no).toBe(1);
    expect(sonraki?.no).toBe(5);
    expect(oncekiSonraki(b, 5).onceki?.no).toBe(2);
  });
});

describe("kayıt ve kontroller", () => {
  it("eski kayıtta eksik alanları tamamlar", () => {
    const d = basamaklariTamamla({ alimId: "x", ihtiyacOnayi: { tarih: "2026-01-01", sayi: "1", gerekce: "g", imzali: true } }, "2026-10-17");
    expect(d.sartlar.teslimSuresi).toBe("");
    expect(d.yaklasik.yontem).toBe("ortalama");
    expect(d.ihtiyacOnayi.imzali).toBe(true);
  });

  it("veri girişinde boş listeyi engeller, boş şartları sayar", () => {
    const k = veriKontrolleri([], bosBasamaklar("x", "2026-10-17"), temizlik);
    expect(k[0].durum).toBe("engel");
    expect(k.find((x) => x.baslik === "7 şart boş")).toBeTruthy();
  });

  it("ihtiyaç onayında kısa gerekçede uyarır, imzayı bekler", () => {
    const d = bosBasamaklar("x", "2026-10-17");
    d.ihtiyacOnayi.gerekce = "Temizlik";
    const k = ihtiyacOnayiKontrolleri(d, true);
    expect(k.map((x) => x.durum)).toEqual(["uyari", "tamam", "yapilacak"]);
  });

  it("onay belgesi kontrollerinde yaklaşık maliyet onayını engeller, ödenek ve ekap için uyarır", () => {
    const d = bosBasamaklar(temizlik.id, "2026-10-18");
    d.yaklasik = maliyet({ onaylandi: false });
    const k1 = onayBelgesiKontrolleri(temizlik, d, ornekAyarlar, temizlikPiyasa);
    expect(k1.find((x) => x.baslik === "Yaklaşık maliyet onaylanmamış")?.durum).toBe("engel");
    expect(k1.find((x) => x.baslik === "Kullanılabilir ödenek girilmemiş")?.durum).toBe("uyari");

    d.yaklasik.onaylandi = true;
    d.odenek = 50_000 * TL;
    const alimEkap = { ...temizlik, ekapKayitNo: "26DT12345" };
    const k2 = onayBelgesiKontrolleri(alimEkap, d, ornekAyarlar, temizlikPiyasa);
    expect(k2.find((x) => x.baslik === "Yaklaşık maliyet hazır")?.durum).toBe("tamam");
    expect(k2.find((x) => x.baslik === "Kullanılabilir ödenek hazır")?.durum).toBe("tamam");
    expect(k2.find((x) => x.baslik === "EKAP kayıt numarası girildi")?.durum).toBe("tamam");
  });

  it("ekonomik koda göre işin türünü doğru tespit eder", () => {
    expect(isinTuruBul("03.2.1.01")).toBe("Mal Alımı");
    expect(isinTuruBul("03.5.5.01")).toBe("Hizmet Alımı");
    expect(isinTuruBul("06.1.1.01")).toBe("Yapım İşi");
  });
});


describe("evrak formu (sipariş, muayene, taşınır basamakları)", () => {
  it("girilen belge tarihini olduğu gibi kaydeder", () => {
    expect(evrakKaydiYap({ tarih: "2026-10-26", sayi: " E-541 " })).toEqual({ tamam: true, tarih: "2026-10-26", not: "E-541" });
  });

  it("zaman damgasını ya da boş tarihi kaydetmez", () => {
    expect(() => evrakKaydiYap({ tarih: "2026-10-19T17:22:04.000Z", sayi: "" })).toThrow();
    expect(() => evrakKaydiYap({ tarih: "", sayi: "" })).toThrow();
  });

  it("sayfa yeniden açılınca kayıtlı tarih ve sayı geri gelir", () => {
    expect(evrakFormu({ tamam: true, tarih: "2026-10-26", not: "E-541" }, "2026-11-05")).toEqual({ tarih: "2026-10-26", sayi: "E-541" });
    expect(evrakFormu(undefined, "2026-11-05", "E-1")).toEqual({ tarih: "2026-11-05", sayi: "E-1" });
  });

  it("eski sürümün yazdığı zaman damgasından günü çıkarır", () => {
    expect(evrakFormu({ tamam: true, tarih: "2026-10-26T09:00:00.000Z", not: "" }, "2026-11-05").tarih).toBe("2026-10-26");
  });
});
