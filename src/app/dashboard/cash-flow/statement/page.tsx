import { PageHeader } from "@/components/dashboard/page-header";
import { CashflowStatement } from "@/components/dashboard/cash-flow/cashflow-statement";

export default function StatementPage() {
    return (
        <div>
            <PageHeader
                title="Cash Flow Statement"
                description="Track your cash inflows and outflows to see your running cash balance."
            />
            <CashflowStatement />
        </div>
    )
}
