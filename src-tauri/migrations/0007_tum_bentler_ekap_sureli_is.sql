-- 22. maddenin tüm bentleri (a'dan i'ye), EKAP doğrudan temin kayıt numarası ve
-- "teslimi belli süre gerektiren iş" işareti (Doğrudan Temin Tebliği m.4/5, m.5/1).
-- SQLite CHECK kısıtı değiştirilemediği için tablo yeniden kurulur. Göç bir işlem içinde
-- çalıştığından foreign_keys kapatılamaz; yabancı anahtar denetimi işlem sonuna ertelenir.

PRAGMA defer_foreign_keys = ON;

CREATE TABLE alimlar_yeni (
  id TEXT PRIMARY KEY,
  onay_tarihi TEXT NOT NULL,
  konu TEXT NOT NULL,
  bent TEXT NOT NULL CHECK (bent IN ('22/a', '22/b', '22/c', '22/d', '22/e', '22/f', '22/g', '22/h', '22/ı', '22/i')),
  tutar_kurus INTEGER NOT NULL,
  ekonomik_kod TEXT NOT NULL,
  kalem_kodu TEXT NOT NULL,
  tedarikci_id TEXT REFERENCES tedarikciler(id),
  asama TEXT NOT NULL,
  son_islem TEXT NOT NULL,
  ekap_no TEXT NOT NULL DEFAULT '',
  sureli_is INTEGER NOT NULL DEFAULT 0
);

INSERT INTO alimlar_yeni (id, onay_tarihi, konu, bent, tutar_kurus, ekonomik_kod, kalem_kodu, tedarikci_id, asama, son_islem)
  SELECT id, onay_tarihi, konu, bent, tutar_kurus, ekonomik_kod, kalem_kodu, tedarikci_id, asama, son_islem FROM alimlar;

DROP TABLE alimlar;
ALTER TABLE alimlar_yeni RENAME TO alimlar;

CREATE INDEX alimlar_onay_tarihi ON alimlar (onay_tarihi);
CREATE INDEX alimlar_kalem ON alimlar (kalem_kodu, onay_tarihi);
