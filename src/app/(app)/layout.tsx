import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <AppShell nombre={session.user.name ?? session.user.username} rol={session.user.role}>
      {children}
    </AppShell>
  );
}
