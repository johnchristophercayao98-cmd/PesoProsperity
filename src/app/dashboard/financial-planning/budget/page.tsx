import { PageHeader } from "@/components/dashboard/page-header";
import { BudgetTabs } from "@/components/dashboard/budget/budget-tabs";

export default function BudgetPlannerPage() {
  return (
    <div>
      <PageHeader
        title="Budget Planner"
        description="Create and manage your monthly budgets, or let our AI suggest one for you."
      />
      <BudgetTabs />
    </div>
  );
}
