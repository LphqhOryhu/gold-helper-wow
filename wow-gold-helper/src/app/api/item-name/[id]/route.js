import itemsCache from '../../../../lib/items-cache.json';

export async function GET(req, context) {
    // In Next.js dynamic API routes, context.params can be a Promise and must be awaited
    const { id } = await context.params;
    const itemId = String(id || '');
    if (!itemId) return Response.json({ ok: false, error: 'missing_id' }, { status: 400 });
    const name = itemsCache[itemId];
    if (!name) return Response.json({ ok: false, error: 'not_found' }, { status: 404 });
    return Response.json({ ok: true, name });
}
