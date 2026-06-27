import { ThemeProvider } from '@/components/theme-provider';
import './globals.css';

export const metadata = {
    title: 'NOVIRA',
    description: 'NOVIRA — Project planning, scheduling & control platform',
};

export default function RootLayout({
                                       children,
                                   }: {
    children: React.ReactNode;
}) {
    return (
        // اگر سایت فارسی است dir="rtl" بگذارید، اگر انگلیسی است dir="ltr"
        <html lang="en" suppressHydrationWarning>
        <body className="h-screen ">
        <ThemeProvider attribute="class" defaultTheme="dark">
            {/* تمام صفحات برنامه (لاگین، داشبورد و...) اینجا رندر می‌شوند */}
            {children}
        </ThemeProvider>
        </body>
        </html>
    );
}