'use client';
import { supabase } from '@/backend/supabaseClient'; // import supabase from lib
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { useState } from 'react';

const formSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z.string().min(8, { message: 'Password must be at least 8 characters.' }),
});

export function SignupForm() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState('');
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
    },
  });

  // changed onSubmit to accept error message and push info to database on submit
async function onSubmit(values) {
  const { name, email, password } = values;

  setErrorMessage('');
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name },
      emailRedirectTo: 'http://localhost:9002/dashboard', 
    },
  });

  if (error) {
    setErrorMessage(error.message);
    alert('Sign up error: ' + error.message);
    console.error(error);
  } else {
    alert('Signup successful! Please check your email to verify your account.');
    router.push('/');
  }
}


  return (
    <Card className="w-full max-w-sm border-0 shadow-none lg:border lg:shadow-sm">
      <CardHeader className="text-center lg:text-left">
        <CardTitle className="font-headline text-3xl">Create an Account</CardTitle>
        <CardDescription>
          Enter your information to create an account and get started.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Jane Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="m@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {errorMessage && (
              <div style={{ color: 'red', marginTop: 10 }}>{errorMessage}</div>
            )}
            <Button type="submit" className="w-full">
              Create Account
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
