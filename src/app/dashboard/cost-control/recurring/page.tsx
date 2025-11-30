import { PageHeader } from "@/components/dashboard/page-header";
import { RecurringList } from "@/components/dashboard/recurring/recurring-list";

export default function RecurringPage() {
    return (
        <div>
            <PageHeader
                title="Recurring Transactions"
                description="Manage your regular income and expenses to automate your budget."
            />
            <RecurringList />
        </div>
    )
}
