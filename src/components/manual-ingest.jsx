"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { ingestCode } from "@/app/actions";
import { toast } from "sonner";

export function ManualIngest() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = async (formData) => {
    startTransition(async () => {
      const result = await ingestCode(formData);
      if (result.success) {
        toast.success(
          `Found ${result.codesFound} code(s), added ${result.codesAdded} new code(s)`,
        );
        setOpen(false);
      } else {
        toast.error(result.error || "Failed to ingest codes");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="size-4" data-icon="inline-start" />
          Add Code
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manually Add Code</DialogTitle>
          <DialogDescription>
            Paste text containing a Binance Red Packet code (format: BP followed
            by alphanumeric characters). The code will be automatically
            extracted.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="text">Tweet or Text</FieldLabel>
              <Textarea
                id="text"
                name="text"
                placeholder="Paste the tweet or text containing the red packet code..."
                rows={4}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="author">Source (optional)</FieldLabel>
              <Input
                id="author"
                name="author"
                placeholder="@username or source name"
              />
            </Field>
          </FieldGroup>
          <div className="mt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Spinner className="size-4" /> : "Extract & Add"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
