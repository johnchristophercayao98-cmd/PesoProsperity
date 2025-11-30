"use client";

import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { financialGoals as initialGoals } from "@/lib/data";
import type { FinancialGoal } from "@/lib/types";
import { format, formatDistanceToNow } from "date-fns";
import { PlusCircle } from "lucide-react";
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

const goalSchema = z.object({
  name: z.string().min(3, "Goal name must be at least 3 characters."),
  targetAmount: z.coerce.number().min(1, "Target amount must be greater than 0."),
  currentAmount: z.coerce.number().min(0).optional(),
  deadline: z.date().optional(),
});

type GoalFormData = z.infer<typeof goalSchema>;

export function GoalsDisplay() {
  const [goals, setGoals] = useState<FinancialGoal[]>(initialGoals);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<GoalFormData>({
    resolver: zodResolver(goalSchema),
    defaultValues: {
      name: "",
      targetAmount: 0,
      currentAmount: 0,
    },
  });

  const onSubmit = (data: GoalFormData) => {
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
    form.reset();
    setIsDialogOpen(false);
  };

  return (
    <>
      <div className="mb-6 flex justify-end">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
                <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add New Goal
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Add New Financial Goal</DialogTitle>
                    <DialogDescription>
                        Define your new objective to start tracking your progress.
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
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {goals.map((goal) => {
          const progress = (goal.currentAmount / goal.targetAmount) * 100;
          return (
            <Card key={goal.id}>
              <CardHeader>
                <CardTitle>{goal.name}</CardTitle>
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
