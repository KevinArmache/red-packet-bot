"use client";

import { useTransition } from "react";
import { Trash2, Twitter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { removeAccount } from "@/app/actions";
import { toast } from "sonner";
import { format } from "date-fns";

export function AccountsList({ accounts }) {
  const [isPending, startTransition] = useTransition();

  const handleRemove = (id, username) => {
    startTransition(async () => {
      const result = await removeAccount(id);
      if (result.success) {
        toast.success(`Removed @${username}`);
      } else {
        toast.error("Failed to remove");
      }
    });
  };

  if (accounts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <Twitter className="mx-auto size-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          No accounts yet. Add a Twitter username above.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {accounts.map((account) => (
        <div
          key={account.id}
          className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2"
        >
          <Twitter className="size-4 text-muted-foreground" />
          <span className="font-medium">@{account.username}</span>
          {account.last_scraped_at && (
            <Badge variant="secondary" className="text-xs">
              {format(new Date(account.last_scraped_at), "HH:mm")}
            </Badge>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-6 text-muted-foreground hover:text-destructive"
            onClick={() => handleRemove(account.id, account.username)}
            disabled={isPending}
          >
            {isPending ? (
              <Spinner className="size-3" />
            ) : (
              <Trash2 className="size-3" />
            )}
          </Button>
        </div>
      ))}
    </div>
  );
}
