import Database from "@tauri-apps/plugin-sql";
import type { Alim, Asama, Ayarlar, Bent, LimitDonemi, Tedarikci } from "../domain/tipler";
import type { Depo } from "./depo";
import { ornekAlimlar, ornekAyarlar, ornekLimitDonemleri, ornekTedarikciler } from "./ornekVeri";

// Şema src-tauri/migrations altındaki SQL dosyalarıyla Rust tarafında kurulur.
const ADRES = "sqlite:temin.db";

interface AlimSatiri {
  id: string;
  onay_tarihi: string;
  konu: string;
  bent: Bent;
  tutar_kurus: number;
  ekonomik_kod: string;
  kalem_kodu: string;
  tedarikci_id: string | null;
  asama: Asama;
  son_islem: string;
}

interface DonemSatiri {
  baslangic: string;
  bitis: string;
  buyuksehir_kurus: number;
  diger_kurus: number;
  dayanak: string;
}

async function alimYaz(db: Database, a: Alim): Promise<void> {
  await db.execute(
    `INSERT INTO alimlar (id, onay_tarihi, konu, bent, tutar_kurus, ekonomik_kod, kalem_kodu, tedarikci_id, asama, son_islem)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [a.id, a.onayTarihi, a.konu, a.bent, a.tutar, a.ekonomikKod, a.kalemKodu, a.tedarikciId, a.asama, a.sonIslem],
  );
}

async function ornekleriYaz(db: Database): Promise<void> {
  const [{ adet }] = await db.select<{ adet: number }[]>("SELECT COUNT(*) AS adet FROM alimlar");
  if (adet > 0) return;
  for (const d of ornekLimitDonemleri) {
    await db.execute(
      "INSERT INTO limit_donemleri (baslangic, bitis, buyuksehir_kurus, diger_kurus, dayanak) VALUES ($1, $2, $3, $4, $5)",
      [d.baslangic, d.bitis, d.buyuksehir, d.diger, d.dayanak],
    );
  }
  for (const t of ornekTedarikciler) {
    await db.execute("INSERT INTO tedarikciler (id, ad, kategori) VALUES ($1, $2, $3)", [t.id, t.ad, t.kategori]);
  }
  for (const a of ornekAlimlar) {
    await alimYaz(db, a);
  }
  await db.execute("INSERT OR REPLACE INTO ayarlar (anahtar, deger) VALUES ('genel', $1)", [JSON.stringify(ornekAyarlar)]);
}

export async function sqliteDepo(): Promise<Depo> {
  const db = await Database.load(ADRES);
  await ornekleriYaz(db);
  return {
    tur: "sqlite",
    async alimlar() {
      const satirlar = await db.select<AlimSatiri[]>("SELECT * FROM alimlar ORDER BY onay_tarihi DESC");
      return satirlar.map(
        (s): Alim => ({
          id: s.id,
          onayTarihi: s.onay_tarihi,
          konu: s.konu,
          bent: s.bent,
          tutar: s.tutar_kurus,
          ekonomikKod: s.ekonomik_kod,
          kalemKodu: s.kalem_kodu,
          tedarikciId: s.tedarikci_id,
          asama: s.asama,
          sonIslem: s.son_islem,
        }),
      );
    },
    async tedarikciler() {
      return db.select<Tedarikci[]>("SELECT id, ad, kategori FROM tedarikciler ORDER BY ad");
    },
    async limitDonemleri() {
      const satirlar = await db.select<DonemSatiri[]>("SELECT * FROM limit_donemleri ORDER BY baslangic");
      return satirlar.map(
        (s): LimitDonemi => ({
          baslangic: s.baslangic,
          bitis: s.bitis,
          buyuksehir: s.buyuksehir_kurus,
          diger: s.diger_kurus,
          dayanak: s.dayanak,
        }),
      );
    },
    async ayarlar() {
      const [satir] = await db.select<{ deger: string }[]>("SELECT deger FROM ayarlar WHERE anahtar = 'genel'");
      return satir ? (JSON.parse(satir.deger) as Ayarlar) : ornekAyarlar;
    },
    async alimEkle(alim) {
      await alimYaz(db, alim);
    },
  };
}
