"use client";

import { useState, useEffect, useRef } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { runCronWorkflow, toggleScraping } from "@/app/actions";
import { toast } from "sonner";

export function CronManager({ scrapingEnabled, intervalMinutes = 5 }) {
  const [isActive, setIsActive] = useState(scrapingEnabled);
  const [lastRun, setLastRun] = useState(null);
  const intervalRef = useRef(null);
  const runningRef = useRef(false);

  // Synchroniser l'état local avec les props (lorsque changées depuis les settings)
  useEffect(() => {
    setIsActive(scrapingEnabled);
  }, [scrapingEnabled]);

  // Exécution du workflow: Scrape -> Cleanup
  const executeCron = async () => {
    if (runningRef.current) return;
    runningRef.current = true;

    try {
      toast.info("🔄 Cron: Début du cycle (Scraping...)");
      await runCronWorkflow();
      
      setLastRun(new Date());
      toast.success("✅ Cron: Scraping et nettoyage terminés");
    } catch (error) {
      console.error(error);
      toast.error("❌ Cron: Erreur lors de l'exécution");
    } finally {
      runningRef.current = false;
    }
  };

  useEffect(() => {
    if (isActive) {
      // Exécuter tout de suite lors de l'activation
      executeCron();
      
      // Puis toutes les X minutes
      intervalRef.current = setInterval(() => {
        executeCron();
      }, intervalMinutes * 60 * 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isActive, intervalMinutes]);

  const handleToggle = async (checked) => {
    setIsActive(checked);
    try {
      await toggleScraping(checked);
      toast.success(checked ? "Auto-Scrape activé" : "Auto-Scrape désactivé");
    } catch (err) {
      toast.error("Impossible de sauvegarder le paramètre");
      setIsActive(!checked);
    }
  };

  return (
    <div className="flex items-center space-x-2 border rounded-md p-2 bg-muted/20">
      <Switch 
        id="cron-mode" 
        checked={isActive} 
        onCheckedChange={handleToggle} 
      />
      <Label htmlFor="cron-mode" className="flex flex-col cursor-pointer">
        <span className="font-medium flex items-center gap-2">
          <span className={`size-2 rounded-full ${isActive ? "bg-green-500 animate-pulse" : "bg-muted-foreground"}`}></span>
          Auto-Scrape ({intervalMinutes} min)
        </span>
        {lastRun && (
          <span className="text-[10px] text-muted-foreground font-normal">
            Dernier : {lastRun.toLocaleTimeString()}
          </span>
        )}
      </Label>
    </div>
  );
}
