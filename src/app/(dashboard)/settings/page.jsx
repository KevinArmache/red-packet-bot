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
        <h2 className="text-2xl font-bold tracking-tight">Paramètres</h2>
        <p className="text-muted-foreground">
          Configurez les comptes surveillés et le comportement du scraping automatique.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Comptes Surveillés</CardTitle>
          <CardDescription>
            Comptes Twitter/X à surveiller pour détecter les codes Red Packet.
            Entrez les noms d'utilisateur sans le @.
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
          <CardTitle>Paramètres du Scraping</CardTitle>
          <CardDescription>
            Contrôlez la fréquence et l'âge maximal des tweets analysés.
            Ces paramètres s'appliquent à tous les comptes surveillés.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SettingsForm settings={settings} />
        </CardContent>
      </Card>
    </div>
  );
}
