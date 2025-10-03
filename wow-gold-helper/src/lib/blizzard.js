// src/lib/blizzard.js
const REGION = process.env.BNET_REGION || "eu";
const LOCALE = process.env.BNET_LOCALE || "fr_FR";

async function getToken(){
    const id = process.env.BNET_CLIENT_ID;
    const secret = process.env.BNET_CLIENT_SECRET;
    if(!id || !secret) throw new Error("No Blizzard credentials");
    const resp = await fetch("https://oauth.battle.net/token", {
        method: "POST",
        headers: {
            "Authorization": "Basic " + Buffer.from(id+":"+secret).toString("base64"),
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({ grant_type: "client_credentials" })
    });
    if(!resp.ok) throw new Error("Token error");
    const data = await resp.json();
    return data.access_token;
}

/* -------------------- NOUVEAU: résolution slug -> connectedRealmId -------------------- */

// Cache en mémoire pour éviter de requery
const CONNECTED_REALM_CACHE = new Map(); // slug -> id

// Normalisation "souple" (accents/apostrophes/espaces → tirets)
function normalizeSlugLoose(slug) {
    return String(slug)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/['’]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

// 1) Tentative rapide par l’endpoint SEARCH (fiable et peu coûteux)
// 2) Si rien ne remonte, tentative avec un slug "loose"
// 3) En dernier recours, fallback via l’index complet (plus lent)
async function getConnectedRealmId(slug) {
    const original = slug;
    if (CONNECTED_REALM_CACHE.has(original)) return CONNECTED_REALM_CACHE.get(original);

    const token = await getToken();

    // --- Essai #1 : /search/connected-realm?realms.slug=slug
    const trySearch = async (needle) => {
        const url = `https://${REGION}.api.blizzard.com/data/wow/search/connected-realm?namespace=dynamic-${REGION}&locale=${LOCALE}&realms.slug=${encodeURIComponent(needle)}&_page=1&_pageSize=1`;
        const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        if (!r.ok) return null;
        const j = await r.json();
        const id = j?.results?.[0]?.data?.id ?? null;
        return id || null;
    };

    // direct
    let id = await trySearch(original);
    if (!id) {
        // loose
        const loose = normalizeSlugLoose(original);
        if (loose !== original) {
            id = await trySearch(loose);
        }
    }

    // --- Essai #2 : Fallback via l’index complet (lent mais exhaustif)
    if (!id) {
        const indexUrl = `https://${REGION}.api.blizzard.com/data/wow/connected-realm/index?namespace=dynamic-${REGION}&locale=${LOCALE}`;
        const indexResp = await fetch(indexUrl, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        if (indexResp.ok) {
            const indexData = await indexResp.json();
            const entries = indexData?.connected_realms || [];
            const targetSlugLoose = normalizeSlugLoose(original);
            // On parcourt jusqu’à trouver un realms.slug qui matche (en "loose")
            for (const entry of entries) {
                const href = entry?.href;
                if (!href) continue;
                const detailResp = await fetch(href + `&locale=${LOCALE}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
                if (!detailResp.ok) continue;
                const detail = await detailResp.json();
                const realms = detail?.realms || [];
                const match = realms.find(r => normalizeSlugLoose(r?.slug) === targetSlugLoose);
                if (match) { id = detail?.id; break; }
            }
        }
    }

    if (!id) {
        throw new Error(`Connected realm ID not found for slug: ${original}`);
    }

    CONNECTED_REALM_CACHE.set(original, id);
    return id;
}

/* -------------------- Item name cache (inchangé) -------------------- */

const itemNameCache = {};
async function getItemName(itemId) {
    if (itemNameCache[itemId]) return itemNameCache[itemId];
    const token = await getToken();
    const url = `https://${REGION}.api.blizzard.com/data/wow/item/${itemId}?namespace=static-${REGION}&locale=${LOCALE}`;
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "force-cache" });
    if (!resp.ok) return null;
    const data = await resp.json();
    itemNameCache[itemId] = data.name || null;
    return itemNameCache[itemId];
}

/* -------------------- getRealmAuctions (avec skip propre) -------------------- */

export async function getRealmAuctions(realmSlug, opts = {}){
    const token = await getToken();

    // ⚠️ On RESOUT d’abord l’ID via la nouvelle fonction robuste
    let realmId;
    try {
        realmId = await getConnectedRealmId(realmSlug);
    } catch (e) {
        // On log et on **skip** ce realm proprement (pas de throw pour ne pas casser le scan global)
        console.warn(`[getRealmAuctions] Skip realm "${realmSlug}" (slug->id failed): ${e?.message || e}`);
        return { fetchedAt: new Date().toISOString(), byItem: {} };
    }

    const url = `https://${REGION}.api.blizzard.com/data/wow/connected-realm/${realmId}/auctions?namespace=dynamic-${REGION}&locale=${LOCALE}`;
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if(!resp.ok) {
        console.warn(`[getRealmAuctions] ${realmSlug}: auction error (status ${resp.status})`);
        return { fetchedAt: new Date().toISOString(), byItem: {} };
    }

    const data = await resp.json();

    const byItem = {};
    const minSamePriceQty = Number(opts.minSamePriceQty ?? 5);
    const rareSmallQtyThreshold = Number(opts.rareSmallQtyThreshold ?? 3);

    for (const a of data.auctions || []) {
        const id = a.item?.id;
        if(!id) continue;
        const buy = a.buyout || a.unit_price || 0;
        const stack = a.quantity || 1;
        const unit = buy && stack ? Math.max(1, Math.round(buy / stack)) : 0;

        if(!byItem[id]) {
            byItem[id] = { itemId: id, unitPriceMin: unit, quantityTotal: 0, priceBuckets: Object.create(null) };
        }
        // min "naïf" (compat)
        byItem[id].unitPriceMin = Math.min(byItem[id].unitPriceMin || unit, unit || Infinity);
        byItem[id].quantityTotal += stack;

        if (unit) {
            const bucket = byItem[id].priceBuckets[unit] || { qty: 0, count: 0 };
            bucket.qty += stack;
            bucket.count += 1;
            byItem[id].priceBuckets[unit] = bucket;
        }
    }

    // min "fiable" par item (filtre anti-outliers + exception items rares)
    for (const rec of Object.values(byItem)) {
        const prices = Object.keys(rec.priceBuckets).map(n => Number(n)).sort((a,b)=>a-b);
        let reliable = null;
        for (const p of prices) {
            const bucket = rec.priceBuckets[p];
            if ((bucket.qty || 0) >= minSamePriceQty) { reliable = p; break; }
        }
        if (!reliable) {
            if ((rec.quantityTotal || 0) <= rareSmallQtyThreshold) {
                reliable = rec.unitPriceMin || null;
            }
        }
        if (reliable) rec.unitPriceMinReliable = reliable;
        delete rec.priceBuckets; // alléger la payload
    }

    return { fetchedAt: new Date().toISOString(), byItem };
}

// Export explicite si utilisé ailleurs
export { getToken, getItemName };
