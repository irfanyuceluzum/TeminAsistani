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
    expect(l.filter((e) => e.sistemden).map((e) => e.kod)).toEqual(["piyasa-tutanagi", "yasaklilik"]);
    expect(l.some((e) => e.kod === "kik-bildirimi")).toBe(false);
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
    const a = alim("DT-2026-035");
    const kayit = Object.fromEntries(evrakListesi(a).map((e) => [e.kod, tamam()]));
    expect(asamaIlerlemesi(a, evrakDurumlari(a, kayit, null))).toEqual({ sonraki: "tamamlandi", eksikler: [], piyasaEkrani: false, muayeneEkrani: false });
  });

  it("22/d onay aşamasında piyasa ekranına yönlendirir", () => {
    const a = alim("DT-2026-042", { asama: "onay" });
    expect(asamaIlerlemesi(a, evrakDurumlari(a, {}, null)).piyasaEkrani).toBe(true);
  });

  it("muayene aşamasında tutanak ekranına yönlendirir", () => {
    const a = alim("DT-2026-040");
    expect(asamaIlerlemesi(a, evrakDurumlari(a, {}, null))).toMatchObject({ sonraki: "odeme", muayeneEkrani: true });
  });

  it("tamamlanan dosyada ilerleme yoktur", () => {
    const a = alim("DT-2026-033");
    expect(asamaIlerlemesi(a, evrakDurumlari(a, {}, null)).sonraki).toBeNull();
  });
});
