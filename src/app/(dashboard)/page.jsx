import { getCodes, getSettings } from "@/app/actions";
import { CodesTable } from "@/components/codes-table";
import { ManualIngest } from "@/components/manual-ingest";
import { CronManager } from "@/components/cron-manager";
import { DeleteAllButton } from "@/components/delete-all-button";
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
    valid: codes.filter((c) => c.status === "valid").length,
    claimed: codes.filter((c) => c.status === "claimed").length,
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">
            Monitor and claim Binance Red Packets from Twitter.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CronManager scrapingEnabled={settings.scrapingEnabled} intervalMinutes={settings.scrapeIntervalMinutes} />
          <DeleteAllButton codesCount={codes.length} />
          <ManualIngest />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Codes</CardDescription>
            <CardTitle className="text-3xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Unverified</CardDescription>
            <CardTitle className="text-3xl">{stats.unverified}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Valid</CardDescription>
            <CardTitle className="text-3xl text-green-600">
              {stats.valid}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Claimed</CardDescription>
            <CardTitle className="text-3xl text-primary">
              {stats.claimed}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detected Codes</CardTitle>
          <CardDescription>
            Red packet codes extracted from monitored Twitter accounts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CodesTable codes={codes} />
        </CardContent>
      </Card>
    </div>
  );
}
