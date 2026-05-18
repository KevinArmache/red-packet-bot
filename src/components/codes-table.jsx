"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
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
  Loader2,
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
  unverified: {
    label: "Nouveau",
    variant: "secondary",
    icon: Clock,
    rowClass: "",
  },
  claiming: {
    label: "En cours...",
    variant: "outline",
    icon: Spinner,
    rowClass: "animate-pulse bg-purple-50/50 dark:bg-purple-950/20",
  },
  claimed: {
    label: "Succès ✓",
    variant: "default",
    icon: CircleCheck,
    rowClass: "bg-emerald-50/50 dark:bg-emerald-950/20",
  },
  empty: {
    label: "Vide/Utilisé",
    variant: "secondary",
    icon: CircleX,
    rowClass: "opacity-60",
  },
  invalid: {
    label: "Invalide",
    variant: "destructive",
    icon: CircleX,
    rowClass: "opacity-60",
  },
  failed: {
    label: "Erreur",
    variant: "destructive",
    icon: CircleX,
    rowClass: "opacity-60",
  },
  expired: {
    label: "Expiré",
    variant: "secondary",
    icon: AlertTriangle,
    rowClass: "opacity-60",
  },
};

export function CodesTable({ codes }) {
  const router = useRouter();
  const [copiedId, setCopiedId] = useState(null);
  const [claimingId, setClaimingId] = useState(null);
  const [isPending, startTransition] = useTransition();

  // Polling via /api/status — léger et non bloquant
  useEffect(() => {
    let tickCount = 0;

    const checkAndRefresh = async () => {
      tickCount++;
      try {
        const res = await fetch("/api/status", { cache: "no-store" });
        if (!res.ok) return;
        const { botStatus, hasActiveCodes } = await res.json();

        // Rafraîchir l'UI uniquement si nécessaire
        if (botStatus !== "idle" || hasActiveCodes) {
          router.refresh();
        } else if (tickCount % 4 === 0) {
          // En veille : rafraîchir toutes les 8s (4 ticks × 2s)
          router.refresh();
        }
      } catch {
        // Ignorer les erreurs réseau silencieusement
      }
    };

    const interval = setInterval(checkAndRefresh, 2000);
    return () => clearInterval(interval);
  }, [router]);

  const copyToClipboard = useCallback(async (code, id) => {
    await navigator.clipboard.writeText(code);
    setCopiedId(id);
    toast.success("Code copié !");
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleDelete = useCallback(
    (id) => {
      startTransition(async () => {
        const result = await deleteCode(id);
        if (result.success) {
          toast.success("Code supprimé");
        } else {
          toast.error("Erreur lors de la suppression");
        }
      });
    },
    [startTransition]
  );

  const handleClaim = useCallback(
    (id) => {
      setClaimingId(id);
      startTransition(async () => {
        const result = await claimCode(id);
        setClaimingId(null);
        if (result.success) {
          const stablecoins = ["USDT", "BUSD", "USDC", "FDUSD"];
          const estUsd =
            stablecoins.includes(result.token) ? ` (~$${result.amount} USD)` : "";
          toast.success(`🎉 Réclamé : ${result.amount} ${result.token}${estUsd}`);
        } else {
          const errorMsg = result.error || "Échec du claim";
          toast.error("Erreur", {
            description:
              errorMsg.length > 120
                ? errorMsg.substring(0, 120) + "..."
                : errorMsg,
            action: {
              label: "Copier",
              onClick: () => {
                navigator.clipboard.writeText(errorMsg);
                toast.success("Erreur copiée !");
              },
            },
            duration: 10000,
          });
        }
      });
    },
    [startTransition]
  );

  if (codes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-muted">
          <RefreshCw className="size-7 text-muted-foreground" />
        </div>
        <h3 className="mt-4 text-lg font-semibold">Aucun code détecté</h3>
        <p className="mt-2 text-sm text-muted-foreground max-w-sm">
          Activez le scraping automatique et ajoutez des comptes à surveiller dans les paramètres.
          Les codes apparaîtront ici automatiquement.
        </p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-[160px] font-semibold">Code</TableHead>
              <TableHead className="font-semibold">Tweet</TableHead>
              <TableHead className="w-[110px] font-semibold">Auteur</TableHead>
              <TableHead className="w-[110px] font-semibold">Détecté</TableHead>
              <TableHead className="w-[130px] font-semibold">Statut</TableHead>
              <TableHead className="text-right w-[160px] font-semibold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {codes.map((code) => {
              const status = statusConfig[code.status] ?? statusConfig.unverified;
              const StatusIcon = status.icon;

              return (
                <TableRow
                  key={code.id}
                  className={cn(status.rowClass, "transition-colors duration-300")}
                >
                  {/* Code */}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <code className="rounded bg-muted px-2 py-1 font-mono text-xs font-semibold tracking-wider">
                        {code.code}
                      </code>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6 shrink-0"
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

                  {/* Tweet */}
                  <TableCell className="max-w-[220px]">
                    <p className="truncate text-xs text-muted-foreground">
                      {code.tweet_text || "—"}
                    </p>
                  </TableCell>

                  {/* Auteur */}
                  <TableCell>
                    <span className="text-sm font-medium">
                      @{code.author?.replace(/^@+/, "") ?? "inconnu"}
                    </span>
                  </TableCell>

                  {/* Date de détection */}
                  <TableCell>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          className="text-xs text-muted-foreground cursor-default"
                          suppressHydrationWarning
                        >
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

                  {/* Statut */}
                  <TableCell>
                    <Badge variant={status.variant} className="gap-1.5 font-medium">
                      <StatusIcon className="size-3" />
                      {status.label}
                    </Badge>
                    {code.claimed_amount > 0 && code.claimed_asset && (
                      <div className="mt-1 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                        +{code.claimed_amount} {code.claimed_asset}
                      </div>
                    )}
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {code.status === "unverified" && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              onClick={() => handleClaim(code.id)}
                              disabled={claimingId === code.id || isPending}
                              className="gap-1.5"
                            >
                              {claimingId === code.id ? (
                                <>
                                  <Loader2 className="size-3 animate-spin" />
                                  En cours...
                                </>
                              ) : (
                                "Claim"
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Réclamer ce code manuellement</TooltipContent>
                        </Tooltip>
                      )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-destructive hover:bg-destructive/10"
                            onClick={() => handleDelete(code.id)}
                            disabled={isPending}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Supprimer ce code</TooltipContent>
                      </Tooltip>
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

// Helper pour cn (évite l'import si déjà global)
function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}
