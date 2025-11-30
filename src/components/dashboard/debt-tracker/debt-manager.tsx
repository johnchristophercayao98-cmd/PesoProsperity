"use client"

import { useState } from "react";
import { debts as initialDebts } from "@/lib/data";
import type { Debt } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, PlusCircle } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format, formatDistanceToNow } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { DatePicker } from "@/components/ui/date-picker";
import { PesoSignIcon } from "@/components/icons/peso-sign";
import { ResponsiveContainer, Pie, PieChart, Cell } from "recharts";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

const debtSchema = z.object({
  creditor: z.string().min(2, "Creditor name is required."),
  totalAmount: z.coerce.number().min(1, "Total amount must be greater than 0."),
  interestRate: z.coerce.number().min(0),
  nextPaymentDue: z.date({ required_error: "Next payment date is required." }),
});
type DebtFormData = z.infer<typeof debtSchema>;

const paymentSchema = z.object({
  amount: z.coerce.number().min(0.01, "Payment amount must be positive."),
});
type PaymentFormData = z.infer<typeof paymentSchema>;

export function DebtManager() {
    const [debts, setDebts] = useState<Debt[]>(initialDebts);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isPayDialogOpen, setIsPayDialogOpen] = useState(false);
    const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
    const { toast } = useToast();

    const addForm = useForm<DebtFormData>({ resolver: zodResolver(debtSchema) });
    const payForm = useForm<PaymentFormData>({ resolver: zodResolver(paymentSchema) });
    
    const handleAddDebt = (data: DebtFormData) => {
        const newDebt: Debt = {
            id: (debts.length + 1).toString(),
            amountPaid: 0,
            ...data,
        };
        setDebts(prev => [...prev, newDebt]);
        toast({ title: "Debt Added!", description: `Debt to ${data.creditor} has been recorded.` });
        addForm.reset();
        setIsAddDialogOpen(false);
    };
    
    const handleRecordPayment = (data: PaymentFormData) => {
        if (!selectedDebt) return;
        setDebts(prev => prev.map(d => 
            d.id === selectedDebt.id 
            ? { ...d, amountPaid: d.amountPaid + data.amount } 
            : d
        ));
        toast({ title: "Payment Recorded!", description: `Payment of ₱${data.amount} for ${selectedDebt.creditor} recorded.` });
        payForm.reset();
        setIsPayDialogOpen(false);
        setSelectedDebt(null);
    };

    const debtChartData = debts.map(d => ({ name: d.creditor, value: d.totalAmount - d.amountPaid })).filter(d => d.value > 0);
    const debtChartConfig = debtChartData.reduce((acc, item, index) => {
        acc[item.name] = { label: item.name, color: COLORS[index % COLORS.length]};
        return acc;
    }, {});


    return (
        <>
            <div className="mb-6 flex justify-end">
                <Button onClick={() => setIsAddDialogOpen(true)}><PlusCircle className="mr-2 h-4 w-4" /> Add New Debt</Button>
            </div>
            <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                    <Card>
                        <CardHeader><CardTitle>Current Debts</CardTitle></CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Creditor</TableHead>
                                        <TableHead>Remaining Balance</TableHead>
                                        <TableHead className="w-[200px]">Progress</TableHead>
                                        <TableHead>Next Payment</TableHead>
                                        <TableHead><span className="sr-only">Actions</span></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {debts.map(debt => {
                                        const remaining = debt.totalAmount - debt.amountPaid;
                                        const progress = (debt.amountPaid / debt.totalAmount) * 100;
                                        return (
                                            <TableRow key={debt.id}>
                                                <TableCell className="font-medium">{debt.creditor}</TableCell>
                                                <TableCell>₱{remaining > 0 ? remaining.toLocaleString() : 'Paid Off'}</TableCell>
                                                <TableCell><Progress value={progress} /></TableCell>
                                                <TableCell>{remaining > 0 ? format(debt.nextPaymentDue, "MMM d, yyyy") : '-'}</TableCell>
                                                <TableCell>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem onClick={() => { setSelectedDebt(debt); setIsPayDialogOpen(true); }}>Record Payment</DropdownMenuItem>
                                                            <DropdownMenuItem>Edit</DropdownMenuItem>
                                                            <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
                <div>
                  <Card>
                    <CardHeader><CardTitle>Debt Distribution</CardTitle></CardHeader>
                    <CardContent>
                       <ChartContainer config={debtChartConfig} className="mx-auto aspect-square h-[250px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                                    <Pie data={debtChartData} dataKey="value" nameKey="name" innerRadius={60} strokeWidth={5}>
                                        {debtChartData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                                </PieChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                    </CardContent>
                  </Card>
                </div>
            </div>

            {/* Add Debt Dialog */}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>Add New Debt</DialogTitle><DialogDescription>Record a new liability.</DialogDescription></DialogHeader>
                    <Form {...addForm}><form onSubmit={addForm.handleSubmit(handleAddDebt)} className="space-y-4">
                        <FormField control={addForm.control} name="creditor" render={({ field }) => (<FormItem><FormLabel>Creditor</FormLabel><FormControl><Input placeholder="e.g., BDO Unibank" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={addForm.control} name="totalAmount" render={({ field }) => (<FormItem><FormLabel>Total Amount (₱)</FormLabel><FormControl><Input type="number" placeholder="500000" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={addForm.control} name="interestRate" render={({ field }) => (<FormItem><FormLabel>Interest Rate (%)</FormLabel><FormControl><Input type="number" placeholder="1.2" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={addForm.control} name="nextPaymentDue" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Next Payment Due</FormLabel><FormControl><DatePicker date={field.value} setDate={field.onChange} /></FormControl><FormMessage /></FormItem>)} />
                        <DialogFooter><DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose><Button type="submit">Add Debt</Button></DialogFooter>
                    </form></Form>
                </DialogContent>
            </Dialog>

            {/* Record Payment Dialog */}
            <Dialog open={isPayDialogOpen} onOpenChange={setIsPayDialogOpen}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><PesoSignIcon className="h-6 w-6 text-primary"/> Record a Payment</DialogTitle>
                        <DialogDescription>For your debt to {selectedDebt?.creditor}.</DialogDescription>
                    </DialogHeader>
                    <Form {...payForm}><form onSubmit={payForm.handleSubmit(handleRecordPayment)} className="space-y-4">
                        <FormField control={payForm.control} name="amount" render={({ field }) => (<FormItem><FormLabel>Payment Amount (₱)</FormLabel><FormControl><Input type="number" placeholder="10000" {...field} autoFocus /></FormControl><FormMessage /></FormItem>)} />
                        <DialogFooter><DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose><Button type="submit">Record Payment</Button></DialogFooter>
                    </form></Form>
                </DialogContent>
            </Dialog>
        </>
    )
}
