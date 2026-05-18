"use client";

import { useEffect, useState } from "react";
import { Activity, Search, Cpu, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_CONFIG = {
  idle: {
    color: "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400",
    indicatorColor: "bg-emerald-500",
    title: "Robot en veille",
    description: "Prêt à intercepter les Red Packets. Le prochain cycle démarrera automatiquement.",
    icon: Activity,
    pulse: false,
  },
  scraping: {
    color: "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400",
    indicatorColor: "bg-amber-500",
    title: "Scraping en cours...",
    description: "Analyse active des tweets sur tous les comptes surveillés via Nitter.",
    icon: Search,
    pulse: true,
    iconClass: "animate-spin",
  },
  claiming: {
    color: "bg-purple-500/10 border-purple-500/30 text-purple-700 dark:text-purple-400",
    indicatorColor: "bg-purple-500",
    title: "Réclamation automatique !",
    description: "Playwright réclame les codes Red Packet sur Binance en temps réel.",
    icon: Cpu,
    pulse: true,
    iconClass: "animate-pulse",
  },
};

export function BotStatusBanner() {
  const [status, setStatus] = useState("idle");
  const [stats, setStats] = useState({ total: 0, unverified: 0, claiming: 0, claimed: 0 });
  const [connected, setConnected] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch("/api/status", { cache: "no-store" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data = await res.json();
        setStatus(data.botStatus || "idle");
        setStats(data.stats || {});
        setConnected(true);
        setLastUpdate(new Date());
      } catch {
        setConnected(false);
      }
    };

    fetchStatus();
    // Polling toutes les 2s : ultra-réactif pendant l'activité
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  const current = STATUS_CONFIG[status] || STATUS_CONFIG.idle;
  const Icon = current.icon;

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border p-4 transition-all duration-500 shadow-sm",
        current.color
      )}
    >
      {/* Indicateur + Icône + Texte */}
      <div className="flex items-center gap-4 flex-1 min-w-0">
        {/* Indicateur pulsant */}
        <div className="relative flex shrink-0 size-3">
          {current.pulse && (
            <span
              className={cn(
                "absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping",
                current.indicatorColor
              )}
            />
          )}
          <span className={cn("relative inline-flex size-3 rounded-full", current.indicatorColor)} />
        </div>

        {/* Icône */}
        <div className="flex shrink-0 size-10 items-center justify-center rounded-lg bg-background/80 shadow-sm border border-border/40">
          <Icon className={cn("size-5", current.iconClass)} />
        </div>

        {/* Texte */}
        <div className="min-w-0">
          <h3 className="font-semibold leading-none tracking-tight">{current.title}</h3>
          <p className="mt-1.5 text-xs opacity-90 font-normal leading-tight truncate">
            {current.description}
          </p>
        </div>
      </div>

      {/* Statistiques + Connectivité */}
      <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
        {/* Stats rapides */}
        {stats.total > 0 && (
          <div className="flex items-center gap-1.5 text-[11px] font-medium opacity-80">
            <span className="bg-background/60 border rounded-full px-2 py-0.5">
              {stats.total} code(s)
            </span>
            {stats.unverified > 0 && (
              <span className="bg-amber-100 dark:bg-amber-900/40 border border-amber-300 rounded-full px-2 py-0.5 text-amber-700 dark:text-amber-300">
                {stats.unverified} en attente
              </span>
            )}
            {stats.claiming > 0 && (
              <span className="bg-purple-100 dark:bg-purple-900/40 border border-purple-300 rounded-full px-2 py-0.5 text-purple-700 dark:text-purple-300 animate-pulse">
                {stats.claiming} en cours
              </span>
            )}
          </div>
        )}

        {/* Indicateur de connexion */}
        <div
          className={cn(
            "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium border",
            connected
              ? "bg-background/60 text-muted-foreground"
              : "bg-red-100 dark:bg-red-900/30 text-red-600 border-red-300"
          )}
        >
          {connected ? <Wifi className="size-3" /> : <WifiOff className="size-3" />}
          {connected ? "Synchronisé" : "Hors ligne"}
        </div>

        {/* Tâche de fond active */}
        {status !== "idle" && (
          <div className="flex items-center gap-1 rounded-full px-2.5 py-1 bg-background/60 border text-[11px] font-medium animate-pulse">
            <span className="size-1.5 rounded-full bg-primary" />
            Tâche active
          </div>
        )}
      </div>
    </div>
  );
}
