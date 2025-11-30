import { PageHeader } from "@/components/dashboard/page-header";
import { GoalsDisplay } from "@/components/dashboard/financial-goals/goals-display";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";

export default function FinancialGoalsPage() {
  return (
    <div>
      <PageHeader
        title="Financial Goals"
        description="Set, track, and achieve your financial objectives."
      />
      <GoalsDisplay />
    </div>
  );
}
