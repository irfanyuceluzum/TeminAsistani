import { invoke } from "@tauri-apps/api/core";
import type { Depo } from "./depo";

export interface GocSatiri {
  version: number;
  checksum: string;
}

export type GocUyumu = { uygun: true } | { uygun: false; neden: string };

const iki = (n: number): string => String(n).padStart(2, "0");

export function otomatikYedekAdi(tarih: string): string {
  return `otomatik-${tarih}.db`;
}

export function elleYedekAdi(tarih: string): string {
  return `TeminAsistani-yedek-${tarih}.db`;
}

// Yerel saatle YYYY-AA-GG-SSDDss; sabit genişlik olduğundan ada göre sıralama kronolojiktir.
export function oncesiYedekAdi(zaman: Date): string {
  const tarih = `${zaman.getFullYear()}-${iki(zaman.getMonth() + 1)}-${iki(zaman.getDate())}`;
  const saat = `${iki(zaman.getHours())}${iki(zaman.getMinutes())}${iki(zaman.getSeconds())}`;
  return `geri-yukleme-oncesi-${tarih}-${saat}.db`;
}

// sqlx yolu yüzde-çözer ve ? ile # özel anlam taşır; yalnız bu üçü kodlanır.
export function sqliteYolu(mutlakYol: string): string {
  const kodlu = mutlakYol.replace(/[%?#]/g, (c) => (c === "%" ? "%25" : c === "?" ? "%3F" : "%23"));
  return `sqlite:${kodlu}?mode=ro`;
}

export function gocUyumu(yedek: GocSatiri[], canli: GocSatiri[]): GocUyumu {
  if (yedek.length === 0) return { uygun: false, neden: "Yedekte şema bilgisi yok; bu dosya Temin Asistanı yedeği değil." };
  const enBuyuk = (g: GocSatiri[]) => g.reduce((m, x) => Math.max(m, x.version), 0);
  if (enBuyuk(yedek) > enBuyuk(canli)) return { uygun: false, neden: "Yedek, uygulamanın daha yeni bir sürümüyle alınmış." };
  const canliSurumler = new Map(canli.map((g) => [g.version, g.checksum]));
  for (const g of [...yedek].sort((a, b) => a.version - b.version)) {
    const karsilik = canliSurumler.get(g.version);
    if (karsilik !== undefined && karsilik !== g.checksum) {
      return { uygun: false, neden: `Yedeğin şema geçmişi bu sürümle uyuşmuyor (göç ${g.version}).` };
    }
  }
  return { uygun: true };
}

// Plugin BLOB'u sayı dizisi olarak döndürür; olası diğer biçimlere de dayanıklı, hex string üretir.
function hexe(deger: unknown): string {
  if (typeof deger === "string") return deger;
  if (Array.isArray(deger)) return deger.map((b) => (Number(b) & 0xff).toString(16).padStart(2, "0")).join("");
  if (deger instanceof Uint8Array) return Array.from(deger, (b) => b.toString(16).padStart(2, "0")).join("");
  if (deger instanceof ArrayBuffer) return hexe(new Uint8Array(deger));
  return "";
}

export function gocSatirlariniCevir(satirlar: { version: number; checksum: unknown }[]): GocSatiri[] {
  return satirlar.map((s) => ({ version: Number(s.version), checksum: hexe(s.checksum) }));
}

interface YedekDizini {
  dizin: string;
  gecici: string;
  son_otomatik: string | null;
}

const YEDEK_FILTRESI = [{ name: "Temin Asistanı yedeği", extensions: ["db"] }];

export async function otomatikYedekAl(depo: Depo, bugun: string): Promise<string | null> {
  if (depo.tur !== "sqlite") return null;
  try {
    const { dizin, gecici, son_otomatik } = await invoke<YedekDizini>("yedek_dizini_hazirla");
    if (son_otomatik === bugun) return null;
    await depo.yedekAl(gecici);
    const { join } = await import("@tauri-apps/api/path");
    await invoke("yedegi_yerlestir", { gecici, hedef: await join(dizin, otomatikYedekAdi(bugun)) });
    await invoke("eski_yedekleri_sil", { onek: "otomatik-", sakla: 10 });
    return bugun;
  } catch (e) {
    console.error("Otomatik yedek alınamadı:", e);
    return null;
  }
}

export async function elleYedekAl(depo: Depo, bugun: string): Promise<string | null> {
  const { save } = await import("@tauri-apps/plugin-dialog");
  const hedef = await save({ defaultPath: elleYedekAdi(bugun), filters: YEDEK_FILTRESI });
  if (!hedef) return null;
  const { gecici } = await invoke<YedekDizini>("yedek_dizini_hazirla");
  await depo.yedekAl(gecici);
  await invoke("yedegi_yerlestir", { gecici, hedef });
  return hedef;
}

export async function yedekSec(): Promise<string | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const yol = await open({ multiple: false, directory: false, filters: YEDEK_FILTRESI });
  return typeof yol === "string" ? yol : null;
}

export async function yedegiDenetle(
  depo: Depo,
  kaynak: string,
): Promise<{ alimSayisi: number; tedarikciSayisi: number; enYeniGoc: number }> {
  await invoke("yedek_dogrula", { yol: kaynak });
  const { default: Database } = await import("@tauri-apps/plugin-sql");
  // Salt-okunur ikinci bağlantı; dosya değişmez.
  const yedekDb = await Database.load(sqliteYolu(kaynak), { autoCreate: false });
  try {
    const [butunluk] = await yedekDb.select<Record<string, string>[]>("PRAGMA integrity_check");
    if (!butunluk || Object.values(butunluk)[0] !== "ok") throw new Error("Yedek dosyası bozuk.");
    const tablolar = await yedekDb.select<{ name: string }[]>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('alimlar', 'tedarikciler', '_sqlx_migrations')",
    );
    const adlar = new Set(tablolar.map((t) => t.name));
    if (!adlar.has("alimlar") || !adlar.has("tedarikciler")) throw new Error("Bu dosya Temin Asistanı yedeği değil.");
    const yedekGocleri = adlar.has("_sqlx_migrations")
      ? gocSatirlariniCevir(await yedekDb.select<{ version: number; checksum: unknown }[]>("SELECT version, checksum FROM _sqlx_migrations ORDER BY version"))
      : [];
    const uyum = gocUyumu(yedekGocleri, await depo.gocler());
    if (!uyum.uygun) throw new Error(uyum.neden);
    const [{ adet: alimSayisi }] = await yedekDb.select<{ adet: number }[]>("SELECT COUNT(*) AS adet FROM alimlar");
    const [{ adet: tedarikciSayisi }] = await yedekDb.select<{ adet: number }[]>("SELECT COUNT(*) AS adet FROM tedarikciler");
    return { alimSayisi, tedarikciSayisi, enYeniGoc: yedekGocleri.reduce((m, g) => Math.max(m, g.version), 0) };
  } finally {
    // Windows'ta açık bağlantı dosyayı kilitler.
    await yedekDb.close().catch(() => undefined);
  }
}

export async function yedektenGeriYukle(depo: Depo, kaynak: string): Promise<void> {
  const { dizin, gecici } = await invoke<YedekDizini>("yedek_dizini_hazirla");
  const { join } = await import("@tauri-apps/api/path");
  const oncesi = await join(dizin, oncesiYedekAdi(new Date()));
  // Kapatmadan önce tutarlı anlık görüntü: geri yüklemeden vazgeçilirse/başarısız olursa dönülecek nokta.
  await depo.yedekAl(gecici);
  await invoke("yedegi_yerlestir", { gecici, hedef: oncesi });
  // Ad zaman damgalı ve sıralı olduğundan az önce alınan dosya en yenidir; budama onu silmez.
  await invoke("eski_yedekleri_sil", { onek: "geri-yukleme-oncesi-", sakla: 5 });
  await invoke("geri_yukleme_on_denetim", { kaynak, oncesi });
  await depo.kapat();
  // Uygulama yeniden başlar; bu çağrı dönmez.
  await invoke("yedekten_don", { kaynak, oncesi });
}

export async function sonYedegeDon(): Promise<void> {
  await invoke("son_yedege_don");
}
