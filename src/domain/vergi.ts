// KDV tutarı (kuruş): matrah × oran%, kuruşa yuvarlanır. Para hesaplarında KDV yuvarlaması tek yerdedir.
export function kdvTutari(matrah: number, oranYuzde: number): number {
  return Math.round((matrah * oranYuzde) / 100);
}
