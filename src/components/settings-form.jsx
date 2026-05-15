"use client";

import { useTransition } from "react";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
} from "@/components/ui/select";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { updateSettings } from "@/app/actions";
import { toast } from "sonner";

export function SettingsForm({ settings }) {
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (formData) => {
    startTransition(async () => {
      const result = await updateSettings(formData);
      if (result.success) {
        toast.success("Settings saved");
      } else {
        toast.error("Failed to save");
      }
    });
  };

  return (
    <form action={handleSubmit}>
      <FieldGroup>
        <Field className="flex items-center justify-between rounded-lg border p-4">
          <div className="flex flex-col gap-0.5">
            <FieldLabel htmlFor="scraping_enabled">Enable Scraping</FieldLabel>
            <FieldDescription>
              Auto-scrape monitored accounts for red packet codes.
            </FieldDescription>
          </div>
          <Switch
            id="scraping_enabled"
            name="scraping_enabled"
            value="true"
            defaultChecked={settings.scrapingEnabled}
          />
        </Field>

        <Field className="flex items-center justify-between rounded-lg border p-4">
          <div className="flex flex-col gap-0.5">
            <FieldLabel htmlFor="scrape_interval_minutes">
              Scrape Interval
            </FieldLabel>
            <FieldDescription>
              How often to check for new tweets.
            </FieldDescription>
          </div>
          <Select
            name="scrape_interval_minutes"
            defaultValue={settings.scrapeIntervalMinutes.toString()}
          >
            <SelectTrigger className="w-[100px]">
              <SelectValue placeholder="Interval" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="5">5 min</SelectItem>
                <SelectItem value="10">10 min</SelectItem>
                <SelectItem value="15">15 min</SelectItem>
                <SelectItem value="30">30 min</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        <Field className="flex items-center justify-between rounded-lg border p-4">
          <div className="flex flex-col gap-0.5">
            <FieldLabel htmlFor="test_mode">Test Mode</FieldLabel>
            <FieldDescription>
              Simulate Binance API (no real claims).
            </FieldDescription>
          </div>
          <Switch
            id="test_mode"
            name="test_mode"
            value="true"
            defaultChecked={settings.testMode}
          />
        </Field>
      </FieldGroup>

      <div className="mt-4">
        <Button type="submit" disabled={isPending}>
          {isPending ? <Spinner className="size-4" /> : null}
          Save Settings
        </Button>
      </div>
    </form>
  );
}
