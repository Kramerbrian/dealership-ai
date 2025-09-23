import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to streamlined dashboard by default
    router.replace('/streamlined');
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-white">Loading Dashboard...</div>
    </div>
  );
}
