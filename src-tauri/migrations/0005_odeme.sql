-- Ödeme tek belge olarak (JSON) tutulur: KDV oranı, tevkifat türü, borç sorguları ve ödeme emri numarası.

CREATE TABLE odemeler (
  alim_id TEXT PRIMARY KEY REFERENCES alimlar(id),
  belge TEXT NOT NULL,
  guncelleme TEXT NOT NULL
);
