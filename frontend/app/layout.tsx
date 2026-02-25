import './globals.css';
import Navbar from "./components/Navbar";
import Providers from "./components/Providers";
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-inter',
});

export const metadata = {
  title: 'Near',
  description: 'Discover and connect with nearby events and people.',
};

export default function RootLayout({
  children,
  modal,
}: Readonly<{
  children: React.ReactNode;
  modal: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body style={{ fontFamily: 'var(--font-inter), sans-serif' }}>
        <Providers>
          <Navbar />
          {children}
          {modal}
        </Providers>
      </body>
    </html>
  );
}
