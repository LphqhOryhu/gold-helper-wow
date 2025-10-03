import { scanEURealms } from "../../../lib/scan";
import { EU_CONNECTED_REALMS } from "../../../lib/realms-eu";
import itemsCache from "../../../lib/items-cache.json";

export async function GET(req){
    const { searchParams } = new URL(req.url);
    const limit = Math.min(200, Number(searchParams.get('limit')||100));
    const cursor = Number(searchParams.get('cursor')||0);
    const minSellRate = Number(searchParams.get('minSellRate')||0.05);
    const minMargin = Number(searchParams.get('minMargin')||200);
    const maxEntryPriceGold = searchParams.get('maxEntryPrice');
    const maxEntryPrice = maxEntryPriceGold != null ? Math.round(Number(maxEntryPriceGold) * 10000) : Infinity; // convert gold -> copper
    const realmsParam = (searchParams.get('realms')||'').split(',').filter(Boolean);
    const realmParam = searchParams.get('realm');
    const realms = realmParam ? [realmParam] : (realmsParam.length ? realmsParam : EU_CONNECTED_REALMS);
    const stream = searchParams.get('stream');

    if (stream === '1') {
        // Server-Sent Events streaming mode
        const encoder = new TextEncoder();
        function sse(event, data){
            return encoder.encode(`event: ${event}\n` + `data: ${JSON.stringify(data)}\n\n`);
        }
        const body = new ReadableStream({
            start: async (controller) => {
                try {
                    let lastProgress = { scanned: 0, total: realms.length };
                    const data = await scanEURealms({ realms, limit, cursor, minSellRate, minMargin, maxEntryPrice, onProgress: (p)=>{
                        lastProgress = p || lastProgress;
                        controller.enqueue(sse('progress', { scanned: lastProgress.scanned, total: lastProgress.total, realm: lastProgress.realm }));
                    }});

                    // enrich names
                    if (Array.isArray(data.results)) {
                        data.results.forEach(r => {
                            r.name = itemsCache[String(r.itemId)] || null;
                        });
                    }

                    controller.enqueue(sse('done', { ok: true, ...data }));
                } catch (e) {
                    controller.enqueue(sse('error', { ok:false, error:"scan_failed", message: e?.message || 'unknown' }));
                } finally {
                    controller.close();
                }
            }
        });
        return new Response(body, {
            headers: {
                'Content-Type': 'text/event-stream; charset=utf-8',
                'Cache-Control': 'no-cache, no-transform',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no',
            },
        });
    }

    try {
        console.log('[cross-scan] params:', { realms, limit, cursor, minSellRate, minMargin, maxEntryPrice });
        const data = await scanEURealms({ realms, limit, cursor, minSellRate, minMargin, maxEntryPrice });
        console.log('[cross-scan] total items after scan:', data.total);
        if (data.results && data.results.length) {
            console.log('[cross-scan] first result:', data.results[0]);
        } else {
            console.log('[cross-scan] aucun résultat trouvé');
        }

        const { results } = data;

        // Ajout du nom d'objet à chaque résultat
        if (Array.isArray(results)) {
            results.forEach(r => {
                r.name = itemsCache[String(r.itemId)] || null;
            });
        }

        return Response.json({ ok:true, ...data });
    } catch (e) {
        console.error('[cross-scan] erreur:', e);
        return Response.json({ ok:false, error:"scan_failed", message: e?.message || "unknown" }, { status: 500 });
    }
}
