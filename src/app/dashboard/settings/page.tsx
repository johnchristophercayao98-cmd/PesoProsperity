
'use client';

import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button, Input, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, Avatar, AvatarImage, AvatarFallback } from "@/components/ui";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useAuth, useFirestore, useUser, updateDocumentNonBlocking, useStorage, useDoc, useMemoFirebase } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateProfile } from "firebase/auth";
import { doc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { Loader2, Camera } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";


const profileSchema = z.object({
    firstName: z.string().min(1, 'First name is required.'),
    lastName: z.string().min(1, 'Last name is required.'),
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
    const storage = useStorage();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const [isPhotoDialogOpen, setIsPhotoDialogOpen] = useState(false);
    
    const userDocRef = useMemoFirebase(() => {
        if (!user) return null;
        return doc(firestore, 'users', user.uid);
    }, [firestore, user]);

    const { data: userProfile, isLoading: isProfileLoading } = useDoc(userDocRef);

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
        if (userProfile && !isProfileLoading) {
            profileForm.reset({
                firstName: userProfile.firstName || '',
                lastName: userProfile.lastName || '',
                email: userProfile.email || '',
            });
        } else if (user && !isUserLoading && !userProfile) {
            // Fallback for when firestore doc might be loading slower or is non-existent
             profileForm.reset({
                firstName: user.displayName?.split(' ')[0] || '',
                lastName: user.displayName?.split(' ').slice(1).join(' ') || '',
                email: user.email || '',
            });
        }
    }, [user, userProfile, isUserLoading, isProfileLoading, profileForm]);

    const getAvatarFallback = () => {
        if (user?.isAnonymous) return "G";
        if (userProfile?.firstName && userProfile?.lastName) {
             return `${userProfile.firstName[0]}${userProfile.lastName[0]}`;
        }
        if (user?.displayName) {
            const nameParts = user.displayName.split(' ');
            const firstNameInitial = nameParts[0] ? nameParts[0][0] : '';
            const lastNameInitial = nameParts.length > 1 && nameParts[1] ? nameParts[1][0] : '';
            if (firstNameInitial && lastNameInitial) {
                return `${firstNameInitial}${lastNameInitial}`;
            }
            return firstNameInitial;
        }
        if (user?.email) {
            return user.email[0].toUpperCase();
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

            // This will trigger the onAuthStateChanged listener and update the user object everywhere
            await auth.currentUser.reload(); 

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
            const filePath = `user-avatars/${user.uid}/${file.name}`;
            const storageRef = ref(storage, filePath);
            
            const uploadResult = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(uploadResult.ref);

            await updateProfile(auth.currentUser, { photoURL: downloadURL });
            
            const userDocRef = doc(firestore, 'users', user.uid);
            updateDocumentNonBlocking(userDocRef, { photoURL: downloadURL });
            
            // Force a reload of the user object to reflect the new photoURL instantly
            await auth.currentUser.reload();
            
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
                description: error.message || 'Could not upload image.',
            });
        } finally {
            setIsSaving(false);
        }
    }

    const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
        const items = event.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const file = items[i].getAsFile();
                if (file) {
                    const dataTransfer = new DataTransfer();
                    dataTransfer.items.add(file);
                    photoForm.setValue('photo', dataTransfer.files);
                    toast({
                        title: 'Image Pasted!',
                        description: 'The image has been added and is ready to be saved.',
                    });
                }
                break;
            }
        }
    };


    if (isUserLoading || isProfileLoading) {
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
            </div>

            <Dialog open={isPhotoDialogOpen} onOpenChange={setIsPhotoDialogOpen}>
                <DialogContent onPaste={handlePaste}>
                    <DialogHeader>
                        <DialogTitle>Change Profile Picture</DialogTitle>
                        <DialogDescription>
                            Upload a new image to update your avatar. You can also paste an image from your clipboard.
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
