"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import {
  Copy,
  Check,
  RefreshCw,
  CircleCheck,
  CircleX,
  Clock,
  AlertTriangle,
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
import { verifyCode, claimCode } from "@/app/actions";
import { toast } from "sonner";

const statusConfig = {
  unverified: { label: "Unverified", variant: "secondary", icon: Clock },
  valid: { label: "Valid", variant: "default", icon: CircleCheck },
  invalid: { label: "Invalid", variant: "destructive", icon: CircleX },
  claimed: { label: "Claimed", variant: "default", icon: CircleCheck },
  failed: { label: "Failed", variant: "destructive", icon: CircleX },
  expired: { label: "Expired", variant: "secondary", icon: AlertTriangle },
};

export function CodesTable({ codes, failedAttempts }) {
  const [copiedId, setCopiedId] = useState(null);
  const [verifyingId, setVerifyingId] = useState(null);
  const [claimingId, setClaimingId] = useState(null);
  const [isPending, startTransition] = useTransition();

  const copyToClipboard = async (code, id) => {
    await navigator.clipboard.writeText(code);
    setCopiedId(id);
    toast.success("Copied!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleVerify = async (id) => {
    setVerifyingId(id);
    startTransition(async () => {
      const result = await verifyCode(id);
      setVerifyingId(null);
      if (result.success) {
        if (result.valid) {
          toast.success(`Valid! ${result.amount} ${result.token}`);
        } else {
          toast.info("Code is not valid");
        }
      } else {
        toast.error(result.error || "Verification failed");
      }
    });
  };

  const handleClaim = async (id) => {
    setClaimingId(id);
    startTransition(async () => {
      const result = await claimCode(id);
      setClaimingId(null);
      if (result.success) {
        toast.success(`Claimed ${result.amount} ${result.token}!`);
      } else {
        toast.error(result.error || "Claim failed");
      }
    });
  };

  const isClaimBlocked = failedAttempts >= 5;

  if (codes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <RefreshCw className="size-6 text-muted-foreground" />
        </div>
        <h3 className="mt-4 text-lg font-semibold">No codes yet</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Add accounts to monitor, or manually add codes.
        </p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      {isClaimBlocked && (
        <div className="mb-4 flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-destructive">
          <AlertTriangle className="size-4" />
          <span className="text-sm">
            Claiming disabled (5 failed attempts in 24h).
          </span>
        </div>
      )}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">Code</TableHead>
              <TableHead>Tweet</TableHead>
              <TableHead className="w-[100px]">Author</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="text-right w-[150px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {codes.map((code) => {
              const status = statusConfig[code.status];
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
                        <TooltipContent>Copy</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[250px]">
                    <p className="truncate text-xs text-muted-foreground">
                      {code.tweet_text || "-"}
                    </p>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      @{code.author.replace(/^@+/, "")}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={status.variant} className="gap-1">
                      <StatusIcon className="size-3" />
                      {status.label}
                    </Badge>
                    {code.claimed_amount && code.claimed_asset && (
                      <div className="mt-1 text-xs text-green-600">
                        +{code.claimed_amount} {code.claimed_asset}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {code.status === "unverified" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleVerify(code.id)}
                          disabled={verifyingId === code.id || isPending}
                        >
                          {verifyingId === code.id ? (
                            <Spinner className="size-3" />
                          ) : (
                            "Verify"
                          )}
                        </Button>
                      )}
                      {(code.status === "valid" ||
                        code.status === "unverified") && (
                        <Button
                          size="sm"
                          onClick={() => handleClaim(code.id)}
                          disabled={
                            claimingId === code.id ||
                            isPending ||
                            isClaimBlocked
                          }
                        >
                          {claimingId === code.id ? (
                            <Spinner className="size-3" />
                          ) : (
                            "Claim"
                          )}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <div className="mt-2 text-xs text-muted-foreground">
        Failed attempts: {failedAttempts}/5
      </div>
    </TooltipProvider>
  );
}
