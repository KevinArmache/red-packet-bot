import { AppSidebar } from "@/components/app-sidebar";
import { Toaster } from "@/components/ui/sonner";

export default function DashboardLayout({ children }) {
  return (
    <>
      <AppSidebar>{children}</AppSidebar>
      <Toaster position="top-right" />
    </>
  );
}
