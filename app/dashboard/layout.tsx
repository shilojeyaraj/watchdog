import { syncCurrentUser } from '@/lib/db/sync-user';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await syncCurrentUser();
  return <>{children}</>;
}
