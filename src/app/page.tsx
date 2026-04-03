'use client';

import LoginGate from '@/components/auth/LoginGate';
import MainLayout from '@/components/layout/MainLayout';

export default function Home() {
  return (
    <LoginGate>
      <MainLayout />
    </LoginGate>
  );
}
