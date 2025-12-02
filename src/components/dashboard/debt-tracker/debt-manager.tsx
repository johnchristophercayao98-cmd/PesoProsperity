
'use client';

import { useState, useEffect, useMemo } from 'react';
import type { Debt } from '@/lib/types';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  MoreHorizontal,
  PlusCircle,
  Calendar as CalendarIcon,
  Loader2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';
import { DatePicker } from '@/components/ui/date-picker';
import { PesoSignIcon } from '@/components/icons/peso-sign';
import { ResponsiveContainer, Pie, PieChart, Cell } from 'recharts';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  useFirestore,
  useUser,
  useCollection,
  useMemoFirebase,
  addDocumentNonBlocking,
  updateDocumentNonBlocking,
  deleteDocumentNonBlocking,
} from '@/firebase';
import { collection, doc, Timestamp } from 'firebase/firestore';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';


const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

const debtSchema = z.object({
  creditor: z.string().min(2, 'Creditor name is required.'),
  totalAmount: z.coerce.number().min(1, 'Total amount must be greater than 0.'),
  amountPaid: z.coerce.number().min(0).optional().default(0),
  interestRate: z.coerce.number().min(0),
  nextPaymentDue: z.date({ required_error: 'Next payment date is required.' }),
});
type DebtFormData = z.infer<typeof debtSchema>;

const paymentSchema = z.object({
  amount: z.coerce.number().min(0.01, 'Payment amount must be positive.'),
});
type PaymentFormData = z.infer<typeof paymentSchema>;

export function DebtManager() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isPayDialogOpen, setIsPayDialogOpen] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [debtToDelete, setDebtToDelete] = useState<Debt | null>(null);
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();

  const debtsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return collection(firestore, 'users', user.uid, 'debts');
  }, [firestore, user]);

  const { data: debts, isLoading: isLoadingDebts } = useCollection<Debt>(debtsQuery);

  const addForm = useForm<DebtFormData>({ 
    resolver: zodResolver(debtSchema),
    defaultValues: {
      creditor: '',
      totalAmount: 0,
      amountPaid: 0,
      interestRate: 0,
      nextPaymentDue: new Date(),
    }
  });
  const payForm = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount: 0,
    }
  });
  
  const toDate = (date: any): Date | undefined => {
    if (!date) return undefined;
    if (date instanceof Date) return date;
    if (date instanceof Timestamp) return date.toDate();
    if (typeof date === 'string' || typeof date === 'number') return new Date(date);
    return undefined;
  }

  useEffect(() => {
    if (editingDebt) {
        addForm.reset({
            creditor: editingDebt.creditor,
            totalAmount: editingDebt.totalAmount,
            amountPaid: editingDebt.amountPaid,
            interestRate: editingDebt.interestRate,
            nextPaymentDue: toDate(editingDebt.nextPaymentDue)!
        });
        setIsAddDialogOpen(true);
    }
  }, [editingDebt, addForm])

  const handleAddDebt = (data: DebtFormData) => {
    if (!user) return;
    if (editingDebt) {
        const debtRef = doc(firestore, 'users', user.uid, 'debts', editingDebt.id);
        updateDocumentNonBlocking(debtRef, data);
        toast({ title: 'Debt Updated!', description: `Debt to ${data.creditor} has been updated.` });
    } else {
        addDocumentNonBlocking(collection(firestore, 'users', user.uid, 'debts'), {
            userId: user.uid,
            ...data
        });
        toast({ title: 'Debt Added!', description: `Debt to ${data.creditor} has been recorded.` });
    }
    
    addForm.reset();
    setIsAddDialogOpen(false);
    setEditingDebt(null);
  };

  const handleRecordPayment = (data: PaymentFormData) => {
    if (!selectedDebt || !user) return;
    const newAmountPaid = selectedDebt.amountPaid + data.amount;
    const debtRef = doc(firestore, 'users', user.uid, 'debts', selectedDebt.id);
    updateDocumentNonBlocking(debtRef, {
        amountPaid: Math.min(newAmountPaid, selectedDebt.totalAmount)
    })
    
    toast({
      title: 'Payment Recorded!',
      description: `Payment of ₱${data.amount} for ${selectedDebt.creditor} recorded.`,
    });
    payForm.reset();
    setIsPayDialogOpen(false);
    setSelectedDebt(null);
  };
  
  const handleDeleteDebt = () => {
    if (!debtToDelete || !user) return;
    const debtRef = doc(firestore, 'users', user.uid, 'debts', debtToDelete.id);
    deleteDocumentNonBlocking(debtRef);
    toast({
        title: "Debt Deleted",
        description: `The debt to "${debtToDelete.creditor}" has been removed.`
    })
    setDebtToDelete(null);
  }

  const debtChartData =
    debts
      ?.map((d) => ({
        name: d.creditor,
        value: d.totalAmount - d.amountPaid,
      }))
      .filter((d) => d.value > 0) || [];
  const debtChartConfig = debtChartData.reduce((acc, item, index) => {
    acc[item.name] = { label: item.name, color: COLORS[index % COLORS.length] };
    return acc;
  }, {});

  return (
    <>
      <div className="mb-6 flex items-center justify-end gap-2">
        <Button onClick={() => { setEditingDebt(null); addForm.reset(); setIsAddDialogOpen(true); }}>
          <PlusCircle className="mr-2 h-4 w-4" /> Add New Debt
        </Button>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Current Debts</CardTitle>
            </CardHeader>
            <CardContent>
            {isLoadingDebts ? (
                <div className="flex items-center justify-center p-8">
                    <Loader2 className="mr-2 h-8 w-8 animate-spin" />
                    <p>Loading debts...</p>
                </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Creditor</TableHead>
                    <TableHead>Remaining Balance</TableHead>
                    <TableHead className="w-[200px]">Progress</TableHead>
                    <TableHead>Next Payment</TableHead>
                    <TableHead>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {debts && debts.map((debt) => {
                    const remaining = debt.totalAmount - debt.amountPaid;
                    const progress =
                      (debt.amountPaid / debt.totalAmount) * 100;
                    const nextPaymentDate = toDate(debt.nextPaymentDue);
                    return (
                      <TableRow key={debt.id}>
                        <TableCell className="font-medium">
                          {debt.creditor}
                        </TableCell>
                        <TableCell>
                          ₱{remaining > 0 ? remaining.toLocaleString() : 'Paid Off'}
                        </TableCell>
                        <TableCell>
                          <Progress value={progress} />
                        </TableCell>
                        <TableCell>
                          {remaining > 0 && nextPaymentDate
                            ? format(nextPaymentDate, 'MMM d, yyyy')
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedDebt(debt);
                                  setIsPayDialogOpen(true);
                                }}
                              >
                                Record Payment
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setEditingDebt(debt)}>Edit</DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setDebtToDelete(debt)}
                              >
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              )}
            </CardContent>
          </Card>
        </div>
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Debt Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={debtChartConfig}
                className="mx-auto aspect-square h-[250px]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                    <Pie
                      data={debtChartData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={60}
                      strokeWidth={5}
                    >
                      {debtChartData.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
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
      
      <AlertDialog open={!!debtToDelete} onOpenChange={(open) => !open && setDebtToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will permanently delete the debt to "{debtToDelete?.creditor}".
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setDebtToDelete(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteDebt}>Delete</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add/Edit Debt Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={(open) => { setIsAddDialogOpen(open); if (!open) setEditingDebt(null)}}>
        <DialogContent className="sm:max-w-md flex flex-col max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{editingDebt ? 'Edit' : 'Add New'} Debt</DialogTitle>
            <DialogDescription>
              {editingDebt ? 'Update this liability.' : 'Record a new liability.'}
            </DialogDescription>
          </DialogHeader>
          <div className='flex-1 overflow-y-auto -mr-6 pr-6'>
            <Form {...addForm}>
              <form
                id="debt-form"
                onSubmit={addForm.handleSubmit(handleAddDebt)}
                className="space-y-4"
              >
                  <FormField
                    control={addForm.control}
                    name="creditor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Creditor</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., BDO Unibank" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={addForm.control}
                    name="totalAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total Amount (₱)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="500000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={addForm.control}
                    name="interestRate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Interest Rate (%)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="1.2" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={addForm.control}
                    name="nextPaymentDue"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Next Payment Due</FormLabel>
                        <FormControl>
                          <DatePicker date={field.value} setDate={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
              </form>
            </Form>
          </div>
          <DialogFooter className='pt-4'>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" form="debt-form">{editingDebt ? 'Save Changes' : 'Add Debt'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog open={isPayDialogOpen} onOpenChange={setIsPayDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PesoSignIcon className="h-6 w-6 text-primary" /> Record a
              Payment
            </DialogTitle>
            <DialogDescription>
              For your debt to {selectedDebt?.creditor}.
            </DialogDescription>
          </DialogHeader>
          <Form {...payForm}>
            <form
              onSubmit={payForm.handleSubmit(handleRecordPayment)}
              className="space-y-4"
            >
              <FormField
                control={payForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Amount (₱)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="10000"
                        {...field}
                        autoFocus
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="secondary">
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="submit">Record Payment</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
