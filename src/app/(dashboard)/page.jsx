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
import { ShieldAlert, CheckCircle2, Clock, Activity, Hash } from "lucide-react";

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
    <div className="relative min-h-full flex flex-col gap-6 animate-in fade-in duration-500 pb-10">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 -z-10 h-96 w-96 rounded-full bg-primary/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 -z-10 h-96 w-96 rounded-full bg-emerald-500/5 blur-[120px] pointer-events-none" />

      {/* En-tête */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-4xl font-bold tracking-tight text-gradient mb-1">Command Center</h2>
          <p className="text-muted-foreground text-sm max-w-lg">
            Surveillance et réclamation automatique de Red Packets Binance. Les statistiques et le flux d'activité se mettent à jour en temps réel.
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
      <div className="mt-2 shadow-[0_0_40px_-15px_rgba(0,0,0,0.3)] dark:shadow-none rounded-xl">
        <BotStatusBanner />
      </div>

      {/* Statistiques avec Grid CSS amélioée */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5 mt-2">
        <Card className="glass-effect transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:border-primary/30 group">
          <CardHeader className="pb-2 pt-5 px-5">
            <CardDescription className="text-xs flex items-center gap-2 font-medium">
              <Hash className="size-4 text-primary/70 group-hover:text-primary transition-colors" /> Total Codes
            </CardDescription>
            <CardTitle className="text-3xl font-light">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        
        <Card className="glass-effect transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:border-amber-500/30 group">
          <CardHeader className="pb-2 pt-5 px-5">
            <CardDescription className="text-xs flex items-center gap-2 font-medium">
              <Clock className="size-4 text-amber-500/70 group-hover:text-amber-500 transition-colors" /> En attente
            </CardDescription>
            <CardTitle className="text-3xl text-amber-600 dark:text-amber-400 font-light drop-shadow-sm">
              {stats.unverified}
            </CardTitle>
          </CardHeader>
        </Card>
        
        <Card className="bg-purple-50/40 dark:bg-purple-900/10 border-purple-200/50 dark:border-purple-800/30 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-purple-500/10 group backdrop-blur-md">
          <CardHeader className="pb-2 pt-5 px-5">
            <CardDescription className="text-xs flex items-center gap-2 font-medium">
              <Activity className="size-4 text-purple-500/70 group-hover:text-purple-500 transition-colors" /> En cours
            </CardDescription>
            <CardTitle className="text-3xl text-purple-600 dark:text-purple-400 font-light drop-shadow-[0_0_10px_rgba(168,85,247,0.3)]">
              {stats.claiming}
            </CardTitle>
          </CardHeader>
        </Card>
        
        <Card className="bg-emerald-50/40 dark:bg-emerald-900/10 border-emerald-200/50 dark:border-emerald-800/30 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-emerald-500/10 group backdrop-blur-md relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <CheckCircle2 className="size-16" />
          </div>
          <CardHeader className="pb-2 pt-5 px-5 relative z-10">
            <CardDescription className="text-xs flex items-center gap-2 font-medium">
              <CheckCircle2 className="size-4 text-emerald-500/70 group-hover:text-emerald-500 transition-colors" /> Réclamés
            </CardDescription>
            <CardTitle className="text-3xl text-emerald-600 dark:text-emerald-400 font-light drop-shadow-[0_0_10px_rgba(16,185,129,0.3)]">
              {stats.claimed}
            </CardTitle>
          </CardHeader>
        </Card>
        
        <Card className="glass-effect transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:border-red-500/30 group">
          <CardHeader className="pb-2 pt-5 px-5">
            <CardDescription className="text-xs flex items-center gap-2 font-medium">
              <ShieldAlert className="size-4 text-muted-foreground group-hover:text-red-400 transition-colors" /> Échoués
            </CardDescription>
            <CardTitle className="text-3xl text-muted-foreground/80 font-light">
              {stats.failed}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Tableau des codes */}
      <Card className="mt-4 glass-effect shadow-xl dark:shadow-none border-white/10 dark:border-white/5">
        <CardHeader className="flex flex-row items-center justify-between pb-6 border-b border-border/40 bg-muted/20">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              Flux des Codes <span className="relative flex h-2 w-2 ml-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span></span>
            </CardTitle>
            <CardDescription className="mt-1">
              Tous les codes détectés et leur cycle de vie en temps réel.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <CodesTable codes={codes} />
        </CardContent>
      </Card>
    </div>
  );
}
