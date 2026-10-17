import { describe, expect, it } from "vitest";
import { ornekAlimlar, ornekPiyasa } from "../data/ornekVeri";
import { asamaIlerlemesi, asamaSirasi, evrakDurumlari, evrakListesi } from "./dosya";
import type { Alim } from "./tipler";

const alim = (id: string, d: Partial<Alim> = {}): Alim => ({ ...ornekAlimlar.find((a) => a.id === id)!, ...d });
const tamam = (tarih = "2026-10-01") => ({ tamam: true, tarih, not: "" });

describe("aşama sırası", () => {
  it("22/d'de piyasa araştırması vardır, diğerlerinde yoktur", () => {
    expect(asamaSirasi("22/d")).toContain("piyasa");
    expect(asamaSirasi("22/b")).not.toContain("piyasa");
  });
});

describe("evrak listesi", () => {
  it("22/d için sistemden gelen piyasa evrakı içerir", () => {
    const l = evrakListesi(alim("DT-2026-040"));
    expect(l.filter((e) => e.sistemden).map((e) => e.kod)).toEqual(["ekap-kaydi", "piyasa-tutanagi", "yasaklilik"]);
    expect(l.some((e) => e.kod === "kik-bildirimi")).toBe(true);
  });

  it("22/b için dayanak belgesi ve KİK bildirimi ister", () => {
    const kodlar = evrakListesi(alim("DT-2026-035")).map((e) => e.kod);
    expect(kodlar).toContain("dayanak-belgesi");
    expect(kodlar).toContain("kik-bildirimi");
    expect(kodlar).not.toContain("piyasa-tutanagi");
  });

  it("piyasa evrakını araştırmanın tamamlanmasından çıkarır", () => {
    const a = alim("DT-2026-041");
    const p = structuredClone(ornekPiyasa[0]);
    expect(evrakDurumlari(a, {}, p).find((e) => e.kod === "piyasa-tutanagi")!.tamam).toBe(false);
    p.tamamlandi = true;
    expect(evrakDurumlari(a, {}, p).find((e) => e.kod === "piyasa-tutanagi")!.tamam).toBe(true);
  });
});

describe("aşama ilerlemesi", () => {
  it("eksik evrak varken ilerletmez", () => {
    const a = alim("DT-2026-039", { asama: "siparis" });
    const d = asamaIlerlemesi(a, evrakDurumlari(a, { "ihtiyac-yazisi": tamam(), "onay-belgesi": tamam() }, null));
    expect(d.sonraki).toBe("muayene");
    expect(d.eksikler).toContain("Sipariş yazısı veya sözleşme");
    expect(d.eksikler).toContain("Piyasa fiyat araştırması tutanağı ve teklifler");
  });

  it("evraklar tamamsa sonraki aşamayı verir", () => {
    const a = alim("DT-2026-035", { ekapKayitNo: "2026/123456" });
    const kayit = Object.fromEntries(evrakListesi(a).map((e) => [e.kod, tamam()]));
    expect(asamaIlerlemesi(a, evrakDurumlari(a, kayit, null))).toEqual({ sonraki: "tamamlandi", eksikler: [], ekran: null });
  });

  it("22/d onay aşamasında piyasa ekranına yönlendirir", () => {
    const a = alim("DT-2026-042", { asama: "onay" });
    expect(asamaIlerlemesi(a, evrakDurumlari(a, {}, null)).ekran).toBe("piyasa");
  });

  it("muayene aşamasında tutanak ekranına yönlendirir", () => {
    const a = alim("DT-2026-040");
    expect(asamaIlerlemesi(a, evrakDurumlari(a, {}, null))).toMatchObject({ sonraki: "odeme", ekran: "muayene" });
  });

  it("ödeme evrakı eksikse ödeme ekranına yönlendirir", () => {
    const a = alim("DT-2026-038");
    expect(asamaIlerlemesi(a, evrakDurumlari(a, {}, null)).ekran).toBe("odeme");
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

  it("EKAP kaydı yoksa onaydan siparişe geçirmez", () => {
    const a = alim("DT-2026-035", { asama: "onay" });
    const kayit = Object.fromEntries(evrakListesi(a).map((e) => [e.kod, tamam()]));
    expect(asamaIlerlemesi(a, evrakDurumlari(a, kayit, null)).eksikler).toEqual(["EKAP doğrudan temin kaydı"]);
  });

  it("sözleşme zorunlu dosyada evrak adı sözleşmedir", () => {
    const ad = (a: Alim) => evrakListesi(a).find((e) => e.kod === "siparis-yazisi")!.ad;
    expect(ad(alim("DT-2026-039"))).toBe("Sipariş yazısı veya sözleşme");
    expect(ad(alim("DT-2026-039", { sureliIs: true }))).toBe("Sözleşme");
    expect(ad(alim("DT-2026-038"))).toBe("Sözleşme");
  });
});
