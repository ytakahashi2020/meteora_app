'use client';

import React, { FC, ReactNode, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const WalletProviderClient = dynamic(
  () => import('@/components/WalletProviderClient').then(mod => ({ default: mod.WalletProviderClient })),
  { ssr: false }
);

interface ProvidersProps {
  children: ReactNode;
}

export const Providers: FC<ProvidersProps> = ({ children }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div>{children}</div>;
  }

  return (
    <WalletProviderClient>
      {children}
    </WalletProviderClient>
  );
};