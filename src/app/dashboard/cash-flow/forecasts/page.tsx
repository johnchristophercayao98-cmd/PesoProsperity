import { PageHeader } from "@/components/dashboard/page-header";
import { CashflowForecast } from "@/components/dashboard/cash-flow/cashflow-forecast";

export default function ForecastsPage() {
    return (
        <div>
            <PageHeader
                title="Cash Flow Forecasts"
                description="Project your future cash flow to make proactive business decisions."
            />
            <CashflowForecast />
        </div>
    )
}
