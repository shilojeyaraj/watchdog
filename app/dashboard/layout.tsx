import { syncCurrentUser } from '@/lib/db/sync-user';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await syncCurrentUser();
  // Cancel the global pt-14 added for the navbar (navbar is hidden on dashboard)
  return <div className="-mt-14">{children}</div>;
}
