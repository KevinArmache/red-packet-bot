"use client";

import { useState, useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Copy,
  Check,
  RefreshCw,
  CircleCheck,
  CircleX,
  Clock,
  AlertTriangle,
  Trash2,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { claimCode, deleteCode } from "@/app/actions";
import { toast } from "sonner";

const statusConfig = {
  unverified: { label: "Nouveau", variant: "secondary", icon: Clock },
  claimed: { label: "Succès", variant: "default", icon: CircleCheck },
  empty: { label: "Vide/Utilisé", variant: "secondary", icon: CircleX },
  invalid: { label: "Invalide", variant: "destructive", icon: CircleX },
  failed: { label: "Erreur", variant: "destructive", icon: CircleX },
  expired: { label: "Expiré", variant: "secondary", icon: AlertTriangle },
};

export function CodesTable({ codes }) {
  const [copiedId, setCopiedId] = useState(null);
  const [claimingId, setClaimingId] = useState(null);
  const [isPending, startTransition] = useTransition();

  const copyToClipboard = async (code, id) => {
    await navigator.clipboard.writeText(code);
    setCopiedId(id);
    toast.success("Code copié !");
    setTimeout(() => setCopiedId(null), 2000);
  };



  const handleDelete = async (id) => {
    startTransition(async () => {
      const result = await deleteCode(id);
      if (result.success) {
        toast.success("Code supprimé");
      } else {
        toast.error("Erreur lors de la suppression");
      }
    });
  };

  const handleClaim = async (id) => {
    setClaimingId(id);
    startTransition(async () => {
      const result = await claimCode(id);
      setClaimingId(null);
      if (result.success) {
        // Estimation basique en USD
        const stablecoins = ["USDT", "BUSD", "USDC", "FDUSD"];
        const estUsd = stablecoins.includes(result.token) 
          ? `(~$${result.amount} USD)` 
          : "";
        toast.success(`🎉 Réclamé : ${result.amount} ${result.token} ${estUsd}`);
      } else {
        const errorMsg = result.error || "Échec du claim";
        toast.error("Erreur", {
          description: errorMsg.length > 100 ? errorMsg.substring(0, 100) + "..." : errorMsg,
          action: {
            label: "Copier l'erreur",
            onClick: () => {
              navigator.clipboard.writeText(errorMsg);
              toast.success("Erreur copiée !");
            }
          },
          duration: 10000,
        });
      }
    });
  };

  if (codes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <RefreshCw className="size-6 text-muted-foreground" />
        </div>
        <h3 className="mt-4 text-lg font-semibold">Aucun code détecté</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Ajoutez des comptes à surveiller ou ajoutez des codes manuellement.
        </p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[170px]">Code</TableHead>
              <TableHead>Tweet</TableHead>
              <TableHead className="w-[100px]">Auteur</TableHead>
              <TableHead className="w-[110px]">Détecté</TableHead>
              <TableHead className="w-[120px]">Statut</TableHead>
              <TableHead className="text-right w-[160px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {codes.map((code) => {
              const status =
                statusConfig[code.status] ?? statusConfig.unverified;
              const StatusIcon = status.icon;

              return (
                <TableRow key={code.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <code className="rounded bg-muted px-2 py-1 font-mono text-xs">
                        {code.code}
                      </code>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6"
                            onClick={() => copyToClipboard(code.code, code.id)}
                          >
                            {copiedId === code.id ? (
                              <Check className="size-3 text-green-500" />
                            ) : (
                              <Copy className="size-3" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Copier le code</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[250px]">
                    <p className="truncate text-xs text-muted-foreground">
                      {code.tweet_text || "—"}
                    </p>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      @{code.author?.replace(/^@+/, "") ?? "inconnu"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-xs text-muted-foreground cursor-default" suppressHydrationWarning>
                          {code.detected_at
                            ? formatDistanceToNow(new Date(code.detected_at), {
                                addSuffix: true,
                                locale: fr,
                              })
                            : "—"}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {code.detected_at
                          ? new Date(code.detected_at).toLocaleString("fr-FR")
                          : "Inconnue"}
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Badge variant={status.variant} className="gap-1">
                      <StatusIcon className="size-3" />
                      {status.label}
                    </Badge>
                    {code.claimed_amount && code.claimed_asset && (
                      <div className="mt-1 text-xs text-green-600 font-medium">
                        +{code.claimed_amount} {code.claimed_asset}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">

                      {code.status === "unverified" && (
                        <Button
                          size="sm"
                          onClick={() => handleClaim(code.id)}
                          disabled={claimingId === code.id || isPending}
                        >
                          {claimingId === code.id ? (
                            <Spinner className="size-3" />
                          ) : (
                            "Claim"
                          )}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(code.id)}
                        disabled={isPending}
                        title="Supprimer ce code"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
}
