import { PageHeader } from "@/components/dashboard/page-header";
import { TransactionList } from "@/components/dashboard/transactions/transaction-list";

export default function TransactionsPage() {
    return (
        <div>
            <PageHeader
                title="Transactions"
                description="Manage all your income and expenses in one place."
            />
            <TransactionList />
        </div>
    )
}
