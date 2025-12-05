
'use client';
import { PageHeader } from "@/components/dashboard/page-header";
import { BudgetTabs } from "@/components/dashboard/budget/budget-tabs";
import { useLanguage } from "@/context/language-context";

export default function BudgetPlannerPage() {
  const { t } = useLanguage();
  return (
    <div>
      <PageHeader
        title={t('budgetPlanner')}
        description={t('budgetPlannerDescription')}
      />
      <BudgetTabs />
    </div>
  );
}
