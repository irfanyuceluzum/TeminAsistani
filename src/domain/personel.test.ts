import { describe, expect, it } from "vitest";
import { ornekAyarlar } from "../data/ornekVeri";
import { BOS_GOREVLER, belgeGorevlileri, gorevKontrolleri, idareSatirlari, kisininGorevleri, komisyon, muayeneKomisyonuKontrolleri, personelCikar } from "./personel";
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

  it("çift sayılı komisyonu uyarır ve komisyondaki yetkiliyi engellemeden uyarır", () => {
    const g: GorevAtamalari = { ...gorevler, muayeneUyeleri: [gorevler.harcamaYetkilisi!] };
    const kontroller = gorevKontrolleri(personel, g);
    const basliklar = kontroller.map((x) => x.baslik);
    expect(basliklar).toContain("2 kişilik komisyon");
    expect(kontroller.find((x) => x.baslik === "Muayene komisyonunda yetkili var: görevler ayrılığı")?.durum).toBe("uyari");
    expect(kontroller.some((x) => x.durum === "engel")).toBe(false);
  });

  it("yetkili hem piyasada hem muayene komisyonundaysa görev çakışmasını da uyarır", () => {
    const hy = gorevler.harcamaYetkilisi!;
    const g: GorevAtamalari = { ...gorevler, piyasaGorevlileri: [hy], muayeneUyeleri: [...gorevler.muayeneUyeleri.filter((x) => x !== "p3"), hy] };
    const cakisma = gorevKontrolleri(personel, g).find((x) => x.baslik === "Görev çakışması");
    expect(cakisma?.detay).toContain(personel.find((p) => p.id === hy)!.ad);
    const kom = muayeneKomisyonuKontrolleri(personel, g).find((x) => x.baslik === "Görev çakışması");
    expect(kom?.detay).toContain(personel.find((p) => p.id === hy)!.ad);
  });

  it("komisyon sayısı uyarısı yönetmelik dayanağını yazar", () => {
    const g: GorevAtamalari = { ...gorevler, muayeneUyeleri: [gorevler.muayeneUyeleri[0]] };
    expect(gorevKontrolleri(personel, g).find((x) => x.baslik.endsWith("kişilik komisyon"))?.detay).toContain("md. 6/1");
  });

  it("harcama yetkilisi ve gerçekleştirme görevlisinin piyasa ve yaklaşık maliyette yer alması engel değil uyarıdır", () => {
    const g1: GorevAtamalari = { ...gorevler, piyasaGorevlileri: [gorevler.gerceklestirme!, "p3"] };
    const k1 = gorevKontrolleri(personel, g1);
    const u1 = k1.find((x) => x.baslik === "Piyasa araştırmasında yetkili var: görevler ayrılığı");
    expect(u1?.durum).toBe("uyari");
    expect(u1?.detay).toContain("Standart 9");
    expect(k1.some((x) => x.durum === "engel")).toBe(false);

    const g2: GorevAtamalari = { ...gorevler, yaklasikMaliyetGorevlileri: [gorevler.harcamaYetkilisi!, "p3"] };
    const k2 = gorevKontrolleri(personel, g2);
    const u2 = k2.find((x) => x.baslik === "Yaklaşık maliyette yetkili var: görevler ayrılığı");
    expect(u2?.durum).toBe("uyari");
    expect(u2?.detay).toContain("Standart 9");
    expect(k2.some((x) => x.durum === "engel")).toBe(false);
  });

  it("belgeGorevlileri yetkiliyi piyasa, yaklaşık maliyet ve komisyon listelerinden çıkarmaz", () => {
    const g: GorevAtamalari = {
      ...gorevler,
      piyasaGorevlileri: ["p1", "p3"],
      yaklasikMaliyetGorevlileri: ["p2", "p3"],
      muayeneBaskani: "p1",
      muayeneUyeleri: ["p2", "p5"],
    };
    const b = belgeGorevlileri({ ...ornekAyarlar, gorevler: g });
    expect(b.piyasaGorevlileri).toContain("Mehmet Arslan");
    expect(b.yaklasikGorevlileri.map((p) => p.ad)).toContain("Ayşe Demir");
    expect(b.komisyon.map((u) => `${u.ad}:${u.rol}`)).toEqual(["Mehmet Arslan:baskan", "Ayşe Demir:uye", "Hasan Çelik:uye"]);
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

describe("muayene komisyonu kontrolleri", () => {
  it("piyasa görevlisi komisyondaysa 'uygun' demez, çakışmayı uyarır", () => {
    // Örnek atamada Ali Yılmaz (p3) hem piyasa görevlisi hem muayene üyesi
    const k = muayeneKomisyonuKontrolleri(personel, gorevler);
    expect(k.map((x) => x.baslik)).toEqual(["Görev çakışması"]);
    expect(k[0].durum).toBe("uyari");
    expect(k[0].detay).toMatch(/Ali Yılmaz/);
  });

  it("çakışma yoksa tek 'uygun' kontrolü verir", () => {
    const g: GorevAtamalari = { ...gorevler, muayeneUyeleri: ["p5", "p6"], piyasaGorevlileri: ["p3"] };
    const k = muayeneKomisyonuKontrolleri(personel, g);
    expect(k).toHaveLength(1);
    expect(k[0]).toMatchObject({ durum: "tamam", baslik: "Muayene komisyonu uygun" });
  });

  it("yetkiliyi komisyonda engellemez, görevler ayrılığı uyarısı verir", () => {
    const g: GorevAtamalari = { ...gorevler, muayeneUyeleri: [gorevler.gerceklestirme!, "p5"] };
    const k = muayeneKomisyonuKontrolleri(personel, g);
    expect(k.some((x) => x.durum === "engel")).toBe(false);
    const u = k.find((x) => x.baslik === "Muayene komisyonunda yetkili var: görevler ayrılığı");
    expect(u?.durum).toBe("uyari");
    expect(u?.detay).toContain("Standart 9");
  });
});
