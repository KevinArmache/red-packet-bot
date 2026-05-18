"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Gift, Settings, FileText, LayoutDashboard, Moon, Sun } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Settings", href: "/settings", icon: Settings },
  { name: "Logs", href: "/logs", icon: FileText },
];

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="size-8"
      title="Toggle theme"
    >
      <Sun className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  );
}

export function AppSidebar({ children }) {
  const pathname = usePathname();

  return (
    <SidebarProvider>
      <Sidebar variant="inset" className="border-r border-white/5 bg-background/40 backdrop-blur-xl">
        <SidebarHeader className="bg-transparent pt-4">
          <div className="flex items-center gap-3 px-3 py-2 bg-gradient-to-r from-primary/20 to-transparent rounded-xl border border-primary/10">
            <div className="flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-amber-500 text-primary-foreground shadow-lg shadow-primary/20">
              <Gift className="size-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight text-foreground/90">Red Packet</span>
              <span className="text-[10px] font-medium uppercase tracking-widest text-primary">Monitor</span>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navigation.map((item) => (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === item.href}
                    >
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <div className="flex items-center justify-between px-2 py-2">
            <span className="text-xs text-muted-foreground">Thème</span>
            <ThemeToggle />
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="bg-transparent">
        <header className="flex h-16 items-center gap-4 border-b border-white/5 bg-background/40 backdrop-blur-xl px-6 sticky top-0 z-50">
          <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors" />
          <Separator orientation="vertical" className="h-6 opacity-50" />
          <h1 className="text-lg font-semibold tracking-tight text-foreground/90">
            {navigation.find((item) => item.href === pathname)?.name ||
              "Dashboard"}
          </h1>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-8 bg-gradient-to-br from-background via-background to-muted/20">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
