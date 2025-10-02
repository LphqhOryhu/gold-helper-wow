// app/api/auctions/[realm]/route.ts
export const runtime = "nodejs";

import { getRealmAuctions } from "@/lib/blizzard";

export async function GET(_req: Request, context: { params: { realm: string } }) {
    const params = await context.params;
    const realm = params.realm;

    try {
        const live = await getRealmAuctions(realm); // accepte un slug ou un ID
        // Normalise pour le front (clé unitPrice)
        const byItem: Record<number, { unitPrice: number | null; quantity: number | null }> = {};
        for (const [k, v] of Object.entries(live.byItem)) {
            const id = Number(k);
            byItem[id] = { unitPrice: v.unitPriceMin ?? null, quantity: v.quantityTotal ?? null };
        }
        return Response.json({
            ok: true,
            realmSlug: realm,
            connectedRealmId: live.realmId,
            fetchedAt: live.fetchedAt,
            byItem,
        });
    } catch (_e) {
        // Fallback mock déterministe (mêmes ids que ta page /wallet)
        const byItem = {
            190311: { unitPrice: 12, quantity: 5000 },
            190312: { unitPrice: 19, quantity: 4200 },
            2318: { unitPrice: 3, quantity: 10000 },
            2589: { unitPrice: 2, quantity: 12000 },
        };
        return Response.json(
            { ok: true, realmSlug: realm, fetchedAt: new Date().toISOString(), byItem, mode: "mock" },
            { headers: { "x-mode": "mock" } }
        );
    }
}
