import { expect, test, type Page } from "@playwright/test";
import {
  SABIT_ZAMAN,
  basamagaGit,
  degisikliktenSonraKaydiBekle,
  engelYok,
  kacir,
  konsolHatalariniTopla,
  menudenGit,
  rayBagi,
  sayiyaCevir,
  tlKurus,
  tutarMetni,
} from "./yardimcilar";

// Uygulamanın tarayıcı sürümü (bellekDepo, örnek veri) üzerinde yeni bir 22/d alımını baştan sona yürütür.
// Her sayfa yüklemesi örnek veriyi sıfırdan kurar; bu yüzden dosya içindeki geçişlerin hepsi menü ve ray bağlantılarıyla yapılır.

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(SABIT_ZAMAN);
});

const KALEM_1 = { ad: "Çelik dolap, 4 çekmeceli", ozellik: "Boyalı sac, kilitli", miktar: 5, birim: "adet" };
const KALEM_2 = { ad: "Masa lambası (LED)", miktar: 10, birim: "adet" };
const KALEMLER = [KALEM_1, KALEM_2];

// Birim fiyatlar TL; sırayla [kalem 1, kalem 2]. "yaklasik" 3. basamakta, "teklif" 6. basamakta girilir.
const FIRMALAR = [
  { id: "toros", ad: "Toros AŞ", yaklasik: [1200, 150], teklif: [1180, 150], teklifTarihi: "2026-10-05" },
  { id: "ece", ad: "Ece Ltd. Şti.", yaklasik: [1100, 160], teklif: [1090, 150], teklifTarihi: "2026-10-06" },
  { id: "anka", ad: "Anka Kırtasiye", yaklasik: [1250, 140], teklif: [1250, 140], teklifTarihi: "2026-10-07" },
];

function fiyatMetni(tl: number): string {
  return tl.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function teklifToplami(f: (typeof FIRMALAR)[number]): number {
  // kuruş
  return f.teklif.reduce((s, fiyat, i) => s + Math.round(KALEMLER[i].miktar * fiyat * 100), 0);
}

const KAZANAN = FIRMALAR.reduce((en, f) => (teklifToplami(f) < teklifToplami(en) ? f : en));
const SIPARIS_TUTARI = teklifToplami(KAZANAN);
const KDV = Math.round((SIPARIS_TUTARI * 20) / 100);

const TARIH = {
  ihtiyac: "2026-10-01",
  fiyatIsteme: "2026-10-02",
  fiyatSon: "2026-10-05",
  onay: "2026-10-03",
  teklifYazisi: "2026-10-04",
  sonTeklif: "2026-10-08",
  tutanak: "2026-10-09",
  yasaklilik: "2026-10-09",
  siparis: "2026-10-10",
  teslim: "2026-10-11",
  talep: "2026-10-12",
  fatura: "2026-10-12",
  muayene: "2026-10-13",
  tif: "2026-10-14",
  borcSorgusu: "2026-10-14",
  odemeEmri: "2026-10-15",
  kik: "2026-10-16",
};

// Mali yıl kartındaki "22/d harcaması" değeri (TL, tam sayı) ve alım adedi
async function yillikKart(page: Page): Promise<{ tutar: number; adet: number }> {
  const kartlar = page.getByRole("region", { name: "Yıl özeti" });
  await expect(kartlar).toBeVisible();
  const etiket = kartlar.getByText("22/d harcaması", { exact: true });
  const deger = etiket.locator("xpath=following-sibling::span[1]");
  const not = etiket.locator("xpath=following-sibling::span[2]");
  return { tutar: sayiyaCevir(await deger.textContent()), adet: Number(/^(\d+) alım/.exec((await not.textContent()) ?? "")?.[1]) };
}

test("yeni alım baştan sona", async ({ page }) => {
  const hatalar = konsolHatalariniTopla(page);

  // ---- Başlangıç: yıllık toplam (yeni dosya eklenince karşılaştırılır) ----
  await page.goto("/#/raporlar");
  const once = await yillikKart(page);

  // ---- Sihirbaz, 1. adım: ihtiyaç ----
  await menudenGit(page, "Yeni alım");
  await expect(page).toHaveURL(/#\/yeni$/);
  const dosyaNo = /^(DT-\d{4}-\d{3}) · Taslak$/.exec((await page.getByText(/^DT-\d{4}-\d{3} · Taslak$/).textContent()) ?? "")?.[1];
  expect(dosyaNo, "sihirbaz dosya numarasını göstermeli").toBeTruthy();
  const no = dosyaNo as string;

  const konu = "Ofis dolabı ve masa lambası alımı";
  await page.getByLabel("Alımın konusu", { exact: true }).fill(konu);
  await page.getByLabel("İşin niteliği, türü ve miktarı", { exact: true }).fill("5 adet çelik dolap ile 10 adet LED masa lambası");
  await page.getByLabel("Tahmini tutar, KDV hariç", { exact: true }).fill("30.000,00");
  await page.getByLabel("Bütçe tertibi", { exact: true }).selectOption("03.2.1.01");
  await page.getByLabel("Kalem kodu", { exact: true }).fill("TST");
  await page.getByLabel("İhtiyacı bildiren birim", { exact: true }).fill("İdari İşler Şube Müdürlüğü");

  // İlk kalem Excel'den sekmeli yapıştırılır (başlık satırıyla)
  await page.getByRole("button", { name: "Excel'den aktar…" }).click();
  await page.getByLabel("Yapıştırma alanı", { exact: true }).fill(
    `Malzeme veya hizmet\tTeknik özellik\tMiktar\tBirim\n${KALEM_1.ad}\t${KALEM_1.ozellik}\t${KALEM_1.miktar}\t${KALEM_1.birim}`,
  );
  await expect(page.getByText(/1 kalem bulundu/)).toBeVisible();
  await page.getByRole("button", { name: "Listeye ekle (1 kalem)" }).click();
  await expect(page.getByText("1 kalem eklendi.")).toBeVisible();
  await expect(page.getByLabel("1. kalemin adı", { exact: true })).toHaveValue(KALEM_1.ad);
  await expect(page.getByLabel("1. kalemin miktarı", { exact: true })).toHaveValue(String(KALEM_1.miktar));

  // İkinci kalem "Kalem ekle" ile elle girilir
  await page.getByRole("button", { name: "Kalem ekle", exact: true }).click();
  await page.getByLabel("2. kalemin adı", { exact: true }).fill(KALEM_2.ad);
  await page.getByLabel("2. kalemin miktarı", { exact: true }).fill(String(KALEM_2.miktar));
  await expect(page.getByLabel("2. kalemin birimi", { exact: true })).toHaveValue(KALEM_2.birim);

  await page.getByRole("button", { name: "Dayanağa geç" }).click();

  // ---- Sihirbaz, 2. adım: 22/d kontrolleri ----
  await expect(page.getByRole("heading", { name: "22/d kontrolleri" })).toBeVisible();
  await engelYok(page);
  await page.getByRole("button", { name: "Dosyayı aç, ihtiyaç onayına geç" }).click();

  // Dosya oluşur ve çalışma alanına gidilir (süren basamak: 2)
  await expect(page).toHaveURL(new RegExp(`#/dosyalar/${no}/basamak/2$`));
  await expect(page.getByRole("heading", { level: 1, name: konu })).toBeVisible();

  // ---- 1. basamak: veri girişi ----
  await basamagaGit(page, 1);
  await expect(page.getByLabel("1. kalemin adı", { exact: true })).toHaveValue(KALEM_1.ad);
  await expect(page.getByLabel("2. kalemin adı", { exact: true })).toHaveValue(KALEM_2.ad);
  await expect(page.getByLabel("İhtiyacı bildiren birim", { exact: true })).toHaveValue("İdari İşler Şube Müdürlüğü");
  await page.getByLabel("Teslim yeri", { exact: true }).fill("Okul deposu");
  await page.getByLabel("Kullanılabilir ödenek (₺)", { exact: true }).fill("100.000,00");
  await page.getByRole("button", { name: "Boşları örnekle doldur" }).click();
  await expect(page.getByText("Şartlar yazıldı")).toBeVisible();
  await engelYok(page);

  // ---- 2. basamak: ihtiyaç onayı ----
  await basamagaGit(page, 2);
  await page.getByLabel("Belge tarihi", { exact: true }).fill(TARIH.ihtiyac);
  await page.getByLabel("Sayı", { exact: true }).fill("E-1001-01");
  await page.getByLabel("İhtiyacın gerekçesi", { exact: true }).fill("Birimin arşiv ve aydınlatma ihtiyacının karşılanması gerekmektedir.");
  await page.getByRole("checkbox", { name: /İmzalandı, dosyaya kondu/ }).check();
  await engelYok(page);
  await degisikliktenSonraKaydiBekle(page);

  // (d) Girilen tarih başka sayfaya geçip dönünce korunur: dosya çalışma alanı kapanıp depodan yeniden yüklenir.
  await menudenGit(page, "Alım dosyaları");
  await page.getByRole("link", { name: no, exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Dosya basamakları" })).toBeVisible();
  await basamagaGit(page, 2);
  await expect(page.getByLabel("Belge tarihi", { exact: true })).toHaveValue(TARIH.ihtiyac);
  await expect(page.getByLabel("Sayı", { exact: true })).toHaveValue("E-1001-01");
  await expect(page.getByRole("checkbox", { name: /İmzalandı, dosyaya kondu/ })).toBeChecked();

  // ---- 3. basamak: fiyat isteme yazısı ve firma teklifleri ----
  await basamagaGit(page, 3);
  await page.getByLabel("Yazı tarihi", { exact: true }).fill(TARIH.fiyatIsteme);
  await page.getByLabel("Sayı", { exact: true }).fill("E-1002-01");
  await page.getByLabel("Son bildirim tarihi", { exact: true }).fill(TARIH.fiyatSon);
  for (const f of FIRMALAR) {
    await page.getByLabel("Eklenecek firma", { exact: true }).selectOption(f.id);
    await page.getByRole("button", { name: "Firma ekle" }).click();
    await expect(page.getByText(new RegExp(`^[A-C]\\. ${kacir(f.ad)}$`))).toBeVisible();
  }
  for (const kutu of await page.getByRole("checkbox", { name: "Kaşeli fiyat belgesi geldi" }).all()) await kutu.check();
  for (const f of FIRMALAR) {
    for (const [i, k] of KALEMLER.entries()) {
      await page.getByLabel(`${k.ad}, ${f.ad} birim fiyatı`, { exact: true }).fill(fiyatMetni(f.yaklasik[i]));
    }
  }
  await expect(page.getByText("3 / 3 firma fiyat verdi")).toBeVisible();
  // 3. basamak kontrol satırı göstermez
  await engelYok(page, { kontrolSatiriBeklenir: false });

  // ---- 4. basamak: yaklaşık maliyet ----
  await basamagaGit(page, 4);
  await expect(page.getByRole("columnheader", { name: /Satın Alınacak Malın Cinsi/ })).toBeVisible();
  await expect(page.getByRole("cell", { name: KALEM_1.ad, exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: KALEM_2.ad, exact: true })).toBeVisible();
  await engelYok(page);
  await page.getByRole("button", { name: /Yaklaşık maliyeti onayla ve tamamla/ }).click();
  await expect(page.getByText("Cetvel onaylandı")).toBeVisible();

  // ---- 5. basamak: onay belgesi ----
  await basamagaGit(page, 5);
  await page.getByLabel("Belge tarihi", { exact: true }).fill(TARIH.onay);
  await page.getByLabel("Onay belgesi sayısı", { exact: true }).fill("E-1003-01");
  await page.getByLabel("EKAP doğrudan temin kayıt no", { exact: true }).fill("26DT100001");
  await engelYok(page);
  await page.getByRole("button", { name: /Onay belgesini onayla ve sonraki basamağa geç/ }).click();
  await expect(page).toHaveURL(new RegExp(`#/dosyalar/${no}/basamak/6$`));

  // ---- 6. basamak: teklif mektupları ----
  // (a) Sihirbazda girilen kalem adları teklif cetvelinde
  for (const k of KALEMLER) {
    await expect(page.getByRole("row").filter({ hasText: k.ad }).filter({ has: page.getByPlaceholder("0,00") })).toBeVisible();
  }
  await page.getByLabel("Teklif isteme yazısı sayısı", { exact: true }).fill("E-1004-01");
  await page.getByLabel("Yazı tarihi", { exact: true }).fill(TARIH.teklifYazisi);
  await page.getByLabel("Son teklif tarihi", { exact: true }).fill(TARIH.sonTeklif);
  for (const f of FIRMALAR) {
    await page.getByRole("button", { name: new RegExp(`^${kacir(f.ad)}`) }).click();
    await page.getByRole("checkbox", { name: /kaşeli ve imzalı teklif mektubu idaremize ulaştı/ }).setChecked(true);
    await page.getByLabel(`${f.ad} teklif tarihi`, { exact: true }).fill(f.teklifTarihi);
    for (const [i, k] of KALEMLER.entries()) {
      await page
        .getByRole("row")
        .filter({ hasText: k.ad })
        .filter({ has: page.getByPlaceholder("0,00") })
        .getByPlaceholder("0,00")
        .fill(fiyatMetni(f.teklif[i]));
    }
    await expect(page.getByText(`Toplam: ${tutarMetni(teklifToplami(f))} TL + KDV`)).toBeVisible();
  }
  await engelYok(page);
  await page.getByRole("button", { name: /Teklifleri Onayla ve Sonraki Adıma Geç/ }).click();
  await expect(page).toHaveURL(new RegExp(`#/dosyalar/${no}/basamak/7$`));

  // ---- 7. basamak: piyasa fiyat araştırma tutanağı ----
  // (b) En düşük toplamı veren firma tutanakta kazanan olarak çıkar
  await expect(page.getByText("Tespit Edilen En Uygun Teklif:").locator("xpath=following-sibling::div[1]")).toHaveText(KAZANAN.ad);
  await expect(page.getByText(`${tutarMetni(SIPARIS_TUTARI)} TL`, { exact: true }).first()).toBeVisible();
  await page.getByLabel("Tutanak tarihi", { exact: true }).fill(TARIH.tutanak);
  await page.getByLabel(`${KAZANAN.ad} · sorgu tarihi (yasaklı değil)`, { exact: true }).fill(TARIH.yasaklilik);
  await expect(page.getByText("Seçilen firmaların sorgusu yapıldı.")).toBeVisible();
  await engelYok(page);
  await page.getByRole("button", { name: /Tutanağı Onayla ve Sonraki Adıma Geç/ }).click();
  await expect(page).toHaveURL(new RegExp(`#/dosyalar/${no}/basamak/8$`));

  // ---- 8. basamak: sipariş yazısı ----
  await expect(page.getByText("Yüklenici Firma", { exact: true }).locator("xpath=following-sibling::div[1]")).toHaveText(KAZANAN.ad);
  await expect(page.getByText(`${tutarMetni(SIPARIS_TUTARI)} TL`, { exact: true }).first()).toBeVisible();
  // Belge şablonu alıcı firma adını büyük harfle yazar
  const mektup = page.getByRole("region", { name: "A4 görünüşü" });
  await expect(mektup).toContainText(KAZANAN.ad.toLocaleUpperCase("tr-TR"));
  await expect(mektup).toContainText(`${tutarMetni(SIPARIS_TUTARI)} TL`);
  await page.getByLabel("Sipariş Yazısı Sayısı", { exact: true }).fill("E-1005-01");
  await page.getByLabel("Yazı Tarihi", { exact: true }).fill(TARIH.siparis);
  await engelYok(page);
  await page.getByRole("button", { name: /Siparişi Onayla ve Sonraki Adıma Geç/ }).click();
  await expect(page).toHaveURL(new RegExp(`#/dosyalar/${no}/basamak/9$`));

  // ---- 9. basamak: muayene talep yazısı ----
  await page.getByLabel("Talep Yazısı Sayısı", { exact: true }).fill("E-1006-01");
  await page.getByLabel("Yazı Tarihi", { exact: true }).fill(TARIH.talep);
  await engelYok(page);
  await page.getByRole("button", { name: /Talep Yazısını Onayla ve Sonraki Adıma Geç/ }).click();
  await expect(page).toHaveURL(new RegExp(`#/dosyalar/${no}/basamak/10$`));

  // ---- 10. basamak: muayene raporu, komisyon ve kabul ----
  await page.getByLabel("Yüklenici Fatura No", { exact: true }).fill("FTR-2026-0001");
  await page.getByLabel("Fatura Tarihi", { exact: true }).fill(TARIH.fatura);
  await page.getByLabel("Teslim tarihi", { exact: true }).fill(TARIH.teslim);
  await page.getByLabel("Muayene tarihi", { exact: true }).fill(TARIH.muayene);
  await page.getByLabel("Muayene yeri", { exact: true }).fill("Okul deposu");
  // Örnek görevlendirmedeki üçüncü üye piyasa görevlisidir (görev çakışması); piyasada görevi olmayan öğretmenle değiştirilir.
  await page.getByLabel("3. üyenin adı", { exact: true }).fill("Emine Şahin");
  await page.getByLabel("3. üyenin unvanı", { exact: true }).fill("Öğretmen");
  await expect(page.getByText("Muayene komisyonu uygun")).toBeVisible();
  await expect(page.getByText("Tamamı kabul")).toBeVisible();
  await engelYok(page);
  await page.getByRole("button", { name: /Kabul Tutanağını Onayla ve Sonraki Adıma Geç/ }).click();
  await expect(page).toHaveURL(new RegExp(`#/dosyalar/${no}/basamak/12$`));

  // ---- 11. basamak: muayene ve kabul belgesi (10. basamakla aynı kayıt) ----
  await basamagaGit(page, 11);
  await expect(page.getByLabel("Yüklenici Fatura No", { exact: true })).toHaveValue("FTR-2026-0001");
  await expect(page.getByLabel("Muayene tarihi", { exact: true })).toHaveValue(TARIH.muayene);
  await expect(rayBagi(page, 11)).toContainText("Tamamlandı");
  await engelYok(page);

  // ---- 12. basamak: taşınır işlem fişi ----
  await basamagaGit(page, 12);
  await page.getByLabel("Taşınır İşlem Fişi (TİF) No", { exact: true }).fill("2026/901");
  await page.getByLabel("TİF Düzenleme Tarihi", { exact: true }).fill(TARIH.tif);
  await engelYok(page);
  await page.getByRole("button", { name: /Taşınır Fişini Onayla ve Sonraki Adıma Geç/ }).click();
  await expect(page).toHaveURL(new RegExp(`#/dosyalar/${no}/basamak/13$`));

  // ---- 13. basamak: ödeme emri belgesi ve kapanış ----
  await page.getByLabel("Ödeme emri belgesi no", { exact: true }).fill("2026/0901");
  await page.getByLabel("Ödeme emri tarihi", { exact: true }).fill(TARIH.odemeEmri);
  for (const ad of ["Vergi borcu", "SGK borcu"]) {
    await page.getByLabel(ad, { exact: true }).selectOption({ label: "Borcu yok" });
    await page.getByLabel(`${ad} sorgu tarihi`, { exact: true }).fill(TARIH.borcSorgusu);
    await page.getByLabel(`${ad} sorgu belge numarası`, { exact: true }).fill("BS-1");
  }
  await page.getByLabel("KİK bildirim tarihi (EKAP)", { exact: true }).fill(TARIH.kik);
  await expect(page.getByText("Evrak listesi tam")).toBeVisible();
  await engelYok(page);

  // (c) Ödeme matrahı sipariş toplamıdır; KDV dahil brüt tutar KDV hariç tutara oranla tutarlı
  const bedel = page.getByRole("row", { name: /Mal \/ hizmet bedeli \(KDV hariç\)/ });
  await expect(bedel).toContainText(tlKurus(SIPARIS_TUTARI));
  await expect(page.getByRole("row", { name: /Katma değer vergisi \(%20\)/ })).toContainText(tlKurus(KDV));
  await expect(page.getByRole("button", { name: "Brüt tutar, KDV dahil değerini kopyala" }).locator("xpath=..")).toContainText(tutarMetni(SIPARIS_TUTARI + KDV));

  await page.getByRole("button", { name: "Ödemeyi kaydet ve dosyayı kapat" }).click();

  // ---- Kapanış: dosya özeti ----
  await expect(page).toHaveURL(new RegExp(`#/dosyalar/${no}/ozet$`));
  await expect(page.getByRole("heading", { level: 1, name: konu })).toBeVisible();
  await expect(page.locator("header").getByText("Tamamlandı", { exact: true })).toBeVisible();
  await expect(page.getByText("11 / 11 tamam")).toBeVisible();

  // ---- Dosya listesinde ----
  await menudenGit(page, "Alım dosyaları");
  const satir = page.getByRole("row").filter({ hasText: no });
  await expect(satir).toContainText("Tamamlandı");
  await expect(satir).toContainText(konu);
  await expect(satir).toContainText(KAZANAN.ad);
  await expect(satir).toContainText("₺" + Math.round(SIPARIS_TUTARI / 100).toLocaleString("tr-TR"));

  // ---- Yıllık toplam: raporlar sayfasında bir alım ve sipariş tutarı kadar artış ----
  await menudenGit(page, "Raporlar");
  const sonra = await yillikKart(page);
  expect(sonra.adet).toBe(once.adet + 1);
  expect(sonra.tutar - once.tutar).toBe(Math.round(SIPARIS_TUTARI / 100));
  await expect(page.getByRole("row").filter({ hasText: no })).toHaveCount(2); // yıllık liste ve KİK bildirimi tablosu
  await expect(page.getByRole("row").filter({ hasText: no }).last()).toContainText("Tamamlandı");

  expect(hatalar).toEqual([]);
});

test("22/d limitini aşan teklif tutanağı durdurur", async ({ page }) => {
  const hatalar = konsolHatalariniTopla(page);

  // Örnek dosya DT-2026-041 (büyükşehir; limit 1.021.827 TL). Üç firmanın üç kalemi de pahalı girilir, en düşük toplam yine limiti aşar.
  await page.goto("/#/dosyalar/DT-2026-041/basamak/6");
  await expect(page.getByRole("heading", { name: /6\. Teklif Mektupları/ })).toBeVisible();
  const FIYATLAR = [
    { ad: "Toros AŞ", tl: 5000 },
    { ad: "Ece Ltd. Şti.", tl: 5100 },
    { ad: "Kaya Ticaret", tl: 5200 },
  ];
  for (const f of FIYATLAR) {
    await page.getByRole("button", { name: new RegExp(`^${kacir(f.ad)}`) }).click();
    await page.getByRole("checkbox", { name: /kaşeli ve imzalı teklif mektubu idaremize ulaştı/ }).setChecked(true);
    const kutular = page.getByPlaceholder("0,00");
    for (let i = 0; i < 3; i++) await kutular.nth(i).fill(fiyatMetni(f.tl));
  }

  // 7. basamağa istemci yönlendirmesiyle geçilir (sayfa yenilenirse örnek veri sıfırlanır)
  await basamagaGit(page, 7);
  await expect(page.getByText("Tespit Edilen En Uygun Teklif:").locator("xpath=following-sibling::div[1]")).toHaveText("Toros AŞ");
  const limitSatiri = page.locator(".kontrol.kontrol-engel").filter({ hasText: "22/d limiti aşılıyor" });
  await expect(limitSatiri).toBeVisible();
  await expect(page.getByRole("button", { name: /Tutanağı Onayla ve Sonraki Adıma Geç/ })).toBeDisabled();

  expect(hatalar).toEqual([]);
});

test("sayfalar konsol hatası vermeden açılır", async ({ page }) => {
  const hatalar = konsolHatalariniTopla(page);

  await page.goto("/#/");
  await expect(page.getByRole("heading", { level: 1, name: "Ana panel" })).toBeVisible();

  const sayfalar: [string, RegExp][] = [
    ["Yeni alım", /#\/yeni$/],
    ["Alım dosyaları", /#\/dosyalar$/],
    ["Tedarikçiler", /#\/tedarikciler$/],
    ["Raporlar", /#\/raporlar$/],
    ["Personel ve görevler", /#\/personel$/],
    ["Parametreler", /#\/parametreler$/],
    ["Ana panel", /#\/$/],
  ];
  for (const [ad, yol] of sayfalar) {
    await menudenGit(page, ad);
    await expect(page).toHaveURL(yol);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  }

  // Örnek dosya DT-2026-041'in 13 basamağı
  await menudenGit(page, "Alım dosyaları");
  await page.getByRole("link", { name: "DT-2026-041", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Dosya basamakları" })).toBeVisible();
  for (let no = 1; no <= 13; no++) {
    await basamagaGit(page, no);
    await expect(page).toHaveURL(new RegExp(`#/dosyalar/DT-2026-041/basamak/${no}$`));
    await expect(page.getByRole("heading", { level: 1, name: "Temizlik malzemesi" })).toBeVisible();
    await expect(page.locator(".calisma-icerik .panel").first()).toBeVisible();
  }
  await page.getByRole("link", { name: "Dosya özeti ve denetim izi" }).click();
  await expect(page).toHaveURL(/#\/dosyalar\/DT-2026-041\/ozet$/);
  await expect(page.getByRole("heading", { name: "Evrak kontrol listesi" })).toBeVisible();
  await page.waitForLoadState("networkidle");

  expect(hatalar).toEqual([]);
});
