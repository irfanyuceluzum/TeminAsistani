-- Araştırma tek belge olarak (JSON) tutulur: kalemler, firmalar, fiyatlar ve değerlendirme şekli.

CREATE TABLE piyasa_arastirmalari (
  alim_id TEXT PRIMARY KEY REFERENCES alimlar(id),
  belge TEXT NOT NULL,
  guncelleme TEXT NOT NULL
);
