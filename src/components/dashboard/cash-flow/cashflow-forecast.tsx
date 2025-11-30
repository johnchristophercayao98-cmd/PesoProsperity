
"use client"

import { useState, useEffect } from "react";
import { format, getMonth, getYear, addMonths } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { DollarSign, TrendingDown, TrendingUp, Info, Calendar as CalendarIcon } from "lucide-react"
import { Line, LineChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";

const generateForecastData = (startDate: Date) => {
    const data = [];
    let lastBalance = 2000;
    for (let i = 0; i < 6; i++) {
        const date = addMonths(startDate, i);
        const cashIn = Math.round(4000 * (1 + Math.sin(getMonth(date) + i) * 0.2));
        const cashOut = Math.round(2400 * (1 + Math.cos(getMonth(date) + i) * 0.15));
        const balance = lastBalance + cashIn - cashOut;
        data.push({
            month: format(date, "MMM 'yy"),
            cashIn,
            cashOut,
            balance
        });
        lastBalance = balance;
    }
    return data;
}

const chartConfig = {
    balance: { label: "Cash Balance", color: "hsl(var(--chart-1))" },
    cashIn: { label: "Cash In", color: "hsl(var(--chart-2))" },
    cashOut: { label: "Cash Out", color: "hsl(var(--destructive))" },
}

export function CashflowForecast() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [forecastData, setForecastData] = useState(() => generateForecastData(new Date()));

  useEffect(() => {
    setForecastData(generateForecastData(selectedDate));
  }, [selectedDate]);

  const lowestPoint = Math.min(...forecastData.map(d => d.balance));
  const lowestPointMonth = forecastData.find(d => d.balance === lowestPoint)?.month || '';

  const netCashFlow = forecastData.reduce((acc, d) => acc + d.cashIn - d.cashOut, 0);

  return (
    <div className="grid gap-6">
        <div className="flex items-center justify-between">
            <Alert className="w-fit">
                <Info className="h-4 w-4" />
                <AlertTitle>Cash Reserve Reminder</AlertTitle>
                <AlertDescription>
                Maintain a sufficient cash reserve to cover expenses during low-sales months. We recommend at least 3 months of operating expenses.
                </AlertDescription>
            </Alert>
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
      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>6-Month Cash Flow Forecast</CardTitle>
            <CardDescription>Starting from {format(selectedDate, "MMMM yyyy")}.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[350px] w-full">
              <ResponsiveContainer>
                <LineChart data={forecastData}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis tickFormatter={(value) => `₱${value/1000}k`} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Line type="monotone" dataKey="balance" stroke="var(--color-balance)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="cashIn" stroke="var(--color-cashIn)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="cashOut" stroke="var(--color-cashOut)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
        <div className="space-y-6">
             <Card>
                <CardHeader className="flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Projected Net Cash Flow</CardTitle>
                    {netCashFlow >= 0 ? <TrendingUp className="h-4 w-4 text-muted-foreground" /> : <TrendingDown className="h-4 w-4 text-muted-foreground" />}
                </CardHeader>
                <CardContent>
                    <div className={`text-2xl font-bold ${netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {netCashFlow >= 0 ? '+' : '-'}₱{Math.abs(netCashFlow).toLocaleString()}
                    </div>
                    <p className="text-xs text-muted-foreground">in the next 6 months</p>
                </CardContent>
             </Card>
             <Card>
                <CardHeader className="flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Lowest Projected Balance</CardTitle>
                    <TrendingDown className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className={`text-2xl font-bold ${lowestPoint < 0 ? 'text-red-600' : ''}`}>₱{lowestPoint.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">in {lowestPointMonth}</p>
                </CardContent>
             </Card>
             <Card>
                <CardHeader className="flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Starting Cash Balance</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">₱120,780</div>
                    <p className="text-xs text-muted-foreground">Current available cash</p>
                </CardContent>
             </Card>
        </div>
      </div>
    </div>
  )
}
