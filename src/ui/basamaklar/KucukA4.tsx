import type { ReactNode } from "react";

// A4 sayfasının küçültülmüş görünüşü; yalnızca gözle bakmak içindir, tam ekran önizleme ayrı düğmeyle açılır.
export function KucukA4({ children }: { children: ReactNode }) {
  return (
    <div className="kucuk-a4" aria-hidden="true">
      <div className="a4-sayfa">
        <div className="belge-metni">{children}</div>
      </div>
    </div>
  );
}
