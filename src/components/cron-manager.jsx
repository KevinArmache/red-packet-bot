"use client";

import { useState, useEffect, useRef } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { runCronWorkflow, claimCode, getCodes } from "@/app/actions";
import { toast } from "sonner";

export function CronManager() {
  const [isActive, setIsActive] = useState(false);
  const [lastRun, setLastRun] = useState(null);
  const intervalRef = useRef(null);
  const runningRef = useRef(false);

  // Exécution du workflow: Scrape -> Cleanup -> Claim all
  const executeCron = async () => {
    if (runningRef.current) return;
    runningRef.current = true;

    try {
      toast.info("🔄 Cron: Début du cycle (Scraping...)");
      await runCronWorkflow();
      
      // Récupérer les codes à jour
      const codes = await getCodes();
      const claimable = codes.filter(c => c.status === "unverified");
      
      if (claimable.length > 0) {
        toast.info(`🔄 Cron: ${claimable.length} codes à réclamer...`);
        for (let i = 0; i < claimable.length; i++) {
          if (!isActive) break; // Si l'utilisateur désactive entre temps
          
          const code = claimable[i];
          const result = await claimCode(code.id);
          
          if (result.success) {
            toast.success(`🎉 Cron: Réclamé ${result.amount} ${result.token}`);
          }
          
          if (i < claimable.length - 1) {
            await new Promise(r => setTimeout(r, 5000));
          }
        }
      }
      
      setLastRun(new Date());
      toast.success("✅ Cron: Cycle terminé");
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
      
      // Puis toutes les 5 minutes (300000 ms)
      intervalRef.current = setInterval(() => {
        executeCron();
      }, 5 * 60 * 1000);
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
  }, [isActive]);

  return (
    <div className="flex items-center space-x-2 border rounded-md p-2 bg-muted/20">
      <Switch 
        id="cron-mode" 
        checked={isActive} 
        onCheckedChange={setIsActive} 
      />
      <Label htmlFor="cron-mode" className="flex flex-col cursor-pointer">
        <span className="font-medium flex items-center gap-2">
          <span className={`size-2 rounded-full ${isActive ? "bg-green-500 animate-pulse" : "bg-muted-foreground"}`}></span>
          Auto-Claim (5 min)
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
