
'use client';

import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button, Form, FormControl, FormField, FormItem, FormLabel, FormMessage, Input, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, Avatar, AvatarImage, AvatarFallback } from "@/components/ui";
import { useAuth, useFirestore, useUser, updateDocumentNonBlocking } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateProfile } from "firebase/auth";
import { doc } from "firebase/firestore";
import { Loader2, Camera } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";


const profileSchema = z.object({
    firstName: z.string().min(2, 'First name is required.'),
    lastName: z.string().min(2, 'Last name is required.'),
    email: z.string().email(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

const photoSchema = z.object({
    photo: z
        .any()
        .refine((files) => files?.length == 1, "Image is required.")
        .refine((files) => files?.[0]?.size <= MAX_FILE_SIZE, `Max file size is 5MB.`)
        .refine(
            (files) => ACCEPTED_IMAGE_TYPES.includes(files?.[0]?.type),
            ".jpg, .jpeg, .png and .webp files are accepted."
        ),
})
type PhotoFormValues = z.infer<typeof photoSchema>;


export default function SettingsPage() {
    const { user, isUserLoading } = useUser();
    const auth = useAuth();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const [isPhotoDialogOpen, setIsPhotoDialogOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const profileForm = useForm<ProfileFormValues>({
        resolver: zodResolver(profileSchema),
        defaultValues: {
            firstName: '',
            lastName: '',
            email: '',
        }
    });

     const photoForm = useForm<PhotoFormValues>({
        resolver: zodResolver(photoSchema),
    });

    useEffect(() => {
        if (user && !isUserLoading) {
            profileForm.reset({
                firstName: user.displayName?.split(' ')[0] || '',
                lastName: user.displayName?.split(' ').slice(1).join(' ') || '',
                email: user.email || '',
            });
        }
    }, [user, isUserLoading, profileForm]);

    const getAvatarFallback = () => {
        if (user?.isAnonymous) return "G";
        if (user?.displayName) {
            const nameParts = user.displayName.split(' ');
            return nameParts[0][0] + (nameParts.length > 1 ? nameParts[1][0] : '');
        }
        return "??";
    }

    const onProfileSubmit = async (data: ProfileFormValues) => {
        if (!user || !auth.currentUser) {
            toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to update your profile.' });
            return;
        }

        setIsSaving(true);
        try {
            await updateProfile(auth.currentUser, {
                displayName: `${data.firstName} ${data.lastName}`,
            });

            const userDocRef = doc(firestore, 'users', user.uid);
            updateDocumentNonBlocking(userDocRef, {
                firstName: data.firstName,
                lastName: data.lastName,
            });

            toast({
                title: 'Profile Updated',
                description: 'Your profile information has been saved.',
            });

        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Update Failed',
                description: error.message || 'An unexpected error occurred.',
            });
        } finally {
            setIsSaving(false);
        }
    };
    
    const onPhotoSubmit = async (data: PhotoFormValues) => {
        if (!user || !auth.currentUser) {
            toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to update your profile.' });
            return;
        }

        setIsSaving(true);
        try {
            const file = data.photo[0];
            const reader = new FileReader();
            
            reader.onloadend = async () => {
                const dataUrl = reader.result as string;
                
                try {
                    await updateProfile(auth.currentUser!, { photoURL: dataUrl });
                    const userDocRef = doc(firestore, 'users', user.uid);
                    updateDocumentNonBlocking(userDocRef, { photoURL: dataUrl });
                    
                    toast({
                        title: 'Profile Picture Updated',
                        description: 'Your new avatar has been saved.',
                    });

                    setIsPhotoDialogOpen(false);
                    photoForm.reset();

                } catch (error: any) {
                     toast({
                        variant: 'destructive',
                        title: 'Update Failed',
                        description: error.message || 'An unexpected error occurred.',
                    });
                } finally {
                    setIsSaving(false);
                }
            };
            
            reader.readAsDataURL(file);

        } catch (error: any) {
             toast({
                variant: 'destructive',
                title: 'File Read Error',
                description: 'Could not read the selected file.',
            });
            setIsSaving(false);
        }
    }


    if (isUserLoading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="mr-2 h-8 w-8 animate-spin" />
                <p>Loading settings...</p>
            </div>
        )
    }


    return (
        <div>
            <PageHeader
                title="Settings"
                description="Manage your account and application settings."
            />
            <div className="grid gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Profile</CardTitle>
                        <CardDescription>This is how your name and picture appears in the application.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid md:grid-cols-[150px_1fr] gap-8">
                        <div className="flex flex-col items-center gap-4">
                            <div className="relative group">
                                <Avatar className="h-32 w-32">
                                    <AvatarImage src={user?.photoURL ?? undefined} alt="User Avatar" />
                                    <AvatarFallback className="text-4xl">{getAvatarFallback()}</AvatarFallback>
                                </Avatar>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="absolute bottom-1 right-1 rounded-full h-8 w-8 bg-background/70 group-hover:bg-background"
                                    onClick={() => setIsPhotoDialogOpen(true)}
                                >
                                    <Camera className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        <Form {...profileForm}>
                            <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4 max-w-lg">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <FormField
                                        control={profileForm.control}
                                        name="firstName"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>First Name</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Juan" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={profileForm.control}
                                        name="lastName"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Last Name</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="dela Cruz" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <FormField
                                    control={profileForm.control}
                                    name="email"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Email</FormLabel>
                                            <FormControl>
                                                <Input type="email" {...field} disabled />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <Button type="submit" disabled={isSaving}>
                                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Save Changes
                                </Button>
                            </form>
                        </Form>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <CardTitle>Password</CardTitle>
                        <CardDescription>Manage your password settings.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button variant="outline">Change Password</Button>
                         <p className="text-sm text-muted-foreground mt-2">Password management is not yet implemented.</p>
                    </CardContent>
                </Card>
            </div>

            <Dialog open={isPhotoDialogOpen} onOpenChange={setIsPhotoDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Change Profile Picture</DialogTitle>
                        <DialogDescription>
                            Upload a new image to update your avatar.
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...photoForm}>
                        <form onSubmit={photoForm.handleSubmit(onPhotoSubmit)} className="space-y-4" id="photo-form">
                            <FormField
                                control={photoForm.control}
                                name="photo"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Image</FormLabel>
                                        <FormControl>
                                            <Input 
                                                type="file" 
                                                accept="image/png, image/jpeg, image/webp" 
                                                onChange={(e) => field.onChange(e.target.files)}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </form>
                    </Form>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                        <Button type="submit" form="photo-form" disabled={isSaving}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Photo
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
