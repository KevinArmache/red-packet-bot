import { getCodes, getSettings } from "@/app/actions";
import { CodesTable } from "@/components/codes-table";
import { CronManager } from "@/components/cron-manager";
import { DeleteAllButton } from "@/components/delete-all-button";
import { BotStatusBanner } from "@/components/bot-status-banner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const codes = await getCodes();
  const settings = await getSettings();

  const stats = {
    total: codes.length,
    unverified: codes.filter((c) => c.status === "unverified").length,
    claiming: codes.filter((c) => c.status === "claiming").length,
    claimed: codes.filter((c) => c.status === "claimed").length,
    failed: codes.filter(
      (c) =>
        c.status === "failed" ||
        c.status === "invalid" ||
        c.status === "expired" ||
        c.status === "empty"
    ).length,
  };

  return (
    <div className="flex flex-col gap-6">
      {/* En-tête */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground text-sm">
            Surveillance et réclamation automatique de Red Packets Binance.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <CronManager
            scrapingEnabled={settings.scrapingEnabled}
            intervalMinutes={settings.scrapeIntervalMinutes}
          />
          <DeleteAllButton codesCount={codes.length} />
        </div>
      </div>

      {/* Bannière de statut du bot en temps réel */}
      <BotStatusBanner />

      {/* Statistiques */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardDescription className="text-xs">Total</CardDescription>
            <CardTitle className="text-3xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardDescription className="text-xs">En attente</CardDescription>
            <CardTitle className="text-3xl text-amber-600 dark:text-amber-400">
              {stats.unverified}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-purple-50/50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardDescription className="text-xs">En cours</CardDescription>
            <CardTitle className="text-3xl text-purple-600 dark:text-purple-400">
              {stats.claiming}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardDescription className="text-xs">Réclamés ✓</CardDescription>
            <CardTitle className="text-3xl text-emerald-600 dark:text-emerald-400">
              {stats.claimed}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardDescription className="text-xs">Échoués</CardDescription>
            <CardTitle className="text-3xl text-muted-foreground">
              {stats.failed}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Tableau des codes */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Codes Détectés</CardTitle>
            <CardDescription>
              Codes Red Packet extraits automatiquement des comptes surveillés. Le tableau se met à jour en temps réel.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <CodesTable codes={codes} />
        </CardContent>
      </Card>
    </div>
  );
}
