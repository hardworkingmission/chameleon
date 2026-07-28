import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import NavBar from '@/components/NavBar';

export const metadata: Metadata = {
  title: 'Chameleon — File Conversion',
  description: 'Convert images, HEIC/HEIF, and PDFs entirely on your own server.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <NavBar />
          <main className="page">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
