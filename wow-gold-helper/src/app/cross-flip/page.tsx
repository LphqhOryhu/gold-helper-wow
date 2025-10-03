'use client';
import { ArrowPathIcon, PlayIcon, StopIcon } from '@heroicons/react/24/solid';
import { useMemo, useState } from 'react';
import rawNames from '@/lib/items-cache.json';

type Row = {
    itemId: number | string;
    name?: string | null;
    minSellRealm?: string | null;
    buyRealm?: string | null;
    minSellPrice?: number | null; // copper
    buyPrice?: number | null;     // copper
    sellPrice: number;            // copper (prix de sortie “intelligent”)
    sellRealm?: string | null;
    netProfit: number;            // copper
    roi: number;                  // 0..1
    sellRate: number;             // 0..1
};

// ✅ construit une Map<number,string> pour des lookups robustes
const NAME_BY_ID: Map<number, string> = new Map(
    Object.entries(rawNames as Record<string, string>).map(([k, v]) => [Number(k), v])
);

function getItemName(id: unknown): string {
    const n = typeof id === 'number' ? id : Number(id);
    if (!Number.isFinite(n)) return 'Item inconnu';
    return NAME_BY_ID.get(n) || `Item ${n}`;
}

function formatGold(n: number | null | undefined){
    if (n == null || Number.isNaN(Number(n))) return '–';
    const gold = Math.floor(Number(n) / 10000);
    return `${gold.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} g`;
}
function formatPct(x: number){ return `${(x*100).toFixed(1)}%`; }

export default function CrossFlipPage(){
    const [allRows, setAllRows] = useState<Row[]>([]);
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(100);
    const [scanProgress, setScanProgress] = useState({ current: 0, total: 0, running: false });
    const [minSellRate, setMinSellRate] = useState(0);
    const [minMargin, setMinMargin] = useState(0);
    const [maxEntryPrice, setMaxEntryPrice] = useState(50000);

    async function scanLive(){
        // Utilise un flux SSE pour avoir la progression en direct
        setAllRows([]);
        setPage(0);
        setScanProgress({ current: 0, total: 0, running: true });
        const params = new URLSearchParams({
            limit: String(pageSize),
            minSellRate: String(minSellRate),
            minMargin: String(minMargin),
            maxEntryPrice: String(maxEntryPrice),
            stream: '1',
        });
        const url = `/api/cross-scan?${params.toString()}`;
        const es = new EventSource(url);
        es.addEventListener('progress', (ev: MessageEvent) => {
            try {
                const p = JSON.parse(ev.data);
                setScanProgress({ current: Number(p.scanned)||0, total: Number(p.total)||0, running: true });
            } catch {}
        });
        es.addEventListener('done', (ev: MessageEvent) => {
            try {
                const payload = JSON.parse(ev.data);
                const allItems: Row[] = payload.results || [];
                setAllRows(allItems);
            } catch {
                setAllRows([]);
            } finally {
                setScanProgress(sp => ({ ...sp, running: false }));
                es.close();
            }
        });
        es.addEventListener('error', () => {
            setScanProgress(sp => ({ ...sp, running: false }));
            es.close();
        });
    }

    const total = allRows.length;
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const rows = useMemo(() => {
        const start = page * pageSize;
        const end = Math.min(start + pageSize, total);
        return allRows.slice(start, end);
    }, [allRows, page, pageSize, total]);

    return (
        <div className="flex flex-col items-center min-h-screen w-full bg-zinc-950 py-16">
            <div className="w-[1800px] mx-auto bg-zinc-900 rounded-2xl shadow-2xl px-20 py-16 border border-zinc-800">
                <div className="flex items-center gap-6 mb-10">
                    <ArrowPathIcon className="w-16 h-16 text-purple-400 drop-shadow-lg" />
                    <div>
                        <h1 className="text-5xl font-extrabold text-gradient bg-gradient-to-r from-purple-400 via-blue-400 to-green-400 bg-clip-text text-transparent drop-shadow-lg">Cross-Flip (EU)</h1>
                        <div className="text-zinc-400 text-lg mt-2">Compare les marges entre royaumes pour flipper des objets. Squelette UI (mock local) avec pagination {pageSize} par page.</div>
                    </div>
                </div>

                <div className="flex items-end justify-between gap-8 mb-8">
                    <div className="flex items-end gap-6 flex-wrap">
                        <div>
                            <label className="label text-lg font-semibold mb-2 block">Prix d’entrée max (g)</label>
                            <input
                                className="input w-40 px-4 py-2 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-100 text-lg focus:outline-none focus:ring-2 focus:ring-green-400"
                                type="number"
                                min={0}
                                value={maxEntryPrice}
                                onChange={e=>setMaxEntryPrice(Math.max(0, Number(e.target.value)||0))}
                            />
                        </div>
                        <div>
                            <label className="label text-lg font-semibold mb-2 block">Sell rate min</label>
                            <input
                                className="input w-32 px-4 py-2 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-100 text-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                                type="number"
                                step="0.01"
                                min={0}
                                max={1}
                                value={minSellRate}
                                onChange={e=>setMinSellRate(Math.max(0, Math.min(1, Number(e.target.value)||0)))}
                            />
                        </div>
                        <div>
                            <label className="label text-lg font-semibold mb-2 block">Marge min</label>
                            <input
                                className="input w-32 px-4 py-2 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-100 text-lg focus:outline-none focus:ring-2 focus:ring-yellow-400"
                                type="number"
                                min={0}
                                value={minMargin}
                                onChange={e=>setMinMargin(Math.max(0, Number(e.target.value)||0))}
                            />
                        </div>
                        <div>
                            <label className="label text-lg font-semibold mb-2 block">Taille page</label>
                            <input
                                className="input w-32 px-4 py-2 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-100 text-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
                                type="number"
                                min={10}
                                value={pageSize}
                                onChange={e=>setPageSize(Math.max(10, Number(e.target.value)||100))}
                            />
                        </div>
                    </div>

                    <div className="flex items-end gap-4">
                        <button
                            className="btn px-6 py-3 rounded-xl bg-green-700 text-white font-bold shadow-lg hover:bg-green-600 transition flex items-center justify-center gap-2"
                            onClick={scanLive}
                            disabled={scanProgress.running}
                            aria-label={scanProgress.running ? 'Arrêter le scan' : 'Lancer le scan'}
                            title={scanProgress.running ? 'Scan en cours' : 'Lancer le scan'}
                        >
                            {scanProgress.running ? (
                                <>
                                    <StopIcon className="w-6 h-6" />
                                    <div className="w-28 h-2 bg-green-950 rounded overflow-hidden">
                                        <div
                                            className="h-full bg-green-400 transition-all duration-200"
                                            style={{ width: `${(scanProgress.total>0? Math.min(100, Math.round((scanProgress.current/scanProgress.total)*100)) : 0)}%` }}
                                        />
                                    </div>
                                    <span className="ml-2 text-sm tabular-nums font-mono text-green-300">
                                        {(scanProgress.total>0? Math.min(100, Math.round((scanProgress.current/scanProgress.total)*100)) : 0)}%
                                    </span>
                                </>
                            ) : (
                                <PlayIcon className="w-6 h-6" />
                            )}
                        </button>
                    </div>


                </div>

                <div className="overflow-x-auto rounded-2xl shadow-xl border border-zinc-800 bg-zinc-950">
                    <table className="min-w-full text-lg">
                        <thead className="sticky top-0 bg-zinc-900 z-10">
                        <tr className="text-left text-zinc-400 border-b border-zinc-800">
                            <th className="py-3 px-4">Nom de l’objet</th>
                            <th className="px-4">Prix min (royaume)</th>
                            <th className="px-4">Prix min (prix u.)</th>
                            <th className="px-4">Prix moyen (réf.)</th>
                            <th className="px-4">Revente (royaume)</th>
                            <th className="px-4">Profit net (−5%)</th>
                            <th className="px-4">ROI</th>
                            <th className="px-4">Sell rate</th>
                        </tr>
                        </thead>
                        <tbody>
                        {rows.map((r,i)=> (
                            <tr key={`${r.itemId}-${i}`} className={`border-t border-zinc-800 ${i%2 ? 'bg-zinc-900' : ''} hover:bg-zinc-800 transition`}>
                                <td className="px-4">{ r.name ?? getItemName(r.itemId) }</td>
                                <td className="px-4 capitalize">{r.minSellRealm ?? r.buyRealm}</td>
                                <td className="px-4 tabular-nums font-mono">{formatGold(r.minSellPrice ?? r.buyPrice)}</td>
                                <td className="px-4 tabular-nums font-mono">{formatGold(r.sellPrice)}</td>
                                <td className="px-4 capitalize">{(r.sellRealm && r.sellRealm !== "(réf. régionale)") ? r.sellRealm : (r.minSellRealm ?? r.buyRealm)}</td>
                                <td className="px-4 tabular-nums font-mono font-bold text-green-300">{formatGold(r.netProfit)}</td>
                                <td className="px-4 tabular-nums font-mono">{formatPct(r.roi)}</td>
                                <td className="px-4 tabular-nums font-mono">{formatPct(r.sellRate)}</td>
                            </tr>
                        ))}
                        {!rows.length && (
                            <tr>
                                <td colSpan={8} className="py-10 text-center text-zinc-500 text-xl">
                                    Clique le bouton Lecture pour remplir le tableau.
                                </td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                </div>

                <div className="flex justify-center gap-6 mt-6">
                    <button className="btn px-6 py-3 rounded-xl bg-purple-700 text-white font-bold shadow-lg hover:bg-purple-600 transition" onClick={()=>setPage(p=>Math.max(0, p-1))} disabled={page===0}>
                        Précédent
                    </button>
                    <div className="flex items-end text-lg text-zinc-400">
                        Page <span className="font-bold text-zinc-100 mx-2">{page+1}</span> / {pageCount} — <span className="font-bold text-zinc-100 mx-2">{total.toLocaleString()}</span> lignes
                    </div>
                    <button className="btn px-6 py-3 rounded-xl bg-purple-700 text-white font-bold shadow-lg hover:bg-purple-600 transition" onClick={()=>setPage(p=>Math.min(pageCount-1, p+1))} disabled={page>=pageCount-1}>
                        Suivant
                    </button>
                </div>
            </div>

            <style jsx global>{`
                .text-gradient { background-clip: text; -webkit-background-clip: text; color: transparent; }
                .card { background: none; box-shadow: none; border: none; padding: 0; }
                .btn:disabled { opacity: 0.5; cursor: not-allowed; }
            `}</style>
        </div>
    );
}
