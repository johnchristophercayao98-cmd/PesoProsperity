import { PageHeader } from "@/components/dashboard/page-header";
import { BudgetPlanner } from "@/components/dashboard/budget/budget-planner";

export default function BudgetPlannerPage() {
  return (
    <div>
      <PageHeader
        title="Budget Planner"
        description="Create and manage your monthly budgets."
      />
      <BudgetPlanner />
    </div>
  );
}
