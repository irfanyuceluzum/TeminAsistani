import { describe, expect, it } from "vitest";
import { ornekAlimlar, ornekPiyasa } from "../data/ornekVeri";
import { asamaIlerlemesi, asamaSirasi, asamaTarihleri, evrakDurumlari, evrakListesi, kapanisEksikleri } from "./dosya";
import type { Alim } from "./tipler";

const alim = (id: string, d: Partial<Alim> = {}): Alim => ({ ...ornekAlimlar.find((a) => a.id === id)!, ...d });
const tamam = (tarih = "2026-10-01") => ({ tamam: true, tarih, not: "" });

describe("aşama sırası", () => {
  it("tek sıra vardır ve piyasa araştırmasını içerir", () => {
    expect(asamaSirasi()).toEqual(["ihtiyac", "dayanak", "onay", "piyasa", "siparis", "muayene", "odeme", "tamamlandi"]);
  });
});

describe("evrak listesi", () => {
  it("22/d için sistemden gelen piyasa evrakı içerir", () => {
    const l = evrakListesi(alim("DT-2026-040"));
    expect(l.filter((e) => e.sistemden).map((e) => e.kod)).toEqual(["ekap-kaydi", "piyasa-tutanagi", "yasaklilik"]);
    expect(l.some((e) => e.kod === "kik-bildirimi")).toBe(true);
  });

  it("borç sorgusu listede yok; TİF (TKYS) ve ödeme emri (MYS) dış sistem, KİK zorunlu değil", () => {
    const l = evrakListesi(alim("DT-2026-040"));
    expect(l.some((e) => e.kod === "borc-sorgusu")).toBe(false);
    expect(l.find((e) => e.kod === "tasinir-fisi")).toMatchObject({ ad: "Taşınır işlem fişi", disSistem: "TKYS", zorunlu: false, sistemden: false });
    expect(l.find((e) => e.kod === "odeme-emri")).toMatchObject({ ad: "Ödeme emri belgesi", disSistem: "MYS", zorunlu: false });
    expect(l.find((e) => e.kod === "kik-bildirimi")!.zorunlu).toBe(false);
    expect(l.filter((e) => !e.zorunlu).map((e) => e.kod)).toEqual(["siparis-yazisi", "tasinir-fisi", "odeme-emri", "kik-bildirimi"]);
    // Süreye yayılan işte sözleşme zorunludur (Tebliğ m.4/5).
    expect(evrakListesi(alim("DT-2026-040", { sureliIs: true })).find((e) => e.kod === "siparis-yazisi")).toMatchObject({ ad: "Sözleşme", zorunlu: true });
  });

  it("hangi bent kayıtlı olursa olsun 22/d evrakını üretir", () => {
    for (const bent of ["22/b", "22/c", "22/e"] as const) {
      const kodlar = evrakListesi(alim("DT-2026-035", { bent })).map((e) => e.kod);
      expect(kodlar).toContain("piyasa-tutanagi");
      expect(kodlar).toContain("yasaklilik");
      expect(kodlar).toContain("kik-bildirimi");
      expect(kodlar).not.toContain("dayanak-belgesi");
    }
  });

  it("piyasa evrakını araştırmanın tamamlanmasından çıkarır", () => {
    const a = alim("DT-2026-041");
    const p = structuredClone(ornekPiyasa[0]);
    expect(evrakDurumlari(a, {}, p).find((e) => e.kod === "piyasa-tutanagi")!.tamam).toBe(false);
    p.tamamlandi = true;
    expect(evrakDurumlari(a, {}, p).find((e) => e.kod === "piyasa-tutanagi")!.tamam).toBe(true);
  });
});

describe("yasaklılık sorgusu", () => {
  it("tutanak onaylı olsa da seçilen firmanın sorgu tarihi yoksa eksik sayar", () => {
    const a = alim("DT-2026-041");
    const p = structuredClone(ornekPiyasa[0]);
    p.tamamlandi = true;
    p.teklifler.forEach((t) => (t.yasaklilikSorgusu = null));
    const y = evrakDurumlari(a, {}, p).find((e) => e.kod === "yasaklilik")!;
    expect(y.tamam).toBe(false);
    expect(y.not).toMatch(/7\. basamak/);
  });

  it("yalnızca kazanan firmanın sorgusu yeterlidir", () => {
    const a = alim("DT-2026-041");
    const p = structuredClone(ornekPiyasa[0]);
    // Toplam esasında Toros AŞ en düşük teklifi veriyor; diğerlerinin sorgusu aranmaz.
    p.teklifler.forEach((t) => (t.yasaklilikSorgusu = t.tedarikciId === "toros" ? "2026-10-16" : null));
    expect(evrakDurumlari(a, {}, p).find((e) => e.kod === "yasaklilik")!.tamam).toBe(true);
  });

  it("teklif yokken tamam saymaz", () => {
    const a = alim("DT-2026-041");
    const p = { ...structuredClone(ornekPiyasa[0]), teklifler: [] };
    expect(evrakDurumlari(a, {}, p).find((e) => e.kod === "yasaklilik")!.tamam).toBe(false);
  });
});

describe("dosyanın kapanışı", () => {
  const hepsi = (a: Alim) => Object.fromEntries(evrakListesi(a).filter((e) => !e.sistemden).map((e) => [e.kod, tamam()]));

  it("bütün evraklar tamamsa eksik bırakmaz", () => {
    const a = alim("DT-2026-041", { ekapKayitNo: "26DT1" });
    const p = { ...structuredClone(ornekPiyasa[0]), tamamlandi: true };
    expect(kapanisEksikleri(a, hepsi(a), p)).toEqual([]);
  });

  it("yalnız zorunlu evrak eksikse adını verir; TİF, ödeme emri ve KİK eksikliği engellemez", () => {
    const a = alim("DT-2026-041", { ekapKayitNo: "26DT1" });
    const p = { ...structuredClone(ornekPiyasa[0]), tamamlandi: true };
    const k = hepsi(a);
    delete k["tasinir-fisi"];
    delete k["odeme-emri"];
    delete k["kik-bildirimi"];
    expect(kapanisEksikleri(a, k, p)).toEqual([]);
    delete k["fatura"];
    expect(kapanisEksikleri(a, k, p)).toEqual(["Fatura"]);
  });

  it("yasaklılık sorgusu yapılmadan kapanmaz", () => {
    const a = alim("DT-2026-041", { ekapKayitNo: "26DT1" });
    const p = { ...structuredClone(ornekPiyasa[0]), tamamlandi: true };
    p.teklifler.forEach((t) => (t.yasaklilikSorgusu = null));
    expect(kapanisEksikleri(a, hepsi(a), p)).toEqual(["Yasaklılık sorgusu çıktıları"]);
  });
});

describe("aşama ilerlemesi", () => {
  it("eksik evrak varken ilerletmez", () => {
    const a = alim("DT-2026-039", { asama: "siparis", sureliIs: true });
    const d = asamaIlerlemesi(a, evrakDurumlari(a, { "ihtiyac-yazisi": tamam(), "onay-belgesi": tamam() }, null));
    expect(d.sonraki).toBe("muayene");
    expect(d.eksikler).toContain("Sözleşme");
    expect(d.eksikler).toContain("Piyasa fiyat araştırması tutanağı ve teklifler");
  });

  it("evraklar tamamsa sonraki aşamayı verir", () => {
    const a = alim("DT-2026-041", { asama: "odeme", ekapKayitNo: "2026/123456" });
    const kayit = Object.fromEntries(evrakListesi(a).map((e) => [e.kod, tamam()]));
    const p = { ...structuredClone(ornekPiyasa[0]), tamamlandi: true };
    // Ödeme aşamasında kapanış kontrol ekranında yapılır
    expect(asamaIlerlemesi(a, evrakDurumlari(a, kayit, p))).toEqual({ sonraki: "tamamlandi", eksikler: [], ekran: "kontrol" });
  });

  it("ödeme aşamasında yalnız zorunlu eksikleri bildirir; TİF/ödeme emri/KİK eksikliği sayılmaz", () => {
    const a = alim("DT-2026-041", { asama: "odeme", ekapKayitNo: "2026/123456" });
    const p = { ...structuredClone(ornekPiyasa[0]), tamamlandi: true };
    const kayit = Object.fromEntries(evrakListesi(a).filter((e) => e.zorunlu).map((e) => [e.kod, tamam()]));
    expect(asamaIlerlemesi(a, evrakDurumlari(a, kayit, p))).toEqual({ sonraki: "tamamlandi", eksikler: [], ekran: "kontrol" });
    delete kayit["fatura"];
    expect(asamaIlerlemesi(a, evrakDurumlari(a, kayit, p)).eksikler).toEqual(["Fatura"]);
  });

  it("22/d onay aşamasında piyasa ekranına yönlendirir", () => {
    const a = alim("DT-2026-042", { asama: "onay" });
    expect(asamaIlerlemesi(a, evrakDurumlari(a, {}, null)).ekran).toBe("piyasa");
  });

  it("muayene aşamasında tutanak ekranına yönlendirir", () => {
    const a = alim("DT-2026-040");
    expect(asamaIlerlemesi(a, evrakDurumlari(a, {}, null))).toMatchObject({ sonraki: "odeme", ekran: "muayene" });
  });

  it("ödeme aşamasında kontrol ekranına yönlendirir", () => {
    const a = alim("DT-2026-038");
    expect(asamaIlerlemesi(a, evrakDurumlari(a, {}, null)).ekran).toBe("kontrol");
  });

  it("tamamlanan dosyada ilerleme yoktur", () => {
    const a = alim("DT-2026-033");
    expect(asamaIlerlemesi(a, evrakDurumlari(a, {}, null)).sonraki).toBeNull();
  });
});

describe("EKAP kaydı ve sözleşme", () => {
  it("EKAP kaydını kayıt numarasından çıkarır", () => {
    const bos = evrakDurumlari(alim("DT-2026-039"), {}, null).find((e) => e.kod === "ekap-kaydi")!;
    expect(bos.tamam).toBe(false);
    const dolu = evrakDurumlari(alim("DT-2026-039", { ekapKayitNo: "2026/123456" }), {}, null).find((e) => e.kod === "ekap-kaydi")!;
    expect(dolu).toMatchObject({ tamam: true, not: "No 2026/123456" });
  });

  it("EKAP kaydı yoksa sipariş aşamasından ilerletmez", () => {
    const a = alim("DT-2026-041", { asama: "siparis", ekapKayitNo: undefined });
    const kayit = Object.fromEntries(evrakListesi(a).map((e) => [e.kod, tamam()]));
    const p = { ...structuredClone(ornekPiyasa[0]), tamamlandi: true };
    expect(asamaIlerlemesi(a, evrakDurumlari(a, kayit, p)).eksikler).toEqual(["EKAP doğrudan temin kaydı"]);
  });

  it("sözleşme zorunlu dosyada evrak adı sözleşmedir", () => {
    const ad = (a: Alim) => evrakListesi(a).find((e) => e.kod === "siparis-yazisi")!.ad;
    expect(ad(alim("DT-2026-039"))).toBe("Sipariş yazısı veya sözleşme");
    expect(ad(alim("DT-2026-039", { sureliIs: true }))).toBe("Sözleşme");
    expect(ad(alim("DT-2026-038", { bent: "22/c" }))).toBe("Sipariş yazısı veya sözleşme");
  });
});

describe("aşama tarihleri", () => {
  const kayit = (tarih: string) => ({ tamam: true, tarih, not: "" });
  const tum = {
    "ihtiyac-yazisi": kayit("2026-09-01"),
    "onay-belgesi": kayit("2026-09-03"),
    "piyasa-tutanagi": kayit("2026-09-05"),
    "siparis-yazisi": kayit("2026-09-08"),
    "muayene-tutanagi": kayit("2026-09-12"),
    "odeme-emri": kayit("2026-09-15"),
    "kik-bildirimi": kayit("2026-09-20"),
  };

  it("22/d dosyada bütün aşamaları evrak tarihlerinden eşler", () => {
    const a = alim("DT-2026-040", { onayTarihi: "2026-08-30", asama: "tamamlandi" });
    expect(asamaTarihleri(a, tum)).toEqual({
      ihtiyac: "2026-09-01",
      dayanak: "2026-08-30",
      onay: "2026-09-03",
      piyasa: "2026-09-05",
      siparis: "2026-09-08",
      muayene: "2026-09-12",
      odeme: "2026-09-15",
      tamamlandi: "2026-09-20",
    });
  });

  it("22/b bentli gizli kayıtta da 22/d kuralıyla piyasa tarihi üretilir", () => {
    const t = asamaTarihleri(alim("DT-2026-035", { bent: "22/b" }), tum);
    expect(t.piyasa).toBe("2026-09-05");
  });

  it("ihtiyaç yazısı yokken açılış gününe düşer", () => {
    const a = alim("DT-2026-040", { onayTarihi: "2026-08-30" });
    expect(asamaTarihleri(a, {}).ihtiyac).toBe("2026-08-30");
  });

  it("tamamlanmamış dosyada tamamlandi anahtarı yoktur", () => {
    const a = alim("DT-2026-040", { asama: "odeme" });
    expect("tamamlandi" in asamaTarihleri(a, tum)).toBe(false);
  });

  it("ISO zaman damgalı evrak tarihini güne indirger", () => {
    const a = alim("DT-2026-040");
    expect(asamaTarihleri(a, { "onay-belgesi": kayit("2026-09-03T14:25:00.000Z") }).onay).toBe("2026-09-03");
  });

  it("kapanış günü dosya-kapanisi kaydından, yoksa ödeme emri ve KİK tarihlerinin en geçinden gelir", () => {
    const a = alim("DT-2026-040", { asama: "tamamlandi" });
    expect(asamaTarihleri(a, { ...tum, "dosya-kapanisi": kayit("2026-09-25") }).tamamlandi).toBe("2026-09-25");
    expect(asamaTarihleri(a, tum).tamamlandi).toBe("2026-09-20");
    expect("tamamlandi" in asamaTarihleri(a, {})).toBe(false);
  });

  it("ödeme emri tarihi yoksa ödeme aşaması muayene tutanağı gününe düşer", () => {
    const a = alim("DT-2026-040", { asama: "odeme" });
    const { "odeme-emri": _oe, ...oeSiz } = tum;
    expect(asamaTarihleri(a, oeSiz).odeme).toBe("2026-09-12");
    expect(asamaTarihleri(a, {}).odeme).toBeUndefined();
  });

  it("tarihi boş evrakı dikkate almaz", () => {
    const a = alim("DT-2026-040");
    expect("onay" in asamaTarihleri(a, { "onay-belgesi": kayit("") })).toBe(false);
  });
});
