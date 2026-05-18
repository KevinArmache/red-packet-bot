"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { purgeOldCodes } from "@/app/actions";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function DangerZone() {
  const [isPending, startTransition] = useTransition();

  const handlePurge = () => {
    startTransition(async () => {
      try {
        const result = await purgeOldCodes();
        if (result.success) {
          if (result.count > 0) {
            toast.success(`Nettoyage réussi : ${result.count} code(s) mort(s) supprimé(s).`);
          } else {
            toast.info("La base de données est déjà propre.");
          }
        } else {
          toast.error("Erreur lors du nettoyage.");
        }
      } catch (error) {
        toast.error("Une erreur s'est produite.");
      }
    });
  };

  return (
    <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 mt-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold flex items-center gap-2 text-red-500">
            <AlertTriangle className="size-4" />
            Nettoyage de la base de données
          </h4>
          <p className="text-xs text-muted-foreground mt-1 max-w-xl">
            Supprime définitivement tous les codes inactifs (Invalides, Expirés, Vides, Déjà réclamés) pour alléger le fichier de stockage.
          </p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" className="whitespace-nowrap group">
              {isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 size-4 group-hover:animate-bounce" />
              )}
              Purger les vieux codes
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="border-red-500/20">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-red-500 flex items-center gap-2">
                <AlertTriangle className="size-5" />
                Êtes-vous sûr ?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Cette action supprimera définitivement tous les codes ayant échoué ou déjà réclamés. 
                Les codes en attente ou en cours de réclamation ne seront pas affectés.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={handlePurge}
                className="bg-red-500 hover:bg-red-600 text-white"
              >
                Confirmer la purge
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
