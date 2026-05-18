"use client";

import { useEffect, useState } from "react";
import { Activity, Search, Cpu, Wifi, WifiOff, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_CONFIG = {
  idle: {
    color: "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 backdrop-blur-md",
    indicatorColor: "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]",
    title: "Robot en veille",
    description: "Prêt à intercepter les Red Packets. Le prochain cycle démarrera automatiquement.",
    icon: Activity,
    pulse: false,
    bgGradient: "bg-gradient-to-r from-emerald-500/5 to-transparent",
  },
  scraping: {
    color: "bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-400 backdrop-blur-md",
    indicatorColor: "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)]",
    title: "Scraping en cours...",
    description: "Recherche active de codes sur les réseaux via Nitter.",
    icon: Search,
    pulse: true,
    iconClass: "animate-spin-slow",
    bgGradient: "bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent",
  },
  claiming: {
    color: "bg-purple-500/10 border-purple-500/40 text-purple-700 dark:text-purple-400 backdrop-blur-md",
    indicatorColor: "bg-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.8)]",
    title: "Réclamation automatique !",
    description: "Playwright réclame activement les codes Red Packet sur Binance.",
    icon: Cpu,
    pulse: true,
    iconClass: "animate-pulse",
    bgGradient: "bg-gradient-to-r from-purple-500/20 via-purple-500/5 to-transparent",
  },
};

export function BotStatusBanner() {
  const [status, setStatus] = useState("idle");
  const [stats, setStats] = useState({ total: 0, unverified: 0, claiming: 0, claimed: 0 });
  const [connected, setConnected] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch("/api/status", { cache: "no-store" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data = await res.json();
        setStatus(data.botStatus || "idle");
        setStats(data.stats || {});
        setConnected(true);
      } catch {
        setConnected(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  const current = STATUS_CONFIG[status] || STATUS_CONFIG.idle;
  const Icon = current.icon;

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Background animatif */}
      {status !== "idle" && (
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <div className="absolute -inset-[100%] animate-[spin_4s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,rgba(0,0,0,0)_0%,rgba(255,255,255,0.05)_50%,rgba(0,0,0,0)_100%)] dark:bg-[conic-gradient(from_90deg_at_50%_50%,rgba(0,0,0,0)_0%,rgba(255,255,255,0.05)_50%,rgba(0,0,0,0)_100%)] opacity-50" />
        </div>
      )}

      <div
        className={cn(
          "relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 transition-all duration-500 border",
          current.color,
          current.bgGradient
        )}
      >
        {/* Indicateur + Icône + Texte */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {/* Indicateur pulsant (glow effect) */}
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

          {/* Icône avec background glass */}
          <div className="flex shrink-0 size-12 items-center justify-center rounded-xl bg-background/50 backdrop-blur-md shadow-inner border border-white/10 dark:border-white/5">
            <Icon className={cn("size-6", current.iconClass)} />
          </div>

          {/* Texte */}
          <div className="min-w-0">
            <h3 className="text-lg font-semibold leading-none tracking-tight flex items-center gap-2">
              {current.title}
              {status === "claiming" && <Sparkles className="size-4 text-amber-400 animate-pulse" />}
            </h3>
            <p className="mt-1.5 text-sm opacity-90 font-light leading-tight truncate max-w-xl">
              {current.description}
            </p>
          </div>
        </div>

        {/* Statistiques + Connectivité */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {/* Stats rapides */}
          {stats.total > 0 && (
            <div className="flex items-center gap-2 text-xs font-medium">
              {stats.unverified > 0 && (
                <span className="bg-amber-500/20 border border-amber-500/30 rounded-full px-3 py-1 text-amber-700 dark:text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                  {stats.unverified} en attente
                </span>
              )}
              {stats.claiming > 0 && (
                <span className="bg-purple-500/20 border border-purple-500/30 rounded-full px-3 py-1 text-purple-700 dark:text-purple-300 animate-pulse shadow-[0_0_10px_rgba(168,85,247,0.2)]">
                  {stats.claiming} en cours
                </span>
              )}
            </div>
          )}

          {/* Indicateur de connexion */}
          <div
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border backdrop-blur-sm",
              connected
                ? "bg-background/40 text-muted-foreground border-white/10"
                : "bg-red-500/20 text-red-600 border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.2)]"
            )}
          >
            {connected ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
            {connected ? "En ligne" : "Hors ligne"}
          </div>
        </div>
      </div>
    </div>
  );
}
