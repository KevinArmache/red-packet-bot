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
  const [scrapingEnabled, setScrapingEnabled] = useState(settings.scrapingEnabled);
  const [interval, setInterval] = useState(settings.scrapeIntervalMinutes.toString());
  const [maxCodeAge, setMaxCodeAge] = useState((settings.maxCodeAgeMinutes || "30").toString());

  const handleSubmit = (e) => {
    e.preventDefault();
    startTransition(async () => {
      const formData = new FormData();
      formData.set("scraping_enabled", scrapingEnabled ? "true" : "false");
      formData.set("scrape_interval_minutes", interval);
      formData.set("max_code_age_minutes", maxCodeAge);

      const result = await updateSettings(formData);
      if (result.success) {
        toast.success("Paramètres sauvegardés !");
      } else {
        toast.error("Échec de la sauvegarde");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup>
        {/* Activer le scraping automatique */}
        <Field className="flex items-center justify-between rounded-lg border p-4">
          <div className="flex flex-col gap-0.5">
            <FieldLabel>Scraping automatique</FieldLabel>
            <FieldDescription>
              Active la surveillance automatique de tous les comptes à l'intervalle défini.
            </FieldDescription>
          </div>
          <Switch
            id="scraping_enabled"
            checked={scrapingEnabled}
            onCheckedChange={setScrapingEnabled}
          />
        </Field>

        {/* Intervalle de scraping */}
        <Field className="flex items-center justify-between rounded-lg border p-4">
          <div className="flex flex-col gap-0.5">
            <FieldLabel>Intervalle de scraping</FieldLabel>
            <FieldDescription>
              Fréquence de vérification des nouveaux tweets sur tous les comptes surveillés.
            </FieldDescription>
          </div>
          <Select value={interval} onValueChange={setInterval}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Intervalle" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="1">1 min</SelectItem>
                <SelectItem value="2">2 min</SelectItem>
                <SelectItem value="5">5 min</SelectItem>
                <SelectItem value="10">10 min</SelectItem>
                <SelectItem value="15">15 min</SelectItem>
                <SelectItem value="30">30 min</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        {/* Âge maximal des tweets */}
        <Field className="flex items-center justify-between rounded-lg border p-4">
          <div className="flex flex-col gap-0.5">
            <FieldLabel>Âge maximal des tweets</FieldLabel>
            <FieldDescription>
              Ignorer les codes dont les tweets sont plus anciens que cette durée. 
              "Sans limite" récupère tous les tweets disponibles.
            </FieldDescription>
          </div>
          <Select value={maxCodeAge} onValueChange={setMaxCodeAge}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Sélectionner" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="5">5 min</SelectItem>
                <SelectItem value="10">10 min</SelectItem>
                <SelectItem value="15">15 min</SelectItem>
                <SelectItem value="20">20 min</SelectItem>
                <SelectItem value="30">30 min</SelectItem>
                <SelectItem value="60">1 heure</SelectItem>
                <SelectItem value="120">2 heures</SelectItem>
                <SelectItem value="180">3 heures</SelectItem>
                <SelectItem value="360">6 heures</SelectItem>
                <SelectItem value="720">12 heures</SelectItem>
                <SelectItem value="1440">24 heures</SelectItem>
                <SelectItem value="0">Sans limite</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
      </FieldGroup>

      <div className="mt-4">
        <Button type="submit" disabled={isPending}>
          {isPending && <Spinner className="size-4 mr-2" />}
          Sauvegarder les paramètres
        </Button>
      </div>
    </form>
  );
}
