
'use client';
import { PageHeader } from "@/components/dashboard/page-header";
import { TransactionList } from "@/components/dashboard/transactions/transaction-list";
import { useLanguage } from "@/context/language-context";

export default function TransactionsPage() {
    const { t } = useLanguage();
    return (
        <div>
            <PageHeader
                title={t('transactions')}
                description={t('transactionsDescription')}
            />
            <TransactionList />
        </div>
    )
}
