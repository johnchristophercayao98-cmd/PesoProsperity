
'use client';

import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button, Input, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, Avatar, AvatarImage, AvatarFallback, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useAuth, useFirestore, useUser, useStorage, useDoc, useMemoFirebase } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateProfile, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { Loader2, Camera } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/context/language-context";


const profileSchema = z.object({
    firstName: z.string().min(1, 'First name is required.'),
    lastName: z.string().min(1, 'Last name is required.'),
    email: z.string().email(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const passwordSchema = z.object({
    currentPassword: z.string().min(1, 'Current password is required.'),
    newPassword: z.string().min(6, 'New password must be at least 6 characters.'),
    confirmPassword: z.string().min(6, 'Confirm password must be at least 6 characters.'),
}).refine(data => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
});

type PasswordFormValues = z.infer<typeof passwordSchema>;

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

/**
 * Resizes and compresses an image file on the client-side before upload.
 * @param file The image file to process.
 * @param maxWidth The maximum width of the output image.
 * @param quality The quality of the output image (0 to 1).
 * @returns A Promise that resolves with the compressed image as a Blob.
 */
function compressImage(file: File, maxWidth: number = 1024, quality: number = 0.8): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const scaleFactor = maxWidth / img.width;
                const width = img.width > maxWidth ? maxWidth : img.width;
                const height = img.width > maxWidth ? img.height * scaleFactor : img.height;

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    return reject(new Error('Failed to get canvas context'));
                }

                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            return reject(new Error('Canvas toBlob failed.'));
                        }
                        resolve(blob);
                    },
                    'image/jpeg',
                    quality
                );
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
}


export default function SettingsPage() {
    const { user, isUserLoading } = useUser();
    const auth = useAuth();
    const firestore = useFirestore();
    const storage = useStorage();
    const { toast } = useToast();
    const [isSavingProfile, setIsSavingProfile] = useState(false);
    const [isSavingPassword, setIsSavingPassword] = useState(false);
    const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
    const [isPhotoDialogOpen, setIsPhotoDialogOpen] = useState(false);
    const { t, locale, setLocale } = useLanguage();
    
    const userDocRef = useMemoFirebase(() => {
        if (!user) return null;
        return doc(firestore, 'users', user.uid);
    }, [firestore, user]);

    const { data: userProfileData, isLoading: isProfileLoading } = useDoc(userDocRef);

    const profileForm = useForm<ProfileFormValues>({
        resolver: zodResolver(profileSchema),
        defaultValues: {
            firstName: '',
            lastName: '',
            email: '',
        }
    });

    const passwordForm = useForm<PasswordFormValues>({
        resolver: zodResolver(passwordSchema),
        defaultValues: {
            currentPassword: '',
            newPassword: '',
            confirmPassword: '',
        }
    });

     const photoForm = useForm<PhotoFormValues>({
        resolver: zodResolver(photoSchema),
    });

    useEffect(() => {
        if (userProfileData) {
            profileForm.reset({
                firstName: userProfileData.firstName || '',
                lastName: userProfileData.lastName || '',
                email: userProfileData.email || '',
            });
        } else if (user && !isUserLoading) {
            profileForm.reset({
                firstName: user.displayName?.split(' ')[0] || '',
                lastName: user.displayName?.split(' ').slice(1).join(' ') || '',
                email: user.email || '',
            });
        }
    }, [user, userProfileData, isUserLoading, profileForm]);


    const getAvatarFallback = () => {
        if (user?.isAnonymous) return "G";
        if (userProfileData?.firstName && userProfileData?.lastName) {
             return `${userProfileData.firstName[0]}${userProfileData.lastName[0]}`;
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
            toast({ variant: 'destructive', title: t('error'), description: t('mustBeLoggedIn') });
            return;
        }

        setIsSavingProfile(true);
        try {
            await updateProfile(auth.currentUser, {
                displayName: `${data.firstName} ${data.lastName}`,
            });
            
            if (userDocRef) {
                await updateDoc(userDocRef, {
                    firstName: data.firstName,
                    lastName: data.lastName,
                });
            }

            await auth.currentUser.reload(); 

            toast({
                title: t('profileUpdated'),
                description: t('profileUpdatedSuccess'),
            });

        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: t('updateFailed'),
                description: error.message || t('unexpectedError'),
            });
        } finally {
            setIsSavingProfile(false);
        }
    };
    
    const onPasswordSubmit = async (data: PasswordFormValues) => {
        if (!user || !auth.currentUser || !user.email) {
             toast({ variant: 'destructive', title: t('error'), description: t('mustBeLoggedInEmail') });
            return;
        }
        setIsSavingPassword(true);
        try {
            const credential = EmailAuthProvider.credential(user.email, data.currentPassword);
            await reauthenticateWithCredential(auth.currentUser, credential);
            await updatePassword(auth.currentUser, data.newPassword);

            toast({
                title: t('passwordChanged'),
                description: t('passwordChangedSuccess'),
            });
            passwordForm.reset();
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: t('passwordChangeFailed'),
                description: error.code === 'auth/wrong-password' 
                    ? t('wrongPasswordError') 
                    : error.message || t('unexpectedError'),
            });
        } finally {
            setIsSavingPassword(false);
        }
    }
    
    const onPhotoSubmit = async (data: PhotoFormValues) => {
        if (!user || !auth.currentUser || !userDocRef) {
            toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to update your profile.' });
            return;
        }
    
        setIsProcessingPhoto(true);
    
        try {
            const originalFile = data.photo[0];
            const compressedBlob = await compressImage(originalFile);
    
            const filePath = `user-avatars/${user.uid}/${new Date().getTime()}.jpg`;
            const storageRef = ref(storage, filePath);
            
            const uploadResult = await uploadBytes(storageRef, compressedBlob);
            const downloadURL = await getDownloadURL(uploadResult.ref);

            await updateProfile(auth.currentUser, { photoURL: downloadURL });
            await updateDoc(userDocRef, { photoURL: downloadURL });
    
            toast({
                title: t('profilePictureUpdated'),
                description: t('avatarUpdatedSuccess'),
            });
    
        } catch (error: any) {
             toast({
                variant: 'destructive',
                title: 'Update Failed',
                description: error.message || 'Could not save the new profile picture.',
            });
        } finally {
            setIsProcessingPhoto(false);
            setIsPhotoDialogOpen(false);
            photoForm.reset();
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
                        title: t('imagePasted'),
                        description: t('imagePastedReady'),
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
                <p>{t('loadingSettings')}</p>
            </div>
        )
    }


    return (
        <div>
            <PageHeader
                title={t('settings')}
                description={t('manageAccountSettings')}
            />
            <div className="grid gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>{t('profile')}</CardTitle>
                        <CardDescription>{t('profileDescription')}</CardDescription>
                    </CardHeader>
                    <CardContent className="grid md:grid-cols-[150px_1fr] gap-8">
                        <div className="flex flex-col items-center gap-4">
                            <div className="relative group">
                                <Avatar className="h-32 w-32">
                                    <AvatarImage src={userProfileData?.photoURL ?? user?.photoURL ?? undefined} alt={t('userAvatar')} />
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
                                                <FormLabel>{t('firstName')}</FormLabel>
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
                                                <FormLabel>{t('lastName')}</FormLabel>
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
                                            <FormLabel>{t('email')}</FormLabel>
                                            <FormControl>
                                                <Input type="email" {...field} disabled />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <Button type="submit" disabled={isSavingProfile}>
                                    {isSavingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {t('saveChanges')}
                                </Button>
                            </form>
                        </Form>
                    </CardContent>
                </Card>
                
                 {!user?.isAnonymous && (
                    <Card>
                        <CardHeader>
                            <CardTitle>{t('password')}</CardTitle>
                            <CardDescription>{t('passwordDescription')}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Form {...passwordForm}>
                                <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4 max-w-lg">
                                    <FormField
                                        control={passwordForm.control}
                                        name="currentPassword"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('currentPassword')}</FormLabel>
                                                <FormControl>
                                                    <Input type="password" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={passwordForm.control}
                                        name="newPassword"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('newPassword')}</FormLabel>
                                                <FormControl>
                                                    <Input type="password" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                     <FormField
                                        control={passwordForm.control}
                                        name="confirmPassword"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>{t('confirmNewPassword')}</FormLabel>
                                                <FormControl>
                                                    <Input type="password" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <Button type="submit" disabled={isSavingPassword}>
                                        {isSavingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        {t('changePassword')}
                                    </Button>
                                </form>
                            </Form>
                        </CardContent>
                    </Card>
                 )}

                 <Card>
                    <CardHeader>
                        <CardTitle>{t('languageAndRegion')}</CardTitle>
                        <CardDescription>{t('languageAndRegionDescription')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2 max-w-sm">
                            <Label htmlFor="language">{t('language')}</Label>
                            <Select value={locale} onValueChange={(value) => setLocale(value as 'en' | 'ph')}>
                                <SelectTrigger id="language">
                                    <SelectValue placeholder={t('selectLanguage')} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="en">{t('english')}</SelectItem>
                                    <SelectItem value="ph">{t('filipino')}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

            </div>

            <Dialog open={isPhotoDialogOpen} onOpenChange={setIsPhotoDialogOpen}>
                <DialogContent onPaste={handlePaste}>
                    <DialogHeader>
                        <DialogTitle>{t('changeProfilePicture')}</DialogTitle>
                        <DialogDescription>
                            {t('changeProfilePictureDescription')}
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...photoForm}>
                        <form onSubmit={photoForm.handleSubmit(onPhotoSubmit)} className="space-y-4" id="photo-form">
                            <FormField
                                control={photoForm.control}
                                name="photo"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('image')}</FormLabel>
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
                        <DialogClose asChild><Button variant="outline">{t('cancel')}</Button></DialogClose>
                        <Button type="submit" form="photo-form" disabled={isProcessingPhoto}>
                            {isProcessingPhoto && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {t('savePhoto')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )

}
