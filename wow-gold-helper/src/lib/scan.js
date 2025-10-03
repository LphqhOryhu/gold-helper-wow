import { getRealmAuctions } from "./blizzard";
import { getSellRate } from "./sellrate";

function median(nums){
    if (!nums.length) return null;
    const arr = [...nums].sort((a,b)=>a-b);
    const m = Math.floor(arr.length/2);
    return arr.length % 2 ? arr[m] : Math.round((arr[m-1]+arr[m])/2);
}

function trimmedMean(nums, trim=0.1){
    if (!nums.length) return null;
    const arr = [...nums].sort((a,b)=>a-b);
    const k = Math.floor(arr.length * trim);
    const core = arr.slice(k, arr.length-k || arr.length);
    const s = core.reduce((a,b)=>a+b,0);
    return Math.round(s / core.length);
}

function chooseSellRef(minPricesPerRealm){
    const med = median(minPricesPerRealm);
    if (med && med > 0) return med;
    const tmean = trimmedMean(minPricesPerRealm, 0.1);
    return tmean || null;
}

export async function scanEURealms({
                                       realms,
                                       limit = 100,
                                       cursor = 0,
                                       minSellRate = 0.05,
                                       minMargin = 200,
                                       maxEntryPrice = Infinity,
                                       onProgress,
                                   }){
    // 1) fetch auctions par royaume (min prix par item)
    const realmData = [];
    const totalRealms = Array.isArray(realms) ? realms.length : 0;
    let scanned = 0;
    for (const slug of realms){
        try{
            const { byItem } = await getRealmAuctions(slug, { minSamePriceQty: 5 });
            console.log(`[scanEURealms] ${slug}: ${Object.keys(byItem).length} items récupérés`);
            realmData.push({ realm: slug, byItem });
        }catch(e){
            console.log(`[scanEURealms] ${slug}: erreur récupération`, e?.message || e);
        } finally {
            scanned += 1;
            try { onProgress && onProgress({ scanned, total: totalRealms, realm: slug }); } catch {}
        }
    }

    // 2) regrouper par item: collecter min prix par royaume + globalMin et globalMax
    const map = new Map(); // itemId -> { minByRealm:{realm:price}, globalMin:{realm,price}, globalMax:{realm,price} }
    for (const { realm, byItem } of realmData){
        for (const [idStr, row] of Object.entries(byItem)){
            const itemId = Number(idStr);
            const unit = row.unitPriceMinReliable || row.unitPriceMin || row.unitPrice || 0;
            if (!unit) continue;

            let rec = map.get(itemId);
            if (!rec){
                rec = { itemId, minByRealm: {}, globalMin: { realm, price: unit }, globalMax: { realm, price: unit } };
            }
            rec.minByRealm[realm] = Math.min(rec.minByRealm[realm] || Infinity, unit);
            if (unit < rec.globalMin.price){
                rec.globalMin = { realm, price: unit };
            }
            if (unit > rec.globalMax.price){
                rec.globalMax = { realm, price: unit };
            }
            map.set(itemId, rec);
        }
    }
    console.log(`[scanEURealms] total items avant filtrage: ${map.size}`);

    // 3) calcul “prix de vente réaliste” + marges
    let rows = [];
    for (const rec of map.values()){
        const minPrices = Object.values(rec.minByRealm).filter(Boolean);
        if (!minPrices.length) continue;

        const sellRef = chooseSellRef(minPrices);
        if (!sellRef) continue;

        // Trouver le royaume dont le prix min est le plus proche du prix de référence (évite les extrêmes)
        let refRealm = rec.globalMin.realm;
        let bestDiff = Infinity;
        for (const [realmName, price] of Object.entries(rec.minByRealm)){
            const diff = Math.abs(price - sellRef);
            if (diff < bestDiff) {
                bestDiff = diff;
                refRealm = realmName;
            } else if (diff === bestDiff && price > (rec.minByRealm[refRealm] ?? 0)) {
                // en cas d'égalité, préfère le prix plus élevé pour la revente
                refRealm = realmName;
            }
        }

        const buy = rec.globalMin.price;
        const hvFee = Math.round(sellRef * 0.05); // 5% HV
        const margin = Math.max(0, sellRef - buy);
        const netProfit = Math.max(0, sellRef - hvFee - buy);
        const roi = buy ? (sellRef - buy) / buy : null;

        const sellRate = getSellRate(rec.itemId); // heuristique (remplacer par vrai source quand tu l’as)

        rows.push({
            itemId: rec.itemId,
            itemName: rec.itemName,
            // anciens champs buy/sell conservés pour compat, mais on ajoute min/max explicites
            buyRealm: rec.globalMin.realm,
            buyPrice: buy,
            sellRealm: refRealm,
            sellPrice: sellRef,
            // nouveaux champs demandés: prix de vente le plus bas et le plus haut + royaumes associés
            minSellRealm: rec.globalMin.realm,
            minSellPrice: rec.globalMin.price,
            maxSellRealm: rec.globalMax.realm,
            maxSellPrice: rec.globalMax.price,
            margin,
            netProfit,
            roi,
            sellRate,
        });
    }
    console.log(`[scanEURealms] total items après mapping: ${rows.length}`);

    // 4) filtre + tri (plus grosse marge nette d’abord)
    const filteredRows = rows.filter(r => r.sellRate >= minSellRate && r.margin >= minMargin && (r.minSellPrice ?? r.buyPrice) <= maxEntryPrice);
    console.log(`[scanEURealms] total items après filtrage: ${filteredRows.length}`);
    filteredRows.sort((a,b)=> b.netProfit - a.netProfit || (b.roi ?? 0) - (a.roi ?? 0));

    // 5) pagination
    const total = filteredRows.length;
    const start = cursor;
    const end = Math.min(start + limit, total);
    const page = filteredRows.slice(start, end);
    const nextCursor = end < total ? end : null;

    return { total, nextCursor, results: page };
}
