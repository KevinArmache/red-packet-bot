"use client";

import { useState, useEffect, useRef } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { runCronWorkflow, toggleScraping } from "@/app/actions";
import { toast } from "sonner";
import { Play, Square } from "lucide-react";

export function CronManager({ scrapingEnabled, intervalMinutes = 5 }) {
  const [isActive, setIsActive] = useState(scrapingEnabled);
  const [lastRun, setLastRun] = useState(null);
  const [nextRunIn, setNextRunIn] = useState(null);
  const intervalRef = useRef(null);
  const countdownRef = useRef(null);
  const runningRef = useRef(false);

  // Synchroniser avec les props (changement depuis les settings)
  useEffect(() => {
    setIsActive(scrapingEnabled);
  }, [scrapingEnabled]);

  // Lancer le workflow complet (non-bloquant)
  const executeCron = async () => {
    if (runningRef.current) return;
    runningRef.current = true;

    try {
      toast.info("🔍 Démarrage du cycle de scraping...", { duration: 3000 });
      const result = await runCronWorkflow();

      setLastRun(new Date());
      setNextRunIn(intervalMinutes * 60);

      if (result?.success) {
        toast.success("✅ Cycle lancé — Scraping + Claim en arrière-plan", { duration: 4000 });
      } else if (result?.error === "Le bot est déjà actif") {
        toast.warning("⚡ Le bot travaille déjà, cycle ignoré");
      } else {
        toast.error(`❌ Erreur : ${result?.error || "Inconnue"}`);
      }
    } catch (error) {
      console.error("[CronManager] Erreur:", error);
      toast.error("❌ Impossible de lancer le cycle");
    } finally {
      runningRef.current = false;
    }
  };

  // Décompte vers le prochain cycle
  useEffect(() => {
    if (!isActive || nextRunIn === null) {
      if (countdownRef.current) clearInterval(countdownRef.current);
      return;
    }
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setNextRunIn((prev) => {
        if (prev <= 1) return intervalMinutes * 60;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(countdownRef.current);
  }, [isActive, nextRunIn, intervalMinutes]);

  // Gestion du cycle automatique
  useEffect(() => {
    if (isActive) {
      executeCron();
      intervalRef.current = setInterval(executeCron, intervalMinutes * 60 * 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setNextRunIn(null);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, intervalMinutes]);

  const handleToggle = async (checked) => {
    setIsActive(checked);
    try {
      await toggleScraping(checked);
      toast.success(checked ? "🟢 Auto-Scrape activé" : "⏸️ Auto-Scrape arrêté");
    } catch {
      toast.error("Impossible de sauvegarder le paramètre");
      setIsActive(!checked);
    }
  };

  const formatCountdown = (seconds) => {
    if (!seconds) return "";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  return (
    <div className="flex items-center space-x-2.5 border rounded-lg p-2.5 bg-muted/20 hover:bg-muted/30 transition-colors">
      <Switch
        id="cron-mode"
        checked={isActive}
        onCheckedChange={handleToggle}
      />
      <Label htmlFor="cron-mode" className="flex flex-col cursor-pointer gap-0.5">
        <span className="font-medium flex items-center gap-2 text-sm">
          <span
            className={`size-2 rounded-full transition-colors ${
              isActive ? "bg-green-500 animate-pulse" : "bg-muted-foreground"
            }`}
          />
          {isActive ? (
            <span className="flex items-center gap-1">
              <Play className="size-3" />
              Auto ({intervalMinutes} min)
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <Square className="size-3" />
              Arrêté
            </span>
          )}
        </span>
        <span className="text-[10px] text-muted-foreground font-normal leading-none">
          {lastRun && !nextRunIn && `Dernier : ${lastRun.toLocaleTimeString()}`}
          {isActive && nextRunIn && `Prochain dans : ${formatCountdown(nextRunIn)}`}
        </span>
      </Label>
    </div>
  );
}
