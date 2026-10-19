import { expect, type Locator, type Page } from "@playwright/test";

// Uygulamadaki bugun() bu ana sabitlenir: dosya numarası, limit dönemi ve yıllık toplamlar koşunun yapıldığı güne bağlı kalmasın.
export const SABIT_ZAMAN = new Date("2026-10-20T10:00:00+03:00");

// Konsolda hata düzeyinde ya da sayfada yakalanmamış her ileti listeye düşer.
export function konsolHatalariniTopla(page: Page): string[] {
  const hatalar: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") hatalar.push(`console.error: ${m.text()}`);
  });
  page.on("pageerror", (e) => hatalar.push(`pageerror: ${e.message}`));
  return hatalar;
}

function kacir(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function anaMenu(page: Page): Locator {
  return page.getByRole("navigation", { name: "Ana menü" });
}

// Menü bağlantısı istemci yönlendirmesidir; sayfa yeniden yüklenmez, bellekteki veri korunur.
export async function menudenGit(page: Page, ad: string): Promise<void> {
  await anaMenu(page).getByRole("link", { name: ad, exact: true }).click();
}

// Basamak rayındaki bağlantıyla geçiş (istemci yönlendirmesi).
export async function basamagaGit(page: Page, no: number): Promise<void> {
  const bag = page.getByRole("navigation", { name: "Dosya basamakları" }).getByRole("link", { name: new RegExp(`^${no}\\. `) });
  await bag.click();
  await expect(bag).toHaveAttribute("aria-current", "step");
}

export function rayBagi(page: Page, no: number): Locator {
  return page.getByRole("navigation", { name: "Dosya basamakları" }).getByRole("link", { name: new RegExp(`^${no}\\. `) });
}

// KontrolSatiri (src/ui/KontrolSatiri.tsx) kökü `kontrol kontrol-<durum>` sınıflarını taşır ve erişilebilir ad vermez; bu yüzden sınıfla seçilir.
export const KONTROL_DURUMLARI = ["tamam", "uyari", "engel", "yapilacak"] as const;
const KONTROL_SATIRI = KONTROL_DURUMLARI.map((d) => `.kontrol.kontrol-${d}`).join(", ");

// "Engel" düzeyindeki kontrol satırı (kırmızı) kalmamış olmalı.
// Sayımdan önce sayfada en az bir kontrol satırının görünür olduğu doğrulanır; böylece sınıf adı değişirse ya da
// kontroller henüz çizilmediyse sayım boşuna 0 çıkıp geçmez. Kontrol satırı hiç göstermeyen basamaklarda
// (yalnız 3. basamak, fiyat isteme) `kontrolSatiriBeklenir: false` verilir.
export async function engelYok(page: Page, { kontrolSatiriBeklenir = true }: { kontrolSatiriBeklenir?: boolean } = {}): Promise<void> {
  if (kontrolSatiriBeklenir) await expect(page.locator(KONTROL_SATIRI).first()).toBeVisible();
  await expect(page.locator(".kontrol.kontrol-engel")).toHaveCount(0);
}

// Çalışma alanının 500 ms'lik otomatik kaydı: önce "Değişiklik var" görünür, sonra "Kaydedildi".
export async function kaydiBekle(page: Page): Promise<void> {
  await expect(page.getByText("Kaydedildi", { exact: true })).toBeVisible();
}

export async function degisikliktenSonraKaydiBekle(page: Page): Promise<void> {
  await expect(page.getByText(/^(Değişiklik var|Kaydediliyor…)$/)).toBeVisible();
  await kaydiBekle(page);
}

// Kuruşu uygulamanın gösterdiği "1.234,56" biçimine çevirir (TL işaretsiz).
export function tutarMetni(kurus: number): string {
  return (kurus / 100).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function tlKurus(kurus: number): string {
  return "₺" + tutarMetni(kurus);
}

export function sayiyaCevir(metin: string | null): number {
  return Number((metin ?? "").replace(/\D/g, ""));
}

export { kacir };
