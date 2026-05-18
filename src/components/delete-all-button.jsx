"use client";

import { useTransition, useState } from "react";
import { Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { deleteAllCodes } from "@/app/actions";
import { toast } from "sonner";

export function DeleteAllButton({ codesCount }) {
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  const handleDeleteAll = () => {
    if (!confirming) {
      setConfirming(true);
      // Réinitialiser la confirmation après 4 secondes
      setTimeout(() => setConfirming(false), 4000);
      return;
    }

    startTransition(async () => {
      try {
        const result = await deleteAllCodes();
        if (result.success) {
          toast.success(`Succès : ${result.count} codes supprimés.`);
        } else {
          toast.error("Erreur lors de la suppression.");
        }
      } catch (err) {
        toast.error("Une erreur s'est produite.");
      } finally {
        setConfirming(false);
      }
    });
  };

  return (
    <Button 
      variant={confirming ? "destructive" : "outline"} 
      onClick={handleDeleteAll} 
      disabled={isPending || codesCount === 0}
      className={`gap-2 transition-all duration-300 ${confirming ? 'animate-pulse' : 'text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20'}`}
    >
      {isPending ? (
        <Spinner className="size-4" />
      ) : confirming ? (
        <AlertTriangle className="size-4" />
      ) : (
        <Trash2 className="size-4" />
      )}
      {isPending ? "Suppression..." : confirming ? "Confirmer ?" : `Tout supprimer (${codesCount})`}
    </Button>
  );
}
