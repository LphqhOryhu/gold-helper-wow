import { getCharacterGold } from '@/lib/blizzard';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const realm = searchParams.get('realm');
    const name = searchParams.get('name');
    console.log('[API] /api/character-gold params:', { realm, name });
    if (!realm || !name) {
        console.log('[API] /api/character-gold error: missing realm or name');
        return Response.json({ ok: false, error: 'Missing realm or name' }, { status: 400 });
    }
    try {
        // Construction de l'URL Blizzard pour log
        const realmSlug = realm.trim().toLowerCase().replace(/[' ]/g, "-");
        const characterName = name.trim().toLowerCase();
        const REGION = process.env.BNET_REGION || "eu";
        const LOCALE = process.env.BNET_LOCALE || "fr_FR";
        const url = `https://${REGION}.api.blizzard.com/profile/wow/character/${realmSlug}/${characterName}?namespace=profile-${REGION}&locale=${LOCALE}`;
        console.log('[API] Blizzard URL:', url);
        // Appel réel
        const gold = await getCharacterGold(realm, name);
        console.log('[API] Blizzard gold value:', gold);
        if (gold == null) {
            console.log('[API] /api/character-gold error: Character not found or no gold info');
            return Response.json({ ok: false, error: 'Character not found or no gold info' }, { status: 404 });
        }
        return Response.json({ ok: true, gold });
    } catch (e) {
        console.log('[API] /api/character-gold exception:', e);
        return Response.json({ ok: false, error: String(e) }, { status: 500 });
    }
}
