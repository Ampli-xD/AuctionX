import { useEffect } from 'react';
import { Button } from '@/components/ui/button'; // shadcn/ui Button component

export default function SignupSuccess() {
  useEffect(() => {
    const timer = setTimeout(() => {
      window.location.href = '/login'; // Redirect to /login after 10 seconds
    }, 10000);
    return () => clearTimeout(timer); // Cleanup on unmount
  }, []);

  const handleRedirect = () => {
    window.location.href = '/login'; // Manual redirect on button click
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <h1 className="text-3xl font-semibold text-gray-900 mb-4">AuctionX</h1>
      <div className="rounded-md bg-green-50 p-4">
        <p className="text-sm font-medium text-green-800">
          Signup successful! Redirecting to login in 10 seconds...
        </p>
      </div>
      <Button
        onClick={handleRedirect}
        className="mt-6"
      >
        Go to Login Now
      </Button>
    </div>
  );
}