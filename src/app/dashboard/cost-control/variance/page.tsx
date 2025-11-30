import { PageHeader } from "@/components/dashboard/page-header";
import { VarianceReport } from "@/components/dashboard/variance/variance-report";

export default function VariancePage() {
    return (
        <div>
            <PageHeader
                title="Budget vs. Actual Variance"
                description="Analyze your spending by comparing budgeted amounts to actual expenses."
            />
            <VarianceReport />
        </div>
    )
}
