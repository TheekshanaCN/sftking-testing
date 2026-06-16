import '@/app/globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { SocketProvider } from '@/context/SocketContext';
import AntiDebug from '@/components/shared/AntiDebug';
import ForceLogoutListener from '@/components/auth/ForceLogoutListener';
import OfflineDetector from '@/components/shared/OfflineDetector';
import StudentTracker from '@/components/StudentTracker';
import GodAlertOverlay from '@/components/shared/GodAlertOverlay';
import FirebaseNotificationBootstrap from '@/components/shared/FirebaseNotificationBootstrap';

export const metadata = {
  title: 'SFT KING',
  description: 'Premium Advanced Level SFT Learning Platform',
  manifest: '/manifest.json', // 🚀 THIS LINKS YOUR PWA APP SHELL!
}

// NOTE: If you are using Next.js 14+, the theme color goes in a separate viewport object right below it:
export const viewport = {
  themeColor: '#dc2626',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning={true}>
      <body className="bg-[#FFFBFB] dark:bg-slate-950 text-slate-900 dark:text-white overflow-hidden select-none transition-colors duration-300">
        <AuthProvider>
            <SocketProvider>
              <ForceLogoutListener />
                <AntiDebug />
                <OfflineDetector />
                <StudentTracker />
                <GodAlertOverlay />
                <FirebaseNotificationBootstrap />
                {children}
            </SocketProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
