import { getLogs } from "@/app/actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";

export const dynamic = "force-dynamic";

const levelConfig = {
  info: { icon: Info, variant: "secondary", color: "text-blue-500" },
  warn: { icon: AlertTriangle, variant: "outline", color: "text-yellow-500" },
  error: { icon: AlertCircle, variant: "destructive", color: "text-red-500" },
};

export default async function LogsPage() {
  const logs = await getLogs(200);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Logs</h2>
        <p className="text-muted-foreground">
          View scraping activity and claim attempts.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Activity Log</CardTitle>
          <CardDescription>
            Recent scraping and claiming activity. Showing the last 200 entries.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="text-sm text-muted-foreground">No logs yet.</p>
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="flex flex-col gap-2">
                {logs.map((log) => {
                  const config = levelConfig[log.level];
                  const LevelIcon = config.icon;

                  return (
                    <div
                      key={log.id}
                      className="flex items-start gap-3 rounded-lg border p-3"
                    >
                      <LevelIcon
                        className={`mt-0.5 size-4 shrink-0 ${config.color}`}
                      />
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={config.variant} className="text-xs">
                            {log.level.toUpperCase()}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(log.timestamp), "MMM d, HH:mm:ss")}
                          </span>
                        </div>
                        <p className="text-sm">{log.message}</p>
                        {log.details && (
                          <p className="text-xs text-muted-foreground font-mono">
                            {log.details}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
