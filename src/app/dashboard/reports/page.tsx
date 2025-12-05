
'use client';
import { PageHeader } from "@/components/dashboard/page-header";
import { ReportGenerator } from "@/components/dashboard/reports/report-generator";
import { useLanguage } from "@/context/language-context";

export default function ReportsPage() {
    const { t } = useLanguage();
    return (
        <div>
            <PageHeader
                title={t('financialReports')}
                description={t('financialReportsDescription')}
            />
            <ReportGenerator />
        </div>
    )
}
