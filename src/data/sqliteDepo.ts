import Database from "@tauri-apps/plugin-sql";
import type { PiyasaArastirmasi } from "../domain/piyasa";
import type { Alim, Asama, Ayarlar, Bent, LimitDonemi, Tedarikci } from "../domain/tipler";
import type { AlimDegisikligi, Depo } from "./depo";
import { ornekAlimlar, ornekAyarlar, ornekLimitDonemleri, ornekPiyasa, ornekTedarikciler } from "./ornekVeri";

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

const ALIM_SUTUNLARI: Record<keyof AlimDegisikligi, string> = {
  asama: "asama",
  tutar: "tutar_kurus",
  tedarikciId: "tedarikci_id",
  sonIslem: "son_islem",
};

async function alimYaz(db: Database, a: Alim): Promise<void> {
  await db.execute(
    `INSERT INTO alimlar (id, onay_tarihi, konu, bent, tutar_kurus, ekonomik_kod, kalem_kodu, tedarikci_id, asama, son_islem)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [a.id, a.onayTarihi, a.konu, a.bent, a.tutar, a.ekonomikKod, a.kalemKodu, a.tedarikciId, a.asama, a.sonIslem],
  );
}

async function piyasaYaz(db: Database, p: PiyasaArastirmasi): Promise<void> {
  await db.execute(
    `INSERT INTO piyasa_arastirmalari (alim_id, belge, guncelleme) VALUES ($1, $2, datetime('now'))
     ON CONFLICT(alim_id) DO UPDATE SET belge = excluded.belge, guncelleme = excluded.guncelleme`,
    [p.alimId, JSON.stringify(p)],
  );
}

async function ornekleriYaz(db: Database): Promise<void> {
  const [{ adet }] = await db.select<{ adet: number }[]>("SELECT COUNT(*) AS adet FROM alimlar");
  if (adet === 0) {
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
  // Piyasa tablosu sonradan eklendi; daha önce doldurulmuş veritabanında da örneği bir kez yaz.
  const [{ piyasaAdet }] = await db.select<{ piyasaAdet: number }[]>("SELECT COUNT(*) AS piyasaAdet FROM piyasa_arastirmalari");
  if (piyasaAdet === 0) {
    for (const p of ornekPiyasa) {
      const [{ var: alimVar }] = await db.select<{ var: number }[]>("SELECT COUNT(*) AS var FROM alimlar WHERE id = $1", [p.alimId]);
      if (alimVar) await piyasaYaz(db, p);
    }
  }
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
    async alimGuncelle(id, d) {
      const anahtarlar = (Object.keys(d) as (keyof AlimDegisikligi)[]).filter((k) => d[k] !== undefined);
      if (anahtarlar.length === 0) return;
      const set = anahtarlar.map((k, i) => `${ALIM_SUTUNLARI[k]} = $${i + 1}`).join(", ");
      await db.execute(`UPDATE alimlar SET ${set} WHERE id = $${anahtarlar.length + 1}`, [...anahtarlar.map((k) => d[k]), id]);
    },
    async tedarikciEkle(t) {
      await db.execute("INSERT INTO tedarikciler (id, ad, kategori) VALUES ($1, $2, $3)", [t.id, t.ad, t.kategori]);
    },
    async piyasaGetir(alimId) {
      const [satir] = await db.select<{ belge: string }[]>("SELECT belge FROM piyasa_arastirmalari WHERE alim_id = $1", [alimId]);
      return satir ? (JSON.parse(satir.belge) as PiyasaArastirmasi) : null;
    },
    async piyasaKaydet(p) {
      await piyasaYaz(db, p);
    },
    async ayarlarKaydet(a) {
      await db.execute("INSERT OR REPLACE INTO ayarlar (anahtar, deger) VALUES ('genel', $1)", [JSON.stringify(a)]);
    },
    async limitDonemiEkle(d) {
      await db.execute(
        "INSERT INTO limit_donemleri (baslangic, bitis, buyuksehir_kurus, diger_kurus, dayanak) VALUES ($1, $2, $3, $4, $5)",
        [d.baslangic, d.bitis, d.buyuksehir, d.diger, d.dayanak],
      );
    },
    async limitDonemiSil(baslangic) {
      await db.execute("DELETE FROM limit_donemleri WHERE baslangic = $1", [baslangic]);
    },
  };
}
