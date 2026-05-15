"use client";

import { useState, useTransition } from "react";
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
  const [scrapingEnabled, setScrapingEnabled] = useState(
    settings.scrapingEnabled,
  );
  const [testMode, setTestMode] = useState(settings.testMode);
  const [interval, setInterval] = useState(
    settings.scrapeIntervalMinutes.toString(),
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    startTransition(async () => {
      // On construit le FormData manuellement car Switch n'est pas un input natif
      const formData = new FormData();
      formData.set("scraping_enabled", scrapingEnabled ? "true" : "false");
      formData.set("scrape_interval_minutes", interval);
      formData.set("test_mode", testMode ? "true" : "false");

      const result = await updateSettings(formData);
      if (result.success) {
        toast.success("Paramètres sauvegardés");
      } else {
        toast.error("Échec de la sauvegarde");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup>
        <Field className="flex items-center justify-between rounded-lg border p-4">
          <div className="flex flex-col gap-0.5">
            <FieldLabel>Activer le scraping</FieldLabel>
            <FieldDescription>
              Scraper automatiquement les comptes surveillés.
            </FieldDescription>
          </div>
          <Switch
            id="scraping_enabled"
            checked={scrapingEnabled}
            onCheckedChange={setScrapingEnabled}
          />
        </Field>

        <Field className="flex items-center justify-between rounded-lg border p-4">
          <div className="flex flex-col gap-0.5">
            <FieldLabel>Intervalle de scraping</FieldLabel>
            <FieldDescription>
              Fréquence de vérification des nouveaux tweets.
            </FieldDescription>
          </div>
          <Select value={interval} onValueChange={setInterval}>
            <SelectTrigger className="w-[100px]">
              <SelectValue placeholder="Intervalle" />
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
            <FieldLabel>Mode test</FieldLabel>
            <FieldDescription>
              Simule l'API Binance (aucun vrai claim effectué).
            </FieldDescription>
          </div>
          <Switch
            id="test_mode"
            checked={testMode}
            onCheckedChange={setTestMode}
          />
        </Field>
      </FieldGroup>

      <div className="mt-4">
        <Button type="submit" disabled={isPending}>
          {isPending ? <Spinner className="size-4" /> : null}
          Sauvegarder
        </Button>
      </div>
    </form>
  );
}
