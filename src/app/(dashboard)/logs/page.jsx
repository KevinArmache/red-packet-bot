import { getLogs } from "@/app/actions";
import { format } from "date-fns";
import { Terminal, Database, Activity, Code2, Cpu } from "lucide-react";

export const dynamic = "force-dynamic";

const levelConfig = {
  info: { color: "text-blue-400", bg: "bg-blue-400/10", prefix: "[INFO]" },
  warn: { color: "text-amber-400", bg: "bg-amber-400/10", prefix: "[WARN]" },
  error: { color: "text-red-400", bg: "bg-red-400/10", prefix: "[FAIL]" },
};

export default async function LogsPage() {
  const logs = await getLogs(300);

  return (
    <div className="flex flex-col gap-6 h-[calc(100vh-6rem)] animate-in fade-in duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-gradient flex items-center gap-3">
          <Terminal className="size-8" />
          Terminal Logs
        </h2>
        <p className="text-muted-foreground text-sm max-w-2xl mt-1">
          Surveillance brute du moteur d'automatisation. Les journaux affichent l'activité réseau, les interactions Nitter et les exécutions Playwright en temps réel.
        </p>
      </div>

      {/* Terminal Container */}
      <div className="flex-1 rounded-xl bg-[#0a0a0c] border border-white/10 shadow-2xl overflow-hidden flex flex-col relative group">
        
        {/* Terminal Header */}
        <div className="h-10 bg-[#121214] border-b border-white/5 flex items-center px-4 justify-between select-none">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="size-3 rounded-full bg-red-500/80 border border-red-500" />
              <div className="size-3 rounded-full bg-amber-500/80 border border-amber-500" />
              <div className="size-3 rounded-full bg-emerald-500/80 border border-emerald-500" />
            </div>
            <span className="text-xs text-muted-foreground font-mono ml-4">root@red-packet-bot:~</span>
          </div>
          <div className="flex items-center gap-3 text-muted-foreground">
            <Database className="size-3.5" />
            <Activity className="size-3.5" />
            <Cpu className="size-3.5" />
          </div>
        </div>

        {/* Terminal Body */}
        <div className="flex-1 overflow-auto p-4 font-mono text-[13px] leading-relaxed relative">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-1000" />
          
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground/50">
              <Code2 className="size-12 mb-4 opacity-50" />
              <p>Attente d'instructions système...</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 pb-8">
              {logs.map((log) => {
                const config = levelConfig[log.level] || levelConfig.info;
                
                // Extraire le contexte si présent dans le message (ex: "[Nitter]")
                let context = "";
                let msg = log.message;
                const contextMatch = msg.match(/^\[(.*?)\]/);
                if (contextMatch) {
                  context = contextMatch[0];
                  msg = msg.replace(contextMatch[0], "").trim();
                }

                return (
                  <div key={log.id} className="flex items-start gap-3 hover:bg-white/5 px-2 py-1 rounded transition-colors group/log">
                    <div className="flex items-center gap-3 shrink-0 mt-0.5">
                      <span className="text-[#6272a4] w-[140px] shrink-0">
                        {format(new Date(log.timestamp), "yyyy-MM-dd HH:mm:ss")}
                      </span>
                      <span className={`w-[50px] shrink-0 font-bold ${config.color}`}>
                        {config.prefix}
                      </span>
                    </div>
                    
                    <div className="flex-1 min-w-0 flex flex-wrap gap-x-2">
                      {context && (
                        <span className="text-[#ff79c6] font-semibold">{context}</span>
                      )}
                      <span className="text-[#f8f8f2] break-words">
                        {msg}
                      </span>
                      {log.details && (
                        <span className="text-[#f1fa8c] break-words w-full pl-4 opacity-80 border-l border-white/20 mt-1">
                          ↳ {log.details}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              
              {/* Ligne clignotante active */}
              <div className="flex items-center gap-2 px-2 py-1 mt-2 text-emerald-400">
                <span className="text-emerald-500">➜</span>
                <span>~</span>
                <span className="w-2 h-4 bg-emerald-400 animate-pulse" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
