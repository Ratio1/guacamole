import { Suspense } from 'react';
import LoginClient from '@/components/LoginClient';

export default function LoginPage() {
  return (
    <section className="card">
      <Suspense fallback={<div>Loading...</div>}>
        <LoginClient />
      </Suspense>
    </section>
  );
}
