'use client';
import { useEffect, useMemo, useState } from 'react';
import { WalletIcon } from '@heroicons/react/24/solid';

type ByItem = Record<number, { unitPrice: number; quantity: number }>;

function formatGold(value?: number | null) {
  if (value == null || isNaN(value)) return <span className="text-zinc-500">–</span>;
  const gold = Math.floor(value);
  const silver = Math.floor((value - gold) * 100);
  const copper = Math.round(((value - gold) * 100 - silver) * 100);
  return (
    <span className="flex items-center gap-1 tabular-nums">
      {gold > 0 && <span className="text-yellow-500 font-bold">{gold} <span className="text-xs">🪙</span></span>}
      {silver > 0 && <span className="text-gray-300">{silver} <span className="text-xs">🥈</span></span>}
      {copper > 0 && <span className="text-orange-400">{copper} <span className="text-xs">🥉</span></span>}
      {(gold === 0 && silver === 0 && copper === 0) && <span className="text-zinc-500">0</span>}
    </span>
  );
}

export default function WalletPage() {
    const [realm, setRealm] = useState('Hyjal');
    const [rows, setRows] = useState([{ itemId: 2318, name: 'Light Leather', qty: 200 }]);
    const [byItem, setByItem] = useState<ByItem>({});

    useEffect(() => {
        fetch(`/api/auctions/${realm}`).then(r => r.json()).then(d => setByItem(d?.byItem ?? {}));
    }, [realm]);

    const total = useMemo(() =>
        rows.reduce((acc, r) => acc + (byItem[r.itemId]?.unitPrice ?? 0) * r.qty, 0), [rows, byItem]);

    const setRow = (i: number, patch: Partial<typeof rows[number]>) =>
        setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

    return (
      <div className="flex flex-col items-center w-full min-h-screen bg-zinc-950 py-12">
        <div className="w-[2200px] mx-auto bg-zinc-900 rounded-2xl shadow-2xl px-24 py-24 border border-zinc-800">
          <h1 className="text-5xl font-extrabold mb-10 flex items-center gap-4 text-gradient bg-gradient-to-r from-green-400 via-yellow-400 to-blue-400 bg-clip-text text-transparent drop-shadow-lg">
            <WalletIcon className="w-14 h-14 text-green-400" />
            Estimateur d'inventaire
          </h1>
          <div className="flex gap-6 mb-8">
            <input className="border rounded-lg px-6 py-3 bg-zinc-900 border-green-600 focus:border-green-400 transition w-64 text-lg" value={realm} onChange={e => setRealm(e.target.value)} placeholder="Hyjal" />
            <button className="border px-6 py-3 rounded-lg bg-green-500 text-black font-bold shadow-lg hover:bg-green-400 transition-all duration-200 text-lg" onClick={() => setRows([...rows, { itemId: 0, name: '', qty: 0 }])}>+ ligne</button>
          </div>
          <div className="overflow-auto border border-green-600 rounded-2xl shadow-xl">
            <table className="w-full text-lg">
              <thead className="bg-green-900 text-green-200">
                <tr><th className="p-4 text-left">Item ID</th><th className="p-4">Nom</th><th className="p-4">Quantité</th><th className="p-4">Prix unitaire</th><th className="p-4">Total</th></tr>
              </thead>
              <tbody>
              {rows.map((r, i) => {
                const unit = byItem[r.itemId]?.unitPrice ?? null;
                const totalRow = unit != null ? unit * r.qty : null;
                return (
                  <tr key={i} className="border-t border-green-800 hover:bg-green-950 transition-all duration-200">
                    <td className="p-4 flex items-center gap-2">
                      <WalletIcon className="w-7 h-7 text-green-400" />
                      <input className="border rounded-lg px-3 py-2 bg-zinc-900 border-green-600 focus:border-green-400 transition w-32 text-lg" value={r.itemId} onChange={e => setRow(i, { itemId: Number(e.target.value) })} />
                    </td>
                    <td className="p-4"><input className="border rounded-lg px-3 py-2 bg-zinc-900 border-green-600 focus:border-green-400 transition w-48 text-lg" value={r.name} onChange={e => setRow(i, { name: e.target.value })} /></td>
                    <td className="p-4"><input type="number" className="border rounded-lg px-3 py-2 bg-zinc-900 border-green-600 focus:border-green-400 transition w-24 text-lg" value={r.qty} onChange={e => setRow(i, { qty: Number(e.target.value) })} /></td>
                    <td className="p-4 tabular-nums">{formatGold(unit)}</td>
                    <td className="p-4 tabular-nums font-bold">{formatGold(totalRow)}</td>
                  </tr>
                );
              })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border border-green-600 rounded-2xl p-6 bg-green-950 shadow-xl mt-8">
            <div className="text-green-200 text-xl">Valeur totale estimée</div>
            <div className="text-3xl font-extrabold tabular-nums text-green-400 flex items-center gap-3">
              <WalletIcon className="w-8 h-8" />
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
