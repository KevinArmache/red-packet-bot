"use client";

import { useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { addAccount } from "@/app/actions";
import { toast } from "sonner";

export function AddAccountForm() {
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (formData) => {
    startTransition(async () => {
      const result = await addAccount(formData);
      if (result.success) {
        toast.success(`Added @${result.account?.username}`);
        const form = document.getElementById("add-account-form");
        form?.reset();
      } else {
        toast.error(result.error || "Failed to add");
      }
    });
  };

  return (
    <form
      id="add-account-form"
      action={handleSubmit}
      className="flex items-center gap-2"
    >
      <Input
        name="username"
        placeholder="Twitter username (e.g., binance)"
        className="max-w-[200px]"
        required
      />
      <Button type="submit" disabled={isPending} size="sm">
        {isPending ? (
          <Spinner className="size-4" />
        ) : (
          <Plus className="size-4" data-icon="inline-start" />
        )}
        Add
      </Button>
    </form>
  );
}
