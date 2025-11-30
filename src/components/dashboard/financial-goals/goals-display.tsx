"use client";

import { useState } from "react";
import * as React from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { financialGoals as initialGoals } from "@/lib/data";
import type { FinancialGoal } from "@/lib/types";
import { format, formatDistanceToNow } from "date-fns";
import { MoreHorizontal, PlusCircle } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const goalSchema = z.object({
  name: z.string().min(3, "Goal name must be at least 3 characters."),
  targetAmount: z.coerce.number().min(1, "Target amount must be greater than 0."),
  currentAmount: z.coerce.number().min(0).optional(),
  deadline: z.date().optional(),
});

type GoalFormData = z.infer<typeof goalSchema>;

const addAmountSchema = z.object({
  amount: z.coerce.number().min(0.01, "Amount must be a positive number."),
});

type AddAmountFormData = z.infer<typeof addAmountSchema>;

export function GoalsDisplay() {
  const [goals, setGoals] = useState<FinancialGoal[]>(initialGoals);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAddAmountDialogOpen, setIsAddAmountDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<FinancialGoal | null>(null);
  const [goalForAmount, setGoalForAmount] = useState<FinancialGoal | null>(null);
  const { toast } = useToast();

  const form = useForm<GoalFormData>({
    resolver: zodResolver(goalSchema),
  });

  const addAmountForm = useForm<AddAmountFormData>({
    resolver: zodResolver(addAmountSchema),
  });

  React.useEffect(() => {
    if (editingGoal) {
      form.reset({
        name: editingGoal.name,
        targetAmount: editingGoal.targetAmount,
        currentAmount: editingGoal.currentAmount,
        deadline: editingGoal.deadline ? new Date(editingGoal.deadline) : undefined,
      });
      setIsDialogOpen(true);
    } else {
      form.reset({
        name: "",
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
  }

  const onSubmit = (data: GoalFormData) => {
    if (editingGoal) {
      const updatedGoal: FinancialGoal = {
        ...editingGoal,
        ...data,
        currentAmount: data.currentAmount || 0,
      };
      setGoals(goals.map(g => g.id === editingGoal.id ? updatedGoal : g));
      toast({
        title: "Goal Updated!",
        description: `Your goal "${data.name}" has been successfully updated.`,
      });
    } else {
      const newGoal: FinancialGoal = {
        id: (goals.length + 1).toString(),
        ...data,
        currentAmount: data.currentAmount || 0,
      };
      setGoals((prev) => [...prev, newGoal]);
      toast({
        title: "Goal Added!",
        description: `Your new goal "${data.name}" has been successfully added.`,
      });
    }
    form.reset();
    handleDialogOpenChange(false);
  };
  
  const handleAddAmount = (data: AddAmountFormData) => {
    if (!goalForAmount) return;

    const updatedCurrentAmount = goalForAmount.currentAmount + data.amount;
    const updatedGoal: FinancialGoal = {
        ...goalForAmount,
        currentAmount: Math.min(updatedCurrentAmount, goalForAmount.targetAmount), // Cap at target amount
    };

    setGoals(goals.map(g => g.id === goalForAmount.id ? updatedGoal : g));

    toast({
        title: "Amount Added!",
        description: `₱${data.amount.toLocaleString()} has been added to your "${goalForAmount.name}" goal.`,
    });

    handleAddAmountDialogOpenChange(false);
  }

  const openAddDialog = () => {
    setEditingGoal(null);
    form.reset({
      name: "",
      targetAmount: 0,
      currentAmount: 0,
    });
    setIsDialogOpen(true);
  };

  const dialogTitle = editingGoal ? "Edit Financial Goal" : "Add New Financial Goal";
  const dialogDescription = editingGoal ? "Update the details of your financial objective." : "Define your new objective to start tracking your progress.";


  return (
    <>
      <div className="mb-6 flex justify-end">
          <Button onClick={openAddDialog}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add New Goal
          </Button>
      </div>
       <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{dialogTitle}</DialogTitle>
                    <DialogDescription>
                        {dialogDescription}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Goal Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g., New Office Equipment" {...field} />
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
                                        <Input type="number" placeholder="0" {...field} />
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
                                      <DatePicker date={field.value} setDate={field.onChange} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <DialogFooter>
                            <DialogClose asChild>
                                <Button type="button" variant="secondary">Cancel</Button>
                            </DialogClose>
                            <Button type="submit">Save Goal</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>

        <Dialog open={isAddAmountDialogOpen} onOpenChange={handleAddAmountDialogOpenChange}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle>Add to Goal: {goalForAmount?.name}</DialogTitle>
                    <DialogDescription>
                        Add an amount to your financial goal. The current progress is ₱{goalForAmount?.currentAmount.toLocaleString()} / ₱{goalForAmount?.targetAmount.toLocaleString()}.
                    </DialogDescription>
                </DialogHeader>
                 <Form {...addAmountForm}>
                    <form onSubmit={addAmountForm.handleSubmit(handleAddAmount)} className="space-y-4">
                        <FormField
                            control={addAmountForm.control}
                            name="amount"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Amount to Add (₱)</FormLabel>
                                    <FormControl>
                                        <Input type="number" placeholder="5000" {...field} autoFocus />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <DialogFooter>
                            <DialogClose asChild>
                                <Button type="button" variant="secondary">Cancel</Button>
                            </DialogClose>
                            <Button type="submit">Add Amount</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {goals.map((goal) => {
          const progress = (goal.currentAmount / goal.targetAmount) * 100;
          return (
            <Card key={goal.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{goal.name}</CardTitle>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setGoalForAmount(goal); handleAddAmountDialogOpenChange(true); }}>
                           Add Amount
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setEditingGoal(goal)}>
                            Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent>
                <div className="mb-2">
                  <span className="text-2xl font-bold">₱{goal.currentAmount.toLocaleString()}</span>
                  <span className="text-muted-foreground"> / ₱{goal.targetAmount.toLocaleString()}</span>
                </div>
                <Progress value={progress} className="w-full" />
                <div className="mt-2 text-sm text-muted-foreground">{progress.toFixed(1)}% complete</div>
              </CardContent>
              <CardFooter>
                {goal.deadline ? (
                  <p className="text-sm text-muted-foreground">
                    Deadline: {format(goal.deadline, "MMM d, yyyy")} ({formatDistanceToNow(goal.deadline, { addSuffix: true })})
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">No deadline set</p>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </>
  );
}
