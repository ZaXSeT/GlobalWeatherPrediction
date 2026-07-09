import { SearchDashboard } from "@/components/weather/SearchDashboard";

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Weather</h1>
      <SearchDashboard />
    </div>
  );
}
