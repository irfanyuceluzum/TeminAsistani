import { describe, expect, it } from "vitest";
import { basamaklar, tarihSirasiKontrolleri } from "../domain/basamaklar";
import { kapanisEksikleri } from "../domain/dosya";
import { dosyaKomisyonuKontrolleri, muayeneOzeti } from "../domain/muayene";
import { degerlendir, teklifTarihiKontrolleri } from "../domain/piyasa";
import { kikBildirimleri, yillikOzet } from "../domain/raporlar";
import { bellekDepo } from "./depo";
import { ornekAlimlar, ornekAyarlar, ornekBasamaklar, ornekEvraklar, ornekMuayeneler, ornekOdemeler, ornekPiyasa } from "./ornekVeri";

const ID = "DT-2026-037";
const alim = ornekAlimlar.find((a) => a.id === ID)!;
const piyasa = ornekPiyasa.find((p) => p.alimId === ID)!;
const dosya = ornekBasamaklar.find((d) => d.alimId === ID)!;
const muayene = ornekMuayeneler.find((m) => m.alimId === ID)!;
const odeme = ornekOdemeler.find((o) => o.alimId === ID)!;
const evraklar = ornekEvraklar[ID];
const girdi = { alim, piyasa, dosya, evraklar, muayene, odeme };

describe("tamamlanmış örnek dosya DT-2026-037", () => {
  it("13 basamağın hepsi tamam ya da gerekmiyor", () => {
    const liste = basamaklar(girdi);
    expect(liste).toHaveLength(13);
    expect(liste.filter((b) => b.durum !== "tamam" && b.durum !== "gerekmiyor")).toEqual([]);
    expect(liste.every((b) => b.durum === "tamam")).toBe(true);
  });

  it("kapanış eksiği, tarih sırası ve teklif tarihi sorunu yok", () => {
    expect(kapanisEksikleri(alim, evraklar, piyasa)).toEqual([]);
    expect(tarihSirasiKontrolleri(girdi)).toEqual([]);
    expect(teklifTarihiKontrolleri(piyasa).filter((k) => k.durum === "uyari" || k.durum === "yapilacak")).toEqual([]);
  });

  it("alım tutarı kazanan teklife ve muayenede kabul edilen toplama eşit", () => {
    expect(degerlendir(piyasa)).toMatchObject({ toplam: alim.tutar, kazananlar: ["anka"] });
    expect(muayeneOzeti(muayene)).toMatchObject({ kabulToplami: alim.tutar, faturaToplami: alim.tutar, kismi: false });
  });

  it("muayene komisyonu uygun: başkan, tek sayıda üye, görev çakışması yok", () => {
    const k = dosyaKomisyonuKontrolleri(muayene.uyeler, ornekAyarlar.personel!, ornekAyarlar.gorevler!);
    expect(k.map((x) => x.durum)).toEqual(["tamam"]);
  });

  it("yıllık KİK listesinde yer alır ve bildirildi sayılır", () => {
    const satir = kikBildirimleri(ornekAlimlar, 2026, ornekEvraklar, "2026-10-19").find((x) => x.alim.id === ID)!;
    expect(satir).toMatchObject({ bildirildi: true, tarih: "2026-10-05", sonGun: "2026-10-10", gecikti: false });
    expect(yillikOzet(ornekAlimlar, 2026, ornekAyarlar, ornekPiyasa).ddAdet).toBeGreaterThan(0);
  });

  it("bellekDepo muayene ve ödeme kaydını döndürür", async () => {
    const depo = bellekDepo();
    expect((await depo.muayeneGetir(ID))?.tamamlandi).toBe(true);
    expect((await depo.odemeGetir(ID))?.oebNo).toBe(odeme.oebNo);
    expect((await depo.alimlar()).find((a) => a.id === ID)?.ekapKayitNo).toBeTruthy();
  });
});
