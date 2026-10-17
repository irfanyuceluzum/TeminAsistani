import { describe, expect, it } from "vitest";
import { ornekAyarlar } from "../data/ornekVeri";
import { BOS_GOREVLER, belgeGorevlileri, gorevKontrolleri, idareSatirlari, kisininGorevleri, komisyon, personelCikar } from "./personel";
import type { GorevAtamalari } from "./tipler";

const personel = ornekAyarlar.personel!;
const gorevler = ornekAyarlar.gorevler!;

describe("görev kontrolleri", () => {
  it("örnek görevlendirmede yalnızca çakışmayı uyarır", () => {
    const k = gorevKontrolleri(personel, gorevler);
    expect(k.filter((x) => x.durum !== "tamam").map((x) => x.baslik)).toEqual(["Görev çakışması"]);
  });

  it("aynı kişiyi iki harcama görevinde uyarır, eksik atamayı yapılacak sayar", () => {
    const g: GorevAtamalari = { ...gorevler, gerceklestirme: gorevler.harcamaYetkilisi };
    expect(gorevKontrolleri(personel, g)[0]).toMatchObject({ durum: "uyari", baslik: "Aynı kişi iki görevde" });
    expect(gorevKontrolleri(personel, BOS_GOREVLER)[0].durum).toBe("yapilacak");
  });

  it("çift sayılı komisyonu ve komisyondaki harcama yetkilisini uyarır", () => {
    const g: GorevAtamalari = { ...gorevler, muayeneUyeleri: [gorevler.harcamaYetkilisi!] };
    const basliklar = gorevKontrolleri(personel, g).map((x) => x.baslik);
    expect(basliklar).toContain("2 kişilik komisyon");
    expect(basliklar).toContain("Harcama yetkilisi komisyonda");
  });
});

describe("personel işlemleri", () => {
  it("komisyonu başkan önde, tekrarsız verir", () => {
    expect(komisyon({ ...gorevler, muayeneUyeleri: [...gorevler.muayeneUyeleri, gorevler.muayeneBaskani!] })).toEqual(komisyon(gorevler));
    expect(komisyon(gorevler)[0]).toBe(gorevler.muayeneBaskani);
  });

  it("çıkarılan kişiyi tüm atamalardan düşürür", () => {
    const { personel: p, gorevler: g } = personelCikar("p3", personel, gorevler);
    expect(p.some((x) => x.id === "p3")).toBe(false);
    expect(g.piyasaGorevlileri).not.toContain("p3");
    expect(g.muayeneUyeleri).not.toContain("p3");
    expect(kisininGorevleri("p3", g)).toEqual([]);
  });

  it("belgelere görevli adlarını ve komisyonu verir", () => {
    const b = belgeGorevlileri(ornekAyarlar);
    expect(b.harcamaYetkilisi).toBe("Mehmet Arslan (Okul Müdürü)");
    expect(b.piyasaGorevlileri).toBe("Ali Yılmaz (Öğretmen), Zeynep Aksoy (Memur)");
    expect(b.komisyon.map((u) => u.rol)).toEqual(["baskan", "uye", "uye"]);
    expect(belgeGorevlileri({ ...ornekAyarlar, personel: undefined, gorevler: undefined }).harcamaYetkilisi).toBe("");
  });

  it("idare adını belge başlığına göre biçimler", () => {
    expect(idareSatirlari(ornekAyarlar)).toEqual({ ust: "KARATAŞ KAYMAKAMLIĞI", birim: "Kırmızıdağ İlkokulu Müdürlüğü" });
    expect(idareSatirlari({ ...ornekAyarlar, idare: undefined })).toEqual({ ust: "[ÜST İDARE]", birim: "[Birim]" });
  });
});
