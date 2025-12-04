import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
    return (
        <div>
            <PageHeader
                title="Settings"
                description="Manage your account and application settings."
            />
            <Card>
                <CardHeader>
                    <CardTitle>Coming Soon</CardTitle>
                    <CardDescription>This page is under construction. More settings will be available soon.</CardDescription>
                </CardHeader>
                <CardContent>
                    <p>In the meantime, you can manage your profile information through your authentication provider.</p>
                </CardContent>
            </Card>
        </div>
    )
}
