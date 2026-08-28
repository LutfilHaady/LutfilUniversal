// pages/signup.js
import React, { useState } from 'react';
import { supabase } from '../backend/supabaseClient';
import { useRouter } from 'next/router';

export default function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const router = useRouter();

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Supabase sign up with email and password
    const { user, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name }, 
      },
    });
    //send error if user signs up with invalid email etc..
    if (error) {
      setError(error.message);
    } 
    //valid email & password
    else {
      setSuccess('Account created! Redirecting to login...'); 
      setTimeout(() => {
        router.push('/');
      }, 2000);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: 'auto' }}>
      <h2>Create an Account</h2>
      <form onSubmit={handleSignup}>
        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          style={{ display: 'block', width: '100%', marginBottom: 10 }}
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ display: 'block', width: '100%', marginBottom: 10 }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ display: 'block', width: '100%', marginBottom: 10 }}
        />
        <button type="submit" style={{ width: '100%' }}>Create Account</button>
      </form>
      {error && <div style={{ color: 'red', marginTop: 10 }}>{error}</div>}
      {success && <div style={{ color: 'green', marginTop: 10 }}>{success}</div>}
    </div>
  );
}
