import { isTauri } from "@tauri-apps/api/core";

// Masaüstünde kayıt penceresiyle diske yazar; tarayıcı önizlemesinde indirme başlatır.
// Kullanıcı vazgeçerse false döner.
export async function metinDosyasiKaydet(onerilenAd: string, icerik: string): Promise<boolean> {
  if (isTauri()) {
    const [{ save }, { writeTextFile }] = await Promise.all([import("@tauri-apps/plugin-dialog"), import("@tauri-apps/plugin-fs")]);
    const yol = await save({ defaultPath: onerilenAd, filters: [{ name: "Excel (CSV)", extensions: ["csv"] }] });
    if (!yol) return false;
    await writeTextFile(yol, icerik);
    return true;
  }
  const url = URL.createObjectURL(new Blob([icerik], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = onerilenAd;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}
