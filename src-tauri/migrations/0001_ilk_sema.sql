-- Tutarlar kuruş cinsinden tam sayı, tarihler YYYY-AA-GG metni.

CREATE TABLE limit_donemleri (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  baslangic TEXT NOT NULL,
  bitis TEXT NOT NULL,
  buyuksehir_kurus INTEGER NOT NULL,
  diger_kurus INTEGER NOT NULL,
  dayanak TEXT NOT NULL
);

CREATE TABLE tedarikciler (
  id TEXT PRIMARY KEY,
  ad TEXT NOT NULL,
  kategori TEXT NOT NULL DEFAULT ''
);

CREATE TABLE alimlar (
  id TEXT PRIMARY KEY,
  onay_tarihi TEXT NOT NULL,
  konu TEXT NOT NULL,
  bent TEXT NOT NULL CHECK (bent IN ('22/a', '22/b', '22/c', '22/d', '22/e')),
  tutar_kurus INTEGER NOT NULL,
  ekonomik_kod TEXT NOT NULL,
  kalem_kodu TEXT NOT NULL,
  tedarikci_id TEXT REFERENCES tedarikciler(id),
  asama TEXT NOT NULL,
  son_islem TEXT NOT NULL
);

CREATE INDEX alimlar_onay_tarihi ON alimlar (onay_tarihi);
CREATE INDEX alimlar_kalem ON alimlar (kalem_kodu, onay_tarihi);

CREATE TABLE ayarlar (
  anahtar TEXT PRIMARY KEY,
  deger TEXT NOT NULL
);
