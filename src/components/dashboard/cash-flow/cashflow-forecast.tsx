
"use client"

import { useState, useEffect } from "react";
import { format, getMonth, getYear } from "date-fns";
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

const initialForecastData = [
  { month: "Jul '24", cashIn: 4000, cashOut: 2400, balance: 2000 },
  { month: "Aug '24", cashIn: 3000, cashOut: 1398, balance: 3602 },
  { month: "Sep '24", cashIn: 2000, cashOut: 5800, balance: -200 },
  { month: "Oct '24", cashIn: 2780, cashOut: 3908, balance: -1328 },
  { month: "Nov '24", cashIn: 1890, cashOut: 4800, balance: -4238 },
  { month: "Dec '24", cashIn: 5390, cashOut: 3800, balance: -2648 },
];

const chartConfig = {
    balance: { label: "Cash Balance", color: "hsl(var(--chart-1))" },
    cashIn: { label: "Cash In", color: "hsl(var(--chart-2))" },
    cashOut: { label: "Cash Out", color: "hsl(var(--destructive))" },
}

export function CashflowForecast() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [forecastData, setForecastData] = useState(initialForecastData);

  useEffect(() => {
    // Simulate fetching new data based on the selected date
    const month = getMonth(selectedDate);
    const year = getYear(selectedDate);
    
    // Create some pseudo-random data based on the date
    const newForecastData = initialForecastData.map((d, i) => ({
      ...d,
      cashIn: Math.abs(d.cashIn * Math.sin(month + i) * 1.2),
      cashOut: Math.abs(d.cashOut * Math.cos(month + i) * 1.1),
      balance: d.balance + (month * 100)
    }));
    setForecastData(newForecastData);
  }, [selectedDate]);

  const lowestPoint = Math.min(...forecastData.map(d => d.balance));
  const lowestPointMonth = forecastData.find(d => d.balance === lowestPoint)?.month || '';

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
            <CardDescription>Based on recurring transactions and historical data for {format(selectedDate, "MMMM yyyy")}.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[350px] w-full">
              <ResponsiveContainer>
                <LineChart data={forecastData}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis />
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
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">+₱15,231</div>
                    <p className="text-xs text-muted-foreground">in the next 6 months</p>
                </CardContent>
             </Card>
             <Card>
                <CardHeader className="flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Lowest Projected Balance</CardTitle>
                    <TrendingDown className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-red-600">₱{lowestPoint.toLocaleString()}</div>
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
