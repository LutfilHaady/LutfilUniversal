import { SignupForm } from '@/components/auth/signup-form';
import { Logo } from '@/components/icons';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function SignupPage() {
  return (
    <div className="w-full lg:grid lg:min-h-screen lg:grid-cols-2">
      <div className="relative hidden items-center justify-center bg-muted p-10 lg:flex">
         <div className="absolute inset-0 bg-primary/10" />
        <div className="relative z-10 flex flex-col items-center text-center">
            <Logo width="200" height="40" className="mb-6" />
          <h1 className="font-headline text-4xl font-bold text-primary">
            Start Your Journey Today
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Create an account to unlock personalized career insights and build your future.
          </p>
        </div>
      </div>
      <div className="flex min-h-screen items-center justify-center p-6 lg:p-8">
        <div className="mx-auto flex w-full max-w-sm flex-col justify-center space-y-6">
          <SignupForm />
           <p className="px-8 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Button variant="link" asChild className="p-0 underline">
              <Link href="/">Login</Link>
            </Button>
          </p>
        </div>
      </div>
    </div>
  );
}
