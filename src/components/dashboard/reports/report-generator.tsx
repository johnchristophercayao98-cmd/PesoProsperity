"use client"

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function ReportGenerator() {
    const [reportType, setReportType] = useState<string>();
    const [startDate, setStartDate] = useState<Date>();
    const [endDate, setEndDate] = useState<Date>();
    const { toast } = useToast();
    
    const handleExport = () => {
        if (!reportType || !startDate || !endDate) {
            toast({
                variant: "destructive",
                title: "Incomplete Form",
                description: "Please select a report type and date range.",
            });
            return;
        }

        toast({
            title: "Generating Report...",
            description: `Your ${reportType} report from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()} is being prepared.`,
        });

        // Mock CSV generation
        setTimeout(() => {
            const headers = "Date,Description,Category,Amount\n";
            const rows = [
                "2024-07-15,Product Sale,Income,5000",
                "2024-07-14,Office Supplies,Expense,350",
                "2024-07-13,Client Payment,Income,12000",
            ].join("\n");
            const csvContent = headers + rows;
            
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            if (link.download !== undefined) {
                const url = URL.createObjectURL(blob);
                link.setAttribute("href", url);
                link.setAttribute("download", `report-${reportType}-${Date.now()}.csv`);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }

             toast({
                title: "Report Exported!",
                description: "Your report has been downloaded.",
            });

        }, 1500);
    };

    return (
        <Card className="max-w-2xl mx-auto">
            <CardHeader>
                <CardTitle>Generate a Report</CardTitle>
                <CardDescription>Select the type of report and the date range you want to cover.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <Label htmlFor="report-type">Report Type</Label>
                    <Select onValueChange={setReportType}>
                        <SelectTrigger id="report-type">
                            <SelectValue placeholder="Select a report type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="income-vs-expense">Income vs. Expense</SelectItem>
                            <SelectItem value="budget-variance">Budget vs. Actual Variance</SelectItem>
                            <SelectItem value="debt-payoff">Debt Payoff Progress</SelectItem>
                            <SelectItem value="cash-flow-statement">Cash Flow Statement</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Start Date</Label>
                        <DatePicker date={startDate} setDate={setStartDate} />
                    </div>
                     <div className="space-y-2">
                        <Label>End Date</Label>
                        <DatePicker date={endDate} setDate={setEndDate} />
                    </div>
                </div>
                <Button className="w-full" onClick={handleExport}>
                    <Download className="mr-2 h-4 w-4" />
                    Generate & Export CSV
                </Button>
            </CardContent>
        </Card>
    )
}
