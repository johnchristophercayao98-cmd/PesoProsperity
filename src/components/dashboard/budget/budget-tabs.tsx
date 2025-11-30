"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, FileText, PlusCircle } from "lucide-react";
import { suggestMonthlyBudget, SuggestMonthlyBudgetOutput } from "@/ai/flows/automated-budget-suggestions";
import { sampleBudget } from "@/lib/data";
import type { Budget, BudgetCategory } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ResponsiveContainer, Pie, PieChart, Cell } from "recharts";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

export function BudgetTabs() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [aiResult, setAiResult] = useState<SuggestMonthlyBudgetOutput | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setFileName(file.name);
    setAiResult(null);

    try {
      const content = await file.text();
      const result = await suggestMonthlyBudget({ financialData: content });
      
      if (result.suggestedBudget && JSON.parse(result.suggestedBudget).error) {
        toast({
          variant: "destructive",
          title: "AI Analysis Error",
          description: "The AI could not process the uploaded file. Please check the format and try again.",
        });
        setAiResult(null);
      } else {
        setAiResult(result);
        toast({
          title: "AI Budget Suggestion Ready!",
          description: "Your automated budget suggestion has been generated.",
        });
      }

    } catch (error) {
      console.error("Error processing file with AI:", error);
      toast({
        variant: "destructive",
        title: "An Error Occurred",
        description: "Could not process the file. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderBudgetTable = (title: string, data: BudgetCategory[]) => (
    <div className="mb-4">
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Category</TableHead>
            <TableHead className="text-right">Budgeted</TableHead>
            <TableHead className="text-right">Actual</TableHead>
            <TableHead className="text-right">Variance</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => {
            const variance = item.budgeted - item.actual;
            return (
              <TableRow key={item.name}>
                <TableCell>{item.name}</TableCell>
                <TableCell className="text-right">₱{item.budgeted.toLocaleString()}</TableCell>
                <TableCell className="text-right">₱{item.actual.toLocaleString()}</TableCell>
                <TableCell className="text-right">
                  <Badge variant={variance >= 0 ? 'default' : 'destructive'} className={variance >= 0 ? "bg-green-600/80" : ""}>
                    ₱{Math.abs(variance).toLocaleString()}
                  </Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );

  const renderPieChart = (title: string, data: BudgetCategory[]) => {
    const chartData = data.map(item => ({ name: item.name, value: item.actual }));
    const chartConfig = data.reduce((acc, item, index) => {
      acc[item.name] = { label: item.name, color: COLORS[index % COLORS.length] };
      return acc;
    }, {});
    
    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="mx-auto aspect-square h-[250px]">
            <ResponsiveContainer>
                <PieChart>
                    <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                    <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={60} strokeWidth={5}>
                        {chartData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <ChartLegend content={<ChartLegendContent />} />
                </PieChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>
    );
  };

  return (
    <Tabs defaultValue="manual">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="manual">Manual Budget</TabsTrigger>
        <TabsTrigger value="ai">AI Budget Suggester</TabsTrigger>
      </TabsList>
      <TabsContent value="manual">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>{sampleBudget.month}</CardTitle>
              <CardDescription>
                Here is your current budget overview. You can edit amounts directly in the table.
              </CardDescription>
            </div>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Budget
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              <div>
                {renderBudgetTable("Income", sampleBudget.income)}
                {renderPieChart("Income Sources", sampleBudget.income)}
              </div>
              <div>
                {renderBudgetTable("Expenses", sampleBudget.expenses)}
                {renderPieChart("Expense Categories", sampleBudget.expenses)}
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="ai">
        <Card>
          <CardHeader>
            <CardTitle>AI Budget Suggester</CardTitle>
            <CardDescription>
              Upload a CSV of your financial data to get a personalized budget suggestion.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="financial-data-file" className="sr-only">Upload File</Label>
              <Input id="financial-data-file" type="file" accept=".csv, text/csv" className="hidden" onChange={handleFileChange} disabled={isLoading} />
              <Button asChild variant="outline" className="w-full cursor-pointer">
                <label htmlFor="financial-data-file">
                  <Upload className="mr-2 h-4 w-4" />
                  Choose a file
                </label>
              </Button>
            </div>
            {isLoading && (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="mr-2 h-8 w-8 animate-spin" />
                <p>AI is analyzing your data...</p>
              </div>
            )}
            {fileName && !isLoading && (
              <div className="flex items-center p-3 rounded-md border bg-secondary/50">
                <FileText className="h-5 w-5 mr-2 text-primary"/>
                <span className="text-sm font-medium">{fileName}</span>
              </div>
            )}
            {aiResult && aiResult.suggestedBudget && (
              <Card className="bg-secondary/50">
                <CardHeader>
                  <CardTitle>Suggested Budget</CardTitle>
                  <CardDescription>{aiResult.explanation}</CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="p-4 bg-background rounded-md text-sm overflow-x-auto">
                    {JSON.stringify(JSON.parse(aiResult.suggestedBudget), null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
