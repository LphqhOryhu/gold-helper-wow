"use client";

import Link from "next/link";
import { MagnifyingGlassIcon, UserCircleIcon, WalletIcon } from '@heroicons/react/24/solid';

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full bg-zinc-950 py-12">
      <div className="w-[2200px] mx-auto bg-zinc-900 rounded-2xl shadow-2xl px-24 py-24 border border-zinc-800">
        <h1 className="text-6xl font-extrabold mb-16 text-center text-gradient bg-gradient-to-r from-blue-400 via-yellow-400 to-green-400 bg-clip-text text-transparent drop-shadow-lg">Bienvenue sur Gold Helper WoW</h1>
        <div className="grid grid-cols-3 gap-24 w-full">
          <Link href="/ah-search" className="group bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 border border-blue-600 rounded-2xl shadow-2xl p-16 flex flex-col items-center gap-8 hover:scale-105 hover:shadow-blue-500/40 transition-all duration-300">
            <MagnifyingGlassIcon className="w-20 h-20 text-blue-400 group-hover:scale-125 transition-transform duration-300" />
            <span className="text-3xl font-bold">Recherche AH</span>
            <span className="text-blue-200 text-center text-2xl">Trouve le prix et la quantité d’un objet sur l’hôtel des ventes.</span>
          </Link>
          <Link href="/characters" className="group bg-gradient-to-br from-yellow-900 via-yellow-800 to-yellow-700 border border-yellow-500 rounded-2xl shadow-2xl p-16 flex flex-col items-center gap-8 hover:scale-105 hover:shadow-yellow-400/40 transition-all duration-300">
            <UserCircleIcon className="w-20 h-20 text-yellow-400 group-hover:scale-125 transition-transform duration-300" />
            <span className="text-3xl font-bold">Personnages</span>
            <span className="text-yellow-200 text-center text-2xl">Gère et visualise l’or de tes différents personnages.</span>
          </Link>
          <Link href="/wallet" className="group bg-gradient-to-br from-green-900 via-green-800 to-green-700 border border-green-500 rounded-2xl shadow-2xl p-16 flex flex-col items-center gap-8 hover:scale-105 hover:shadow-green-400/40 transition-all duration-300">
            <WalletIcon className="w-20 h-20 text-green-400 group-hover:scale-125 transition-transform duration-300" />
            <span className="text-3xl font-bold">Inventaire</span>
            <span className="text-green-200 text-center text-2xl">Estime la valeur de ton inventaire en or.</span>
          </Link>
        </div>
      </div>
      <style jsx global>{`
        .text-gradient { background-clip: text; -webkit-background-clip: text; color: transparent; }
      `}</style>
    </div>
  );
}
