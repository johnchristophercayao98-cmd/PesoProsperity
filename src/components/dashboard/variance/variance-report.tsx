
"use client"

import { useState, useEffect } from "react";
import { format, getMonth, getYear } from "date-fns";
import { sampleBudget as initialSampleBudget } from "@/lib/data"
import type { Budget } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, TrendingDown, TrendingUp, Calendar as CalendarIcon } from "lucide-react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Cell } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

export function VarianceReport() {
    const [sampleBudget, setSampleBudget] = useState<Budget>(initialSampleBudget);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date(2024, 6, 1));
    
    useEffect(() => {
        // Simulate fetching new data based on the selected date
        const month = getMonth(selectedDate);
        const year = getYear(selectedDate);
        
        const newBudgetData: Budget = {
            month: format(selectedDate, "MMMM yyyy"),
            income: initialSampleBudget.income.map(item => ({
                ...item,
                budgeted: Math.round(item.budgeted * (1 + Math.sin(month) * 0.1)),
                actual: Math.round(item.actual * (1 + Math.cos(month) * 0.15)),
            })),
            expenses: initialSampleBudget.expenses.map(item => ({
                ...item,
                budgeted: Math.round(item.budgeted * (1 + Math.sin(month + 1) * 0.05)),
                actual: Math.round(item.actual * (1 + Math.cos(month + 1) * 0.1)),
            })),
        };
        setSampleBudget(newBudgetData);
    }, [selectedDate]);

    const { income, expenses } = sampleBudget;
    const overspentItems = expenses.filter(item => item.actual > item.budgeted);

    const varianceData = expenses.map(item => ({
        name: item.name,
        variance: item.budgeted - item.actual,
    }));

    const chartConfig = {
      variance: {
        label: "Variance",
      },
    }

    const CustomBar = (props: any) => {
      const { fill, x, y, width, height, payload } = props;
      const isNegative = payload.variance < 0;
      return <rect x={x} y={isNegative ? y - Math.abs(height) : y} width={width} height={Math.abs(height)} fill={isNegative ? "hsl(var(--destructive))" : "hsl(var(--chart-2))"} />;
    };
    
    return (
        <div className="grid gap-6">
            <div className="flex justify-end">
                <Popover>
                    <PopoverTrigger asChild>
                    <Button variant="outline">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(selectedDate, "MMMM yyyy")}
                    </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                    <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={(date) => {
                        if(date) setSelectedDate(date);
                        }}
                        initialFocus
                        captionLayout="dropdown-buttons"
                        fromYear={2020}
                        toYear={2030}
                    />
                    </PopoverContent>
                </Popover>
            </div>
            {overspentItems.length > 0 && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Overspending Alert!</AlertTitle>
                    <AlertDescription>
                        You have exceeded your budget in the following categories: {overspentItems.map(i => i.name).join(', ')}.
                    </AlertDescription>
                </Alert>
            )}

            <div className="grid md:grid-cols-2 gap-6">
                 <Card>
                    <CardHeader>
                        <CardTitle>Expense Variance Chart</CardTitle>
                        <CardDescription>For {format(selectedDate, "MMMM yyyy")}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer config={chartConfig} className="h-[300px] w-full">
                           <ResponsiveContainer>
                             <BarChart data={varianceData} layout="vertical" margin={{left: 10}}>
                                <CartesianGrid horizontal={false} />
                                <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tickMargin={10} width={80} />
                                <XAxis dataKey="variance" type="number" hide />
                                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                                <Bar dataKey="variance" radius={5}>
                                  {varianceData.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={entry.variance < 0 ? 'hsl(var(--destructive))' : 'hsl(var(--chart-2))'} />
                                  ))}
                                </Bar>
                            </BarChart>
                           </ResponsiveContainer>
                        </ChartContainer>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Summary</CardTitle>
                        <CardDescription>For {format(selectedDate, "MMMM yyyy")}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between p-4 rounded-md bg-secondary/50">
                            <div>
                                <p className="text-sm text-muted-foreground">Total Budgeted</p>
                                <p className="text-2xl font-bold">₱{ (income.reduce((a, b) => a + b.budgeted, 0) - expenses.reduce((a, b) => a + b.budgeted, 0)).toLocaleString() }</p>
                            </div>
                            <div className="flex items-center justify-between p-4 rounded-md bg-secondary/50">
                                <p className="text-sm text-muted-foreground">Total Actual</p>
                                <p className="text-2xl font-bold">₱{ (income.reduce((a, b) => a + b.actual, 0) - expenses.reduce((a, b) => a + b.actual, 0)).toLocaleString() }</p>
                            </div>
                        </div>
                         <div className="flex items-center p-4 rounded-md border">
                            <TrendingUp className="h-6 w-6 mr-4 text-green-600"/>
                            <div>
                                <p className="text-sm text-muted-foreground">Favorable Variances (Savings)</p>
                                <p className="text-lg font-semibold">₱{expenses.filter(i => i.budgeted > i.actual).reduce((acc, i) => acc + (i.budgeted - i.actual), 0).toLocaleString()}</p>
                            </div>
                        </div>
                        <div className="flex items-center p-4 rounded-md border">
                            <TrendingDown className="h-6 w-6 mr-4 text-red-600"/>
                             <div>
                                <p className="text-sm text-muted-foreground">Unfavorable Variances (Overspent)</p>
                                <p className="text-lg font-semibold">₱{expenses.filter(i => i.budgeted < i.actual).reduce((acc, i) => acc + (i.actual - i.budgeted), 0).toLocaleString()}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Detailed Report</CardTitle>
                    <CardDescription>For {format(selectedDate, "MMMM yyyy")}</CardDescription>
                </CardHeader>
                <CardContent>
                    <h3 className="text-lg font-semibold mb-2">Income</h3>
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
                            {income.map(item => {
                                const variance = item.actual - item.budgeted;
                                return (
                                    <TableRow key={item.name}>
                                        <TableCell>{item.name}</TableCell>
                                        <TableCell className="text-right">₱{item.budgeted.toLocaleString()}</TableCell>
                                        <TableCell className="text-right">₱{item.actual.toLocaleString()}</TableCell>
                                        <TableCell className="text-right"><Badge variant={variance >= 0 ? "default" : "destructive"} className={variance >= 0 ? "bg-green-600/80" : ""}>₱{Math.abs(variance).toLocaleString()}</Badge></TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>

                    <h3 className="text-lg font-semibold mt-6 mb-2">Expenses</h3>
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
                            {expenses.map(item => {
                                const variance = item.budgeted - item.actual;
                                return (
                                    <TableRow key={item.name}>
                                        <TableCell>{item.name}</TableCell>
                                        <TableCell className="text-right">₱{item.budgeted.toLocaleString()}</TableCell>
                                        <TableCell className="text-right">₱{item.actual.toLocaleString()}</TableCell>
                                        <TableCell className="text-right"><Badge variant={variance >= 0 ? "default" : "destructive"} className={variance >= 0 ? "bg-green-600/80" : ""}>₱{Math.abs(variance).toLocaleString()}</Badge></TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
