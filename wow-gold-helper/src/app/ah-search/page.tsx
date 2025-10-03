'use client';
import { useState } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/solid';

type Item = { id: number; name: string };

function formatGold(value?: number | null) {
    if (value == null || isNaN(value)) return <span className="text-zinc-500">–</span>;
    const gold = Math.floor(value / 10000);
    return (
        <span className="flex items-center gap-1 tabular-nums">
      <span className="text-yellow-500 font-bold">{gold} <span className="text-xs">g</span></span>
    </span>
    );
}


export default function AhSearchPage() {
    const [q, setQ] = useState('lin');
    const [realm, setRealm] = useState('Hyjal');
    const [results, setResults] = useState<(Item & { unitPrice?: number; quantity?: number })[]>([]);

    async function onSearch(e: React.FormEvent) {
        e.preventDefault();
        const items: Item[] = await fetch('/api/search-item?q=' + encodeURIComponent(q)).then(r => r.json());
        const prices = await fetch(`/api/auctions/${realm}`).then(r => r.json());
        const byItem = prices?.byItem || {};
        setResults(items.map(it => ({ ...it, unitPrice: byItem[it.id]?.unitPrice ?? null, quantity: byItem[it.id]?.quantity ?? null })));
    }

    return (
      <div className="flex flex-col items-center w-full min-h-screen bg-zinc-950 py-12">
        <div className="w-[2200px] mx-auto bg-zinc-900 rounded-2xl shadow-2xl px-24 py-24 border border-zinc-800">
          <h1 className="text-5xl font-extrabold mb-10 flex items-center gap-4 text-gradient bg-gradient-to-r from-blue-400 via-yellow-400 to-green-400 bg-clip-text text-transparent drop-shadow-lg">
            <MagnifyingGlassIcon className="w-14 h-14 text-blue-400" />
            Recherche AH
          </h1>
          <form onSubmit={onSearch} className="flex gap-8 mb-8">
            <input className="border rounded-lg px-6 py-3 bg-zinc-900 border-blue-600 focus:border-blue-400 transition w-64 text-lg" placeholder="Item name" value={q} onChange={e => setQ(e.target.value)} />
            <input className="border rounded-lg px-6 py-3 bg-zinc-900 border-blue-600 focus:border-blue-400 transition w-64 text-lg" placeholder="realm (Hyjal)" value={realm} onChange={e => setRealm(e.target.value)} />
            <button className="border rounded-lg px-6 py-3 bg-blue-500 text-white font-bold shadow-lg hover:bg-blue-400 transition-all duration-200 flex items-center gap-2 text-lg">
              <MagnifyingGlassIcon className="w-6 h-6" />
              Rechercher
            </button>
          </form>
          <ul className="divide-y divide-blue-800 border border-blue-600 rounded-2xl shadow-xl">
            {results.map(r => (
              <li key={r.id} className="p-6 flex flex-col gap-2 hover:bg-blue-950 transition-all duration-200">
                <div className="font-bold flex items-center gap-3 text-xl">
                  <MagnifyingGlassIcon className="w-7 h-7 text-blue-400" />
                  {r.name} <span className="text-blue-300">(ID {r.id})</span>
                </div>
                <div className="text-lg text-blue-200 flex gap-8">
                  <span className="bg-blue-500 text-white rounded px-4 py-2 font-bold shadow">Prix estimé: {formatGold(r.unitPrice)}</span>
                  <span className="bg-blue-700 text-white rounded px-4 py-2">Quantité: {r.quantity != null ? r.quantity : <span className="text-blue-300">–</span>}</span>
                </div>
              </li>
            ))}
            {!results.length && <div className="p-6 text-blue-300 text-center text-lg">— Aucun résultat —</div>}
          </ul>
        </div>
        <style jsx global>{`
          .text-gradient { background-clip: text; -webkit-background-clip: text; color: transparent; }
        `}</style>
      </div>
    );
}
