
'use client';
import { PageHeader } from "@/components/dashboard/page-header";
import { RecurringList } from "@/components/dashboard/recurring/recurring-list";
import { useLanguage } from "@/context/language-context";

export default function RecurringPage() {
    const { t } = useLanguage();
    return (
        <div>
            <PageHeader
                title={t('recurringTransactions')}
                description={t('recurringTransactionsDescription')}
            />
            <RecurringList />
        </div>
    )
}
