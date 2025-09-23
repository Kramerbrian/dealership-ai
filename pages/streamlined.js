import { useRouter } from 'next/router';
import { useEffect } from 'react';

export default function Streamlined() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the main dashboard
    router.replace('/dashboard/premium-auto');
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg mx-auto mb-4">
          <span className="text-white font-medium text-2xl">dAI</span>
        </div>
        <h1 className="text-2xl font-light text-white mb-2">DealershipAI</h1>
        <p className="text-white/60">Loading streamlined dashboard...</p>
      </div>
    </div>
  );
}