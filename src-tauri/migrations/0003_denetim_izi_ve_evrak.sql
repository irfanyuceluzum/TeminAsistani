-- Denetim izi yalnızca eklenir; kayıtlar güncellenmez ve silinmez.
CREATE TABLE olaylar (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alim_id TEXT NOT NULL REFERENCES alimlar(id),
  zaman TEXT NOT NULL,
  kim TEXT NOT NULL,
  tur TEXT NOT NULL,
  aciklama TEXT NOT NULL
);

CREATE INDEX olaylar_alim ON olaylar (alim_id, zaman);

CREATE TABLE evraklar (
  alim_id TEXT NOT NULL REFERENCES alimlar(id),
  kod TEXT NOT NULL,
  tamam INTEGER NOT NULL,
  tarih TEXT NOT NULL,
  aciklama TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (alim_id, kod)
);
