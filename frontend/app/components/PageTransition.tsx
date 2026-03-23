'use client';

import { usePathname } from 'next/navigation';

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} style={{ animation: 'pageFadeIn 0.35s cubic-bezier(0.4, 0, 0.2, 1)' }}>
      {children}
    </div>
  );
}
