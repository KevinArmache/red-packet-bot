import { getAccounts, getSettings } from "@/app/actions";
import { AccountsList } from "@/components/accounts-list";
import { AddAccountForm } from "@/components/add-account-form";
import { SettingsForm } from "@/components/settings-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [accounts, settings] = await Promise.all([
    getAccounts(),
    getSettings(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">
          Configure monitored accounts and scraping behavior.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Monitored Accounts</CardTitle>
          <CardDescription>
            Twitter accounts to monitor for red packet codes. Add usernames
            without the @ symbol.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <AddAccountForm />
          <Separator />
          <AccountsList accounts={accounts} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scraping Settings</CardTitle>
          <CardDescription>
            Configure how and when the scraper runs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SettingsForm settings={settings} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Environment Variables</CardTitle>
          <CardDescription>
            These variables must be configured in your .env.local file or Vercel
            project settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg bg-muted p-4 font-mono text-sm">
            <div className="flex flex-col gap-2">
              <div>
                <span className="text-muted-foreground">
                  # Required for claiming
                </span>
              </div>
              <div>BINANCE_API_KEY=your_api_key</div>
              <div>BINANCE_SECRET_KEY=your_secret_key</div>
              <div className="mt-2">
                <span className="text-muted-foreground"># Optional</span>
              </div>
              <div>BINANCE_TEST_MODE=true</div>
              <div>PROXY_LIST=http://proxy1:port,http://proxy2:port</div>
              <div>CRON_SECRET=your_cron_secret</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
