'use client';
import { UserCircleIcon, ArrowPathIcon } from '@heroicons/react/24/solid';
import { useEffect, useMemo, useState } from 'react';

type Row = { name: string; realm: string; gold: number; loading?: boolean; error?: string; realGold?: number | null };

function formatGold(value?: number | null) {
  if (value == null || isNaN(value)) return <span className="text-zinc-500">–</span>;
  const gold = Math.floor(value);
  const silver = Math.floor((value - gold) * 100);
  const copper = Math.round(((value - gold) * 100 - silver) * 100);
  return (
    <span className="flex items-center gap-1 tabular-nums">
      {gold > 0 && <span className="text-yellow-500 font-bold">{gold} <span className="text-xs">g</span></span>}
      {silver > 0 && <span className="text-gray-300">{silver} <span className="text-xs">s</span></span>}
      {copper > 0 && <span className="text-orange-400">{copper} <span className="text-xs">c</span></span>}
      {(gold === 0 && silver === 0 && copper === 0) && <span className="text-zinc-500">0</span>}
    </span>
  );
}

export default function CharactersPage() {
    const [rows, setRows] = useState<Row[]>([]);

    // Chargement depuis le localStorage au démarrage
    useEffect(() => {
      const saved = localStorage.getItem('wow-characters');
      if (saved) {
        try {
          setRows(JSON.parse(saved));
        } catch {}
      } else {
        setRows([
          { name: 'Mainbank', realm: 'Hyjal', gold: 5123456 },
          { name: 'Altminer', realm: 'Hyjal', gold: 223400 },
        ]);
      }
    }, []);

    // Sauvegarde à chaque modification
    useEffect(() => {
      localStorage.setItem('wow-characters', JSON.stringify(rows));
    }, [rows]);

    const total = useMemo(() => rows.reduce((a, b) => a + (b.realGold != null ? b.realGold : Number(b.gold) || 0), 0), [rows]);
    const setRow = (i: number, patch: Partial<Row>) => setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

    async function fetchRealGold(i: number) {
      const row = rows[i];
      if (!row.name || !row.realm) return setRow(i, { error: "Nom ou serveur manquant" });
      setRow(i, { loading: true, error: undefined });
      try {
        const res = await fetch(`/api/character-gold?realm=${encodeURIComponent(row.realm)}&name=${encodeURIComponent(row.name)}`);
        const data = await res.json();
        if (data.ok && typeof data.gold === "number") {
          setRow(i, { realGold: data.gold, loading: false, error: undefined });
        } else {
          setRow(i, { realGold: null, loading: false, error: data.error || "Introuvable" });
        }
      } catch (e) {
        setRow(i, { realGold: null, loading: false, error: "Erreur réseau" });
      }
    }

    return (
        <div className="flex flex-col items-center w-full min-h-screen bg-zinc-950 py-12">
        <div className="w-[2200px] mx-auto bg-zinc-900 rounded-2xl shadow-2xl px-24 py-24 border border-zinc-800">
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-4xl font-extrabold flex items-center gap-3 text-gradient bg-gradient-to-r from-yellow-400 via-yellow-200 to-yellow-500 bg-clip-text text-transparent drop-shadow-lg">
                      <UserCircleIcon className="w-12 h-12 text-yellow-500" />
                      Gestion des personnages
                    </h1>
                    <button className="border rounded-lg px-6 py-3 bg-yellow-500 text-black font-bold shadow-lg hover:bg-yellow-400 transition text-lg" onClick={() => setRows([...rows, { name: '', realm: 'Hyjal', gold: 0 }])}>+ Ajouter un perso</button>
                </div>
                <div className="overflow-auto border border-yellow-600 rounded-2xl shadow-xl">
                    <table className="w-full text-lg">
                        <thead className="bg-yellow-900 text-yellow-200">
                          <tr>
                            <th className="p-4 text-left">Nom</th>
                            <th className="p-4">Royaume</th>
                            <th className="p-4">Or local</th>
                            <th className="p-4">Or Blizzard</th>
                            <th className="p-4"></th>
                          </tr>
                        </thead>
                        <tbody>
                        {rows.map((r, i) => (
                            <tr key={i} className="border-t border-yellow-800 hover:bg-yellow-950 transition-all duration-200">
                                <td className="p-4 flex items-center gap-2">
                                  <UserCircleIcon className="w-7 h-7 text-yellow-400" />
                                  <input className="border rounded-lg px-3 py-2 bg-zinc-900 border-yellow-600 focus:border-yellow-400 transition w-48 text-lg" value={r.name} onChange={e => setRow(i, { name: e.target.value, realGold: undefined, error: undefined })} />
                                </td>
                                <td className="p-4"><input className="border rounded-lg px-3 py-2 bg-zinc-900 border-yellow-600 focus:border-yellow-400 transition w-40 text-lg" value={r.realm} onChange={e => setRow(i, { realm: e.target.value, realGold: undefined, error: undefined })} /></td>
                                <td className="p-4 flex items-center gap-2">
                                  {formatGold(r.gold)}
                                  <input type="number" className="border rounded-lg px-3 py-2 bg-zinc-900 border-yellow-600 focus:border-yellow-400 transition w-32 text-lg" value={r.gold} onChange={e => setRow(i, { gold: Number(e.target.value), realGold: undefined, error: undefined })} />
                                </td>
                                <td className="p-4">
                                  {r.loading ? <span className="text-yellow-400">Chargement...</span> : r.realGold != null ? <span className="bg-yellow-400 text-black rounded px-3 py-2 font-bold shadow-lg">{formatGold(r.realGold)}</span> : r.error ? <span className="text-red-500">{r.error}</span> : <span className="text-zinc-500">–</span>}
                                </td>
                                <td className="p-4">
                                  <button className="border rounded-lg px-3 py-2 bg-yellow-500 text-black font-bold shadow hover:bg-yellow-400 transition flex items-center gap-1 text-lg" onClick={() => fetchRealGold(i)} title="Actualiser la valeur Blizzard">
                                    <ArrowPathIcon className="w-5 h-5" />
                                  </button>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
                <div className="flex items-center justify-between border border-yellow-600 rounded-2xl p-6 bg-yellow-950 shadow-xl mt-8">
                    <div className="text-yellow-200 text-xl">Total agrégé</div>
                    <div className="text-3xl font-extrabold tabular-nums text-yellow-400 flex items-center gap-3">
                      <UserCircleIcon className="w-8 h-8" />
                      {formatGold(total)}
                    </div>
                </div>
            </div>
            <style jsx global>{`
              .text-gradient { background-clip: text; -webkit-background-clip: text; color: transparent; }
            `}</style>
        </div>
    );
}
