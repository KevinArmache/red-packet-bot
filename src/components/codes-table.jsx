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
  Sparkles,
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { claimCode, deleteCode } from "@/app/actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const statusConfig = {
  unverified: {
    label: "Nouveau",
    badgeClass: "bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.2)]",
    icon: Clock,
    rowClass: "bg-background hover:bg-muted/50",
  },
  claiming: {
    label: "En cours...",
    badgeClass: "bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/30 animate-pulse shadow-[0_0_10px_rgba(168,85,247,0.2)]",
    icon: Loader2,
    rowClass: "bg-purple-500/5 hover:bg-purple-500/10",
  },
  claimed: {
    label: "Succès ✓",
    badgeClass: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]",
    icon: CircleCheck,
    rowClass: "bg-emerald-500/5 hover:bg-emerald-500/10",
  },
  empty: {
    label: "Vide/Utilisé",
    badgeClass: "bg-zinc-500/20 text-zinc-600 dark:text-zinc-400 border border-zinc-500/30",
    icon: CircleX,
    rowClass: "opacity-60 bg-background hover:bg-muted/50",
  },
  invalid: {
    label: "Invalide",
    badgeClass: "bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30",
    icon: CircleX,
    rowClass: "opacity-60 bg-background hover:bg-muted/50",
  },
  failed: {
    label: "Erreur",
    badgeClass: "bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30",
    icon: CircleX,
    rowClass: "opacity-60 bg-background hover:bg-muted/50",
  },
  expired: {
    label: "Expiré",
    badgeClass: "bg-zinc-500/20 text-zinc-600 dark:text-zinc-400 border border-zinc-500/30",
    icon: AlertTriangle,
    rowClass: "opacity-60 bg-background hover:bg-muted/50",
  },
};

export function CodesTable({ codes }) {
  const router = useRouter();
  const [copiedId, setCopiedId] = useState(null);
  const [claimingId, setClaimingId] = useState(null);
  const [isPending, startTransition] = useTransition();
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Polling via /api/status — ultra léger
  useEffect(() => {
    let tickCount = 0;

    const checkAndRefresh = async () => {
      tickCount++;
      try {
        const res = await fetch("/api/status", { cache: "no-store" });
        if (!res.ok) return;
        const { botStatus, hasActiveCodes } = await res.json();

        if (botStatus !== "idle" || hasActiveCodes) {
          router.refresh();
        } else if (tickCount % 4 === 0) {
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
          const estUsd = stablecoins.includes(result.token) ? ` (~$${result.amount} USD)` : "";
          toast.success(`🎉 Réclamé : ${result.amount} ${result.token}${estUsd}`);
        } else {
          const errorMsg = result.error || "Échec du claim";
          toast.error("Erreur", {
            description: errorMsg.length > 120 ? errorMsg.substring(0, 120) + "..." : errorMsg,
          });
        }
      });
    },
    [startTransition]
  );

  if (codes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border-t-0 p-16 text-center">
        <div className="relative flex size-20 items-center justify-center rounded-full bg-muted/50 border border-white/5 shadow-inner mb-6">
          <RefreshCw className="size-8 text-muted-foreground/50" />
          <div className="absolute inset-0 rounded-full border border-primary/20 animate-[spin_10s_linear_infinite]" />
        </div>
        <h3 className="text-xl font-light tracking-tight text-foreground/80">Radar Silencieux</h3>
        <p className="mt-2 text-sm text-muted-foreground max-w-sm font-light">
          Le bot scrute le réseau en attente de nouveaux codes. Rien à signaler pour le moment.
        </p>
      </div>
    );
  }

  const totalPages = Math.ceil(codes.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedCodes = codes.slice(startIndex, startIndex + itemsPerPage);

  return (
    <TooltipProvider>
      <div className="w-full overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-transparent hover:bg-transparent border-b border-border/40">
              <TableHead className="w-[180px] font-medium text-muted-foreground h-12">Code Red Packet</TableHead>
              <TableHead className="font-medium text-muted-foreground h-12 hidden md:table-cell">Source</TableHead>
              <TableHead className="w-[120px] font-medium text-muted-foreground h-12">Auteur</TableHead>
              <TableHead className="w-[120px] font-medium text-muted-foreground h-12">Détecté</TableHead>
              <TableHead className="w-[140px] font-medium text-muted-foreground h-12">Statut</TableHead>
              <TableHead className="text-right w-[120px] font-medium text-muted-foreground h-12 pr-6">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedCodes.map((code) => {
              const status = statusConfig[code.status] ?? statusConfig.unverified;
              const StatusIcon = status.icon;

              return (
                <TableRow
                  key={code.id}
                  className={cn(status.rowClass, "transition-all duration-300 border-b border-border/40 group")}
                >
                  {/* Code */}
                  <TableCell className="pl-4">
                    <div className="flex items-center gap-3">
                      <code className="rounded-md bg-muted/50 px-2.5 py-1 font-mono text-sm tracking-widest font-semibold border border-white/5 group-hover:border-white/10 transition-colors">
                        {code.code}
                      </code>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => copyToClipboard(code.code, code.id)}
                          >
                            {copiedId === code.id ? (
                              <Check className="size-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="size-3.5 text-muted-foreground" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">Copier</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>

                  {/* Tweet */}
                  <TableCell className="max-w-[280px] hidden md:table-cell">
                    <p className="truncate text-xs text-muted-foreground font-light opacity-80 group-hover:opacity-100 transition-opacity">
                      {code.tweet_text || "—"}
                    </p>
                  </TableCell>

                  {/* Auteur */}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="size-5 rounded-full bg-gradient-to-br from-primary/40 to-purple-500/40 flex items-center justify-center text-[9px] font-bold text-white shadow-inner">
                        {code.author ? code.author.charAt(0).toUpperCase() : "?"}
                      </div>
                      <span className="text-xs font-medium text-foreground/80">
                        {code.author?.replace(/^@+/, "") ?? "inconnu"}
                      </span>
                    </div>
                  </TableCell>

                  {/* Date de détection */}
                  <TableCell>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-xs text-muted-foreground font-light cursor-default" suppressHydrationWarning>
                          {code.detected_at
                            ? formatDistanceToNow(new Date(code.detected_at), { addSuffix: true, locale: fr })
                            : "—"}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {code.detected_at ? new Date(code.detected_at).toLocaleString("fr-FR") : "Inconnue"}
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>

                  {/* Statut */}
                  <TableCell>
                    <div
                      className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide",
                        status.badgeClass
                      )}
                    >
                      <StatusIcon className={cn("size-3", code.status === "claiming" && "animate-spin")} />
                      {status.label}
                    </div>
                    {code.claimed_amount > 0 && code.claimed_asset && (
                      <div className="mt-1.5 text-xs text-emerald-500 dark:text-emerald-400 font-bold flex items-center gap-1 drop-shadow-[0_0_5px_rgba(16,185,129,0.3)]">
                        <Sparkles className="size-3" />
                        +{code.claimed_amount} {code.claimed_asset}
                      </div>
                    )}
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="text-right pr-6">
                    <div className="flex items-center justify-end gap-2">
                      {code.status === "unverified" && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleClaim(code.id)}
                          disabled={claimingId === code.id || isPending}
                          className="h-7 text-xs px-3 rounded-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-all hover:shadow-[0_0_15px_rgba(var(--color-primary),0.3)]"
                        >
                          {claimingId === code.id ? (
                            <Loader2 className="size-3 animate-spin mr-1.5" />
                          ) : null}
                          {claimingId === code.id ? "En cours" : "Claim"}
                        </Button>
                      )}
                      
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 rounded-full text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                            onClick={() => handleDelete(code.id)}
                            disabled={isPending}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">Supprimer</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-border/40 bg-muted/10">
            <div className="text-xs text-muted-foreground font-medium">
              Affichage {startIndex + 1}-{Math.min(startIndex + itemsPerPage, codes.length)} sur {codes.length}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-8 text-xs bg-background/50"
              >
                Précédent
              </Button>
              <div className="text-xs font-medium px-2 text-foreground/80">
                Page {currentPage} / {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="h-8 text-xs bg-background/50"
              >
                Suivant
              </Button>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
