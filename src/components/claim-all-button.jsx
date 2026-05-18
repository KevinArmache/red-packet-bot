"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Play, Square } from "lucide-react";
import { claimCode } from "@/app/actions";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";

export function ClaimAllButton({ codes }) {
  const [isRunning, setIsRunning] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalToClaim, setTotalToClaim] = useState(0);

  const claimableCodes = codes.filter(
    (c) => c.status === "unverified"
  );

  const handleStart = async () => {
    if (claimableCodes.length === 0) {
      toast.info("Aucun code à réclamer");
      return;
    }

    setIsRunning(true);
    setTotalToClaim(claimableCodes.length);
    setCurrentIndex(0);

    for (let i = 0; i < claimableCodes.length; i++) {
      // Check if user stopped it
      if (!document.getElementById("claim-all-running-flag")) {
        break; // A way to break if stopped, though state updates are async
      }
      
      setCurrentIndex(i + 1);
      const code = claimableCodes[i];
      
      toast.info(`Réclamation du code ${i + 1}/${claimableCodes.length}...`);
      
      const result = await claimCode(code.id);
      
      if (result.success) {
        const estUsd = ["USDT", "BUSD", "USDC", "FDUSD"].includes(result.token) 
          ? `(~$${result.amount} USD)` 
          : "";
        toast.success(`🎉 Réclamé : ${result.amount} ${result.token} ${estUsd}`);
      } else {
        toast.error(`❌ Échec pour ${code.code}: ${result.error}`);
      }

      // Attendre 5 secondes avant le prochain, sauf pour le dernier
      if (i < claimableCodes.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }

    setIsRunning(false);
    toast.success("✅ Processus terminé");
  };

  const handleStop = () => {
    setIsRunning(false);
  };

  if (isRunning) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground hidden md:inline" id="claim-all-running-flag">
          Réclamation en cours ({currentIndex}/{totalToClaim})...
        </span>
        <Button variant="destructive" onClick={handleStop} size="sm" className="gap-2">
          <Square className="size-4" />
          Stop
        </Button>
      </div>
    );
  }

  return (
    <Button 
      onClick={handleStart} 
      disabled={claimableCodes.length === 0}
      className="gap-2 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white border-0"
    >
      <Play className="size-4" />
      Tout réclamer ({claimableCodes.length})
    </Button>
  );
}
