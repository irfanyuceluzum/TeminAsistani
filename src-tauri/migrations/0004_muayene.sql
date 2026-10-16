-- Muayene tek belge olarak (JSON) tutulur: fatura bilgisi, kalem bazında kabul miktarları ve komisyon.

CREATE TABLE muayeneler (
  alim_id TEXT PRIMARY KEY REFERENCES alimlar(id),
  belge TEXT NOT NULL,
  guncelleme TEXT NOT NULL
);
