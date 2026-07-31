// The header and tab strip are rendered by each tab page through
// CompanyShell: layouts do not receive searchParams, and both need to know
// which company is selected.
export default function CompanyViewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div>{children}</div>;
}
