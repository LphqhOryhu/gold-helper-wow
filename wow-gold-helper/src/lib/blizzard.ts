// lib/blizzard.ts
// Helper Blizzard Game Data API (OAuth client_credentials)
// Node runtime only (Next.js API routes). Ne pas importer côté client.

export type ItemLite = { id: number; name: string };
export type ItemMarketSummary = {
    itemId: number;
    unitPriceMin: number | null;
    quantityTotal: number | null;
};

const REGION = process.env.BNET_REGION || "eu";
const LOCALE = process.env.BNET_LOCALE || "fr_FR";

let cachedToken: { token: string; expiresAt: number } | null = null;

function hasCreds() {
    return !!(process.env.BNET_CLIENT_ID && process.env.BNET_CLIENT_SECRET);
}

function assertCreds() {
    if (!hasCreds()) throw new Error("BLIZZARD_CREDS_MISSING");
}

async function getToken(): Promise<string> {
    assertCreds();
    if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.token;

    const id = process.env.BNET_CLIENT_ID!;
    const secret = process.env.BNET_CLIENT_SECRET!;
    const basic = Buffer.from(`${id}:${secret}`).toString("base64");

    const resp = await fetch("https://oauth.battle.net/token", {
        method: "POST",
        headers: {
            Authorization: `Basic ${basic}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ grant_type: "client_credentials" }),
        cache: "no-store",
    });
    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`TOKEN_ERROR: ${resp.status} ${text}`);
    }
    const data = (await resp.json()) as { access_token: string; expires_in: number };
    cachedToken = {
        token: data.access_token,
        // marge de 60s
        expiresAt: Date.now() + (data.expires_in - 60) * 1000,
    };
    return cachedToken.token;
}

/**
 * Résout un connected realm à partir d'un slug (ex: "kazzak")
 * OU accepte un ID numérique directement.
 */
async function resolveConnectedRealmId(realmSlugOrId: string, token: string): Promise<string> {
    // si déjà un ID numérique, on le retourne
    if (/^\d+$/.test(realmSlugOrId)) return realmSlugOrId;

    // Recherche du connected realm via l’API de recherche
    // Endpoint: /data/wow/search/connected-realm
    // Filtrage par "realms.slug" (un des royaumes du CR)
    const url =
        `https://${REGION}.api.blizzard.com/data/wow/search/connected-realm` +
        `?namespace=dynamic-${REGION}` +
        `&locale=${LOCALE}` +
        `&_pageSize=1` +
        `&realms.slug=${encodeURIComponent(realmSlugOrId.toLowerCase())}`;

    const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
    });
    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`RESOLVE_REALM_ERROR: ${resp.status} ${text}`);
    }
    const data = await resp.json();
    // data.results[0].key.href devrait contenir l’URL du connected realm, avec l’ID à la fin
    const first = data?.results?.[0];
    if (!first?.key?.href) throw new Error(`REALM_NOT_FOUND: ${realmSlugOrId}`);

    // Exemple d’href: https://{region}.api.blizzard.com/data/wow/connected-realm/1305?namespace=dynamic-eu
    const href: string = first.key.href;
    const match = href.match(/connected-realm\/(\d+)/);
    if (!match) throw new Error(`REALM_ID_PARSE_ERROR: href=${href}`);
    return match[1];
}

/**
 * Recherche d’items (forme légère), filtrée dans la locale demandée.
 * Fallback: en_US puis n'importe quelle locale disponible.
 */
export async function searchItem(query: string): Promise<ItemLite[]> {
    assertCreds();
    if (!query || query.trim().length < 2) return [];
    const token = await getToken();

    const url =
        `https://${REGION}.api.blizzard.com/data/wow/search/item` +
        `?namespace=static-${REGION}` +
        `&_pageSize=10&orderby=id&_page=1` +
        `&locale=${LOCALE}` +
        `&name.${LOCALE}=${encodeURIComponent(query)}`;

    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`ITEM_SEARCH_ERROR: ${resp.status} ${text}`);
    }
    const data = await resp.json();

    const items: ItemLite[] = (data?.results || []).map((r: any) => {
        const id = r?.data?.id;
        const names = r?.data?.name || {};
        const localized = names?.[LOCALE];
        const enUS = names?.["en_US"];
        const anyKey = Object.keys(names || {})[0];
        const anyName = anyKey ? names[anyKey] : undefined;
        const name = localized || enUS || anyName || `Item ${id}`;
        return { id, name };
    });
    return items;
}

/**
 * Snapshot HV par connected realm -> agrégation par item:
 * - unitPriceMin: min(buyout/unit_price par unité)
 * - quantityTotal: somme des quantités
 */
export async function getRealmAuctions(realmSlugOrId: string): Promise<{
    realmId: string;
    fetchedAt: string;
    byItem: Record<number, ItemMarketSummary>;
}> {
    assertCreds();
    const token = await getToken();
    const connectedRealmId = await resolveConnectedRealmId(realmSlugOrId, token);

    const url = `https://${REGION}.api.blizzard.com/data/wow/connected-realm/${connectedRealmId}/auctions?namespace=dynamic-${REGION}&locale=${LOCALE}`;
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`AUCTIONS_ERROR: ${resp.status} ${text}`);
    }
    const data = await resp.json();

    const byItem: Record<number, ItemMarketSummary> = {};
    for (const a of data?.auctions || []) {
        const id = a?.item?.id;
        if (!id) continue;
        const quantity = Number(a?.quantity || 1);
        const buy = Number(a?.buyout || a?.unit_price || 0);
        const unitCopper = buy > 0 && quantity > 0 ? Math.floor(buy / quantity) : 0;
        const unitGold = unitCopper > 0 ? unitCopper / 10000 : 0; // 1g = 100s = 10000c
// on peut arrondir à 2 décimales pour affichage propre
        const unit = unitGold > 0 ? Math.round(unitGold * 100) / 100 : 0;

        if (!byItem[id]) byItem[id] = { itemId: id, unitPriceMin: unit || null, quantityTotal: 0 };
        const prev = byItem[id];
        // min non nul
        if (unit && (prev.unitPriceMin == null || unit < prev.unitPriceMin)) {
            prev.unitPriceMin = unit;
        }
        prev.quantityTotal = (prev.quantityTotal || 0) + quantity;
    }

    return {
        realmId: connectedRealmId,
        fetchedAt: new Date().toISOString(),
        byItem,
    };
}

/**
 * Récupère la vraie valeur d'or d'un personnage.
 * @param realm Slug du royaume (minuscule, tirets)
 * @param name Nom du personnage
 * @returns Valeur d'or en or, ou null si non trouvé
 */
export async function getCharacterGold(realm: string, name: string): Promise<number | null> {
    assertCreds();
    const token = await getToken();
    // Slug du royaume (minuscule, tirets)
    const realmSlug = realm.trim().toLowerCase().replace(/[' ]/g, "-");
    const characterName = name.trim().toLowerCase();
    const url = `https://${REGION}.api.blizzard.com/profile/wow/character/${realmSlug}/${characterName}?namespace=profile-${REGION}&locale=${LOCALE}&access_token=${token}`;
    const resp = await fetch(url, { cache: "no-store" });
    if (!resp.ok) return null;
    const data = await resp.json();
    // gold est en copper
    return typeof data.gold === "number" ? data.gold / 10000 : null;
}

export function ensureLiveReady() {
    // Utilitaire: lève une erreur explicite si les creds manquent
    assertCreds();
}
