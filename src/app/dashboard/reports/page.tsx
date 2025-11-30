import { PageHeader } from "@/components/dashboard/page-header";
import { ReportGenerator } from "@/components/dashboard/reports/report-generator";

export default function ReportsPage() {
    return (
        <div>
            <PageHeader
                title="Financial Reports"
                description="Generate and export detailed financial reports for your business."
            />
            <ReportGenerator />
        </div>
    )
}
