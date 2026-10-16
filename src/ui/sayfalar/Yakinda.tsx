export function Yakinda({ baslik, aciklama }: { baslik: string; aciklama: string }) {
  return (
    <div className="sayfa">
      <header className="sayfa-ust">
        <div>
          <h1>{baslik}</h1>
          <p className="soluk">{aciklama}</p>
        </div>
      </header>
      <div className="panel">
        <p>Bu ekranın tasarımı hazır, kodu sıradaki adımlarda yazılacak.</p>
      </div>
    </div>
  );
}
