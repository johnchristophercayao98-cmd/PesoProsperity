
'use client';

import { useState, useEffect, useMemo } from 'react';
import * as React from 'react';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import type { FinancialGoal } from '@/lib/types';
import { format, formatDistanceToNow } from 'date-fns';
import { MoreHorizontal, PlusCircle, Loader2 } from 'lucide-react';
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
import { DatePicker } from '@/components/ui/date-picker';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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


const goalSchema = z.object({
  name: z.string().min(3, 'Goal name must be at least 3 characters.'),
  targetAmount: z.coerce
    .number()
    .min(1, 'Target amount must be greater than 0.'),
  currentAmount: z.coerce.number().min(0).optional().default(0),
  deadline: z.date().optional(),
});

type GoalFormData = z.infer<typeof goalSchema>;

const addAmountSchema = z.object({
  amount: z.coerce.number().min(0.01, 'Amount must be a positive number.'),
});

type AddAmountFormData = z.infer<typeof addAmountSchema>;

export function GoalsDisplay() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAddAmountDialogOpen, setIsAddAmountDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<FinancialGoal | null>(null);
  const [goalForAmount, setGoalForAmount] = useState<FinancialGoal | null>(
    null
  );
  const [goalToDelete, setGoalToDelete] = useState<FinancialGoal | null>(null);
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();

  const goalsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return collection(firestore, 'users', user.uid, 'financialGoals');
  }, [firestore, user]);

  const { data: goals, isLoading: isLoadingGoals } = useCollection<FinancialGoal>(goalsQuery);

  const form = useForm<GoalFormData>({
    resolver: zodResolver(goalSchema),
    defaultValues: {
      name: '',
      targetAmount: 0,
      currentAmount: 0,
    }
  });

  const addAmountForm = useForm<AddAmountFormData>({
    resolver: zodResolver(addAmountSchema),
    defaultValues: {
      amount: 0,
    }
  });
  
  const toDate = (date: any): Date | undefined => {
    if (!date) return undefined;
    if (date instanceof Date) return date;
    if (date instanceof Timestamp) return date.toDate();
    if (typeof date === 'string' || typeof date === 'number') {
        const parsedDate = new Date(date);
        if (!isNaN(parsedDate.getTime())) {
            return parsedDate;
        }
    }
    return undefined;
  }

  useEffect(() => {
    if (editingGoal) {
      form.reset({
        name: editingGoal.name,
        targetAmount: editingGoal.targetAmount,
        currentAmount: editingGoal.currentAmount,
        deadline: toDate(editingGoal.deadline)
      });
      setIsDialogOpen(true);
    } else {
      form.reset({
        name: '',
        targetAmount: 0,
        currentAmount: 0,
        deadline: undefined,
      });
    }
  }, [editingGoal, form]);

  const handleDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setEditingGoal(null);
    }
  };

  const handleAddAmountDialogOpenChange = (open: boolean) => {
    setIsAddAmountDialogOpen(open);
    if (!open) {
      setGoalForAmount(null);
      addAmountForm.reset();
    }
  };

  const onSubmit = (data: GoalFormData) => {
    if (!user || !firestore) return;

    if (editingGoal) {
      const goalRef = doc(firestore, 'users', user.uid, 'financialGoals', editingGoal.id);
      updateDocumentNonBlocking(goalRef, data);
      toast({
        title: 'Goal Updated!',
        description: `Your goal "${data.name}" has been successfully updated.`,
      });
    } else {
      addDocumentNonBlocking(collection(firestore, 'users', user.uid, 'financialGoals'), {
        name: data.name,
        targetAmount: data.targetAmount,
        currentAmount: data.currentAmount || 0,
        deadline: data.deadline,
        userId: user.uid
      });
      toast({
        title: 'Goal Added!',
        description: `Your new goal "${data.name}" has been successfully added.`,
      });
    }
    form.reset();
    handleDialogOpenChange(false);
  };

  const handleAddAmount = (data: AddAmountFormData) => {
    if (!goalForAmount || !user) return;

    const updatedCurrentAmount = goalForAmount.currentAmount + data.amount;
    const newAmount = Math.min(
      updatedCurrentAmount,
      goalForAmount.targetAmount
    );

    const goalRef = doc(firestore, 'users', user.uid, 'financialGoals', goalForAmount.id);
    updateDocumentNonBlocking(goalRef, { currentAmount: newAmount });

    toast({
      title: 'Amount Added!',
      description: `₱${data.amount.toLocaleString()} has been added to your "${
        goalForAmount.name
      }" goal.`,
    });

    handleAddAmountDialogOpenChange(false);
  };
  
  const handleDeleteGoal = () => {
    if (!goalToDelete || !user) return;
    const goalRef = doc(firestore, 'users', user.uid, 'financialGoals', goalToDelete.id);
    deleteDocumentNonBlocking(goalRef);
    toast({
        title: "Goal Deleted",
        description: `The goal "${goalToDelete.name}" has been deleted.`
    });
    setGoalToDelete(null);
  };

  const openAddDialog = () => {
    setEditingGoal(null);
    form.reset({
      name: '',
      targetAmount: 0,
      currentAmount: 0,
    });
    setIsDialogOpen(true);
  };

  const dialogTitle = editingGoal
    ? 'Edit Financial Goal'
    : 'Add New Financial Goal';
  const dialogDescription = editingGoal
    ? 'Update the details of your financial objective.'
    : 'Define your new objective to start tracking your progress.';

  return (
    <>
      <div className="mb-6 flex justify-end">
        <Button onClick={openAddDialog}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add New Goal
        </Button>
      </div>
      <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>{dialogDescription}</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              id="goal-form"
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Goal Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., New Office Equipment"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="targetAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target Amount (₱)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="150000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="currentAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Amount (₱)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="0"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="deadline"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Deadline (Optional)</FormLabel>
                    <FormControl>
                      <DatePicker
                        date={field.value}
                        setDate={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" form="goal-form">
              Save Goal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isAddAmountDialogOpen}
        onOpenChange={handleAddAmountDialogOpenChange}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add to Goal: {goalForAmount?.name}</DialogTitle>
            <DialogDescription>
              Add an amount to your financial goal. The current progress is
              ₱{goalForAmount?.currentAmount.toLocaleString()} /
              ₱{goalForAmount?.targetAmount.toLocaleString()}.
            </DialogDescription>
          </DialogHeader>
          <Form {...addAmountForm}>
            <form
              onSubmit={addAmountForm.handleSubmit(handleAddAmount)}
              className="space-y-4"
            >
              <FormField
                control={addAmountForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount to Add (₱)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="5000"
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
                <Button type="submit">Add Amount</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
       <AlertDialog open={!!goalToDelete} onOpenChange={(open) => !open && setGoalToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the goal "{goalToDelete?.name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setGoalToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteGoal}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isLoadingGoals ? (
         <div className="flex items-center justify-center p-8">
            <Loader2 className="mr-2 h-8 w-8 animate-spin" />
            <p>Loading goals...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {goals && goals.map((goal) => {
            const progress = (goal.currentAmount / goal.targetAmount) * 100;
            const deadlineDate = toDate(goal.deadline);
            return (
                <Card key={goal.id} className='flex flex-col'>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className='text-lg'>{goal.name}</CardTitle>
                    <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem
                        onClick={() => {
                            setGoalForAmount(goal);
                            handleAddAmountDialogOpenChange(true);
                        }}
                        >
                        Add Amount
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setEditingGoal(goal)}>
                        Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setGoalToDelete(goal)}
                        >
                        Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                    </DropdownMenu>
                </CardHeader>
                <CardContent className='flex-grow'>
                    <div className="mb-2 text-sm sm:text-base">
                    <span className="text-2xl font-bold">
                        ₱{goal.currentAmount.toLocaleString()}
                    </span>
                    <span className="text-muted-foreground">
                        {' '}
                        / ₱{goal.targetAmount.toLocaleString()}
                    </span>
                    </div>
                    <Progress value={progress} className="w-full" />
                    <div className="mt-2 text-sm text-muted-foreground">
                    {progress.toFixed(1)}% complete
                    </div>
                </CardContent>
                <CardFooter>
                    {deadlineDate ? (
                    <p className="text-sm text-muted-foreground">
                        Deadline:{' '}
                        {format(deadlineDate, 'MMM d, yyyy')} (
                        {formatDistanceToNow(deadlineDate, { addSuffix: true })})
                    </p>
                    ) : (
                    <p className="text-sm text-muted-foreground">
                        No deadline set
                    </p>
                    )}
                </CardFooter>
                </Card>
            );
            })}
        </div>
        )}
    </>
  );
}
