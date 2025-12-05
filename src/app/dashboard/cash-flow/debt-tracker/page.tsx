
'use client';
import { PageHeader } from "@/components/dashboard/page-header";
import { DebtManager } from "@/components/dashboard/debt-tracker/debt-manager";
import { useLanguage } from "@/context/language-context";

export default function DebtTrackerPage() {
    const { t } = useLanguage();
    return (
        <div>
            <PageHeader
                title={t('debtTracker')}
                description={t('debtTrackerDescription')}
            />
            <DebtManager />
        </div>
    )
}
