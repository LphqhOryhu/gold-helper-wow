// Charge un “prix de vente de référence” par itemId, si dispo (ex: TSM Region Sale Avg).
// Par défaut, rien (null) => l’agrégateur utilisera la médiane des min-prix par royaume.

let REF = null; // Map<number, number>

export function loadMarketRefFromJSON(obj){
    REF = new Map(Object.entries(obj).map(([k,v]) => [Number(k), Number(v)]));
}

export function getMarketRef(itemId){
    if (!REF) return null;
    const v = REF.get(itemId);
    return (typeof v === "number" && v > 0) ? v : null;
}
