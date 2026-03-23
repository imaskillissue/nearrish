import './globals.css';
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import BottomNav from "./components/BottomNav";
import Providers from "./components/Providers";
import PageTransition from "./components/PageTransition";
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
          <PageTransition>{children}</PageTransition>
          {modal}
          <Footer />
          <BottomNav />
        </Providers>
      </body>
    </html>
  );
}
