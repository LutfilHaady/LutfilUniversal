'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/backend/supabaseClient';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export function UserProfileCard() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const jobTitleRef = useRef<HTMLDivElement>(null);
  const descriptionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);

        if (user) {
          const { data: profileData } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();
          
          if (profileData) {
            setProfile(profileData);
          } else {
            // Create profile if doesn't exist - use full_name from user_metadata
            const { data: newProfile } = await supabase
              .from('users')
              .insert([
                {
                  id: user.id,
                  email: user.email,
                  name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
                  job_title: '',
                  description: '',
                  avatar_url: ''
                }
              ])
              .select()
              .single();
            
            setProfile(newProfile);
          }
        }
        setLoading(false);
      } catch (error) {
        console.error('Error loading user:', error);
        setLoading(false);
      }
    }
    loadUser();
    
    // Refresh avatar every 2 seconds
    const interval = setInterval(loadUser, 2000);
    return () => clearInterval(interval);
  }, []);

  const getInitials = (name: string) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleJobTitleBlur = async (e: React.FocusEvent<HTMLDivElement>) => {
    const newTitle = e.target.innerText.trim();
    
    if (!newTitle) {
      if (jobTitleRef.current) {
        jobTitleRef.current.innerText = profile?.job_title || 'Click to edit your job title';
        jobTitleRef.current.classList.add('text-muted-foreground');
      }
      return;
    }
    
    if (!user || newTitle === profile?.job_title) return;
    
    const { error } = await supabase
      .from('users')
      .update({ job_title: newTitle })
      .eq('id', user.id);

    if (!error) {
      setProfile({ ...profile, job_title: newTitle });
    }
  };

  const handleJobTitleFocus = (e: React.FocusEvent<HTMLDivElement>) => {
    if (e.target.innerText === 'Click to edit your job title') {
      e.target.innerText = '';
      e.target.classList.remove('text-muted-foreground');
    }
  };

  const handleDescriptionBlur = async (e: React.FocusEvent<HTMLDivElement>) => {
    const newDescription = e.target.innerText.trim();
    
    if (!newDescription) {
      if (descriptionRef.current) {
        descriptionRef.current.innerText = profile?.description || 'Click to edit your profile description';
        descriptionRef.current.classList.add('text-muted-foreground');
      }
      return;
    }
    
    if (!user || newDescription === profile?.description) return;
    
    const { error } = await supabase
      .from('users')
      .update({ description: newDescription })
      .eq('id', user.id);

    if (!error) {
      setProfile({ ...profile, description: newDescription });
    }
  };

  const handleDescriptionFocus = (e: React.FocusEvent<HTMLDivElement>) => {
    if (e.target.innerText === 'Click to edit your profile description') {
      e.target.innerText = '';
      e.target.classList.remove('text-muted-foreground');
    }
  };

  if (loading) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading...
        </CardContent>
      </Card>
    );
  }

  if (!user) return null;

  // Get name from profile OR user_metadata.full_name (from signup)
  const userName = profile?.name || user.user_metadata?.full_name || 'User';
  const displayJobTitle = profile?.job_title || 'Click to edit your job title';
  const displayDescription = profile?.description || 'Click to edit your profile description';

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20 border-2 border-primary/10">
            <AvatarImage src={profile?.avatar_url} alt={userName} />
            <AvatarFallback className="text-lg">{getInitials(userName)}</AvatarFallback>
          </Avatar>
          
          <div className="flex-1">
            <h3 className="font-headline text-lg font-semibold mb-1">
              {userName}
            </h3>
            
            {/* Editable Job Title */}
            <div
              ref={jobTitleRef}
              contentEditable
              suppressContentEditableWarning
              onFocus={handleJobTitleFocus}
              onBlur={handleJobTitleBlur}
              className={`text-sm cursor-text hover:text-primary focus:outline-none focus:ring-1 focus:ring-primary focus:rounded px-1 -mx-1 ${
                !profile?.job_title ? 'text-muted-foreground' : ''
              }`}
            >
              {displayJobTitle}
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Editable Description */}
        <div
          ref={descriptionRef}
          contentEditable
          suppressContentEditableWarning
          onFocus={handleDescriptionFocus}
          onBlur={handleDescriptionBlur}
          className={`text-sm cursor-text hover:text-primary focus:outline-none focus:ring-1 focus:ring-primary focus:rounded px-2 py-1 -mx-2 -my-1 min-h-[60px] ${
            !profile?.description ? 'text-muted-foreground' : ''
          }`}
        >
          {displayDescription}
        </div>
      </CardContent>
    </Card>
  );
}
