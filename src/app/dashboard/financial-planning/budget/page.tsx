import { PageHeader } from "@/components/dashboard/page-header";
import { BudgetTabs } from "@/components/dashboard/budget/budget-tabs";

export default function BudgetPlannerPage() {
  return (
    <div>
      <PageHeader
        title="Budget Planner"
        description="Create and manage your monthly budgets. Use our AI tool or set up your budget manually."
      />
      <BudgetTabs />
    </div>
  );
}
