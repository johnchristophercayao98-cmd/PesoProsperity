
'use client';
import { PageHeader } from "@/components/dashboard/page-header";
import { GoalsDisplay } from "@/components/dashboard/financial-goals/goals-display";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { useLanguage } from "@/context/language-context";

export default function FinancialGoalsPage() {
  const { t } = useLanguage();
  return (
    <div className='p-4 sm:p-0'>
      <PageHeader
        title={t('financialGoals')}
        description={t('financialGoalsDescription')}
      />
      <GoalsDisplay />
    </div>
  );
}
