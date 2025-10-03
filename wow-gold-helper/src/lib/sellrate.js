// MVP: heuristique. Tu remplaceras par des valeurs réelles (TSM/UndermineX) plus tard.
const FAST = new Set([2589,2592,2318,2319,4306,4338,33470,152576,152577,190311,190312]);

export function getSellRate(itemId){
    return FAST.has(itemId) ? 0.20 : 0.04; // 20% pour mats courants, 4% sinon (placeholder)
}
