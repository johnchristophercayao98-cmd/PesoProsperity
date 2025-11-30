import { PageHeader } from "@/components/dashboard/page-header";
import { DebtManager } from "@/components/dashboard/debt-tracker/debt-manager";

export default function DebtTrackerPage() {
    return (
        <div>
            <PageHeader
                title="Debt Tracker"
                description="Monitor and manage your liabilities to improve your financial health."
            />
            <DebtManager />
        </div>
    )
}
