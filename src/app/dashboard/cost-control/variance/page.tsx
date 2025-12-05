
'use client';
import { PageHeader } from "@/components/dashboard/page-header";
import { VarianceReport } from "@/components/dashboard/variance/variance-report";
import { useLanguage } from "@/context/language-context";

export default function VariancePage() {
    const { t } = useLanguage();
    return (
        <div>
            <PageHeader
                title={t('budgetVsActualVariance')}
                description={t('budgetVsActualVarianceDescription')}
            />
            <VarianceReport />
        </div>
    )
}
