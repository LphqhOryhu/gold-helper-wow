// app/api/search-item/route.ts
export const runtime = "nodejs";

import { searchItem } from "@/lib/blizzard";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    if (q.length < 2) return Response.json({ ok: false, error: "query_too_short" }, { status: 400 });

    try {
        const items = await searchItem(q);
        return Response.json(items); // forme simple côté front
    } catch (_e) {
        // Fallback mock
        const mock = [
            { id: 2318, name: "Light Leather" },
            { id: 2319, name: "Medium Leather" },
            { id: 2589, name: "Linen Cloth" },
        ].filter((it) => it.name.toLowerCase().includes(q.toLowerCase()));
        return Response.json(mock, { headers: { "x-mode": "mock" } });
    }
}
