'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/backend/supabaseClient';
import { usePathname } from 'next/navigation';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Link from 'next/link';
import { Camera } from 'lucide-react';

const getPageTitle = (pathname: string) => {
  if (pathname.startsWith('/dashboard')) return 'Dashboard';
  if (pathname.startsWith('/trends')) return 'Industry Comparison';
  if (pathname.startsWith('/courses')) return 'Course Search';
  if (pathname.startsWith('/roadmap')) return 'Career Roadmap';
  return 'JobView';
};

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        const { data: profileData } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();
        
        setProfile(profileData);
      }
    }
    loadUser();
  }, []);

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);

      if (!user) {
        alert('Please wait for profile to load');
        setUploading(false);
        return;
      }

      if (!event.target.files || event.target.files.length === 0) {
        setUploading(false);
        return;
      }

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      console.log('Uploading to:', filePath);

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const publicUrl = data.publicUrl;
      console.log('Public URL:', publicUrl);

      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) {
        console.error('Update error:', updateError);
        throw updateError;
      }

      // Update local state
      setProfile({ ...profile, avatar_url: publicUrl });
      
      // Show success message
      alert('Profile picture updated successfully!');
      
      // Reload page to show new avatar everywhere
      window.location.reload();
      
    } catch (error) {
      console.error('Error uploading avatar:', error);
      alert('Error uploading profile picture: ' + (error as any).message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const getInitials = (name: string) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const avatarUrl = profile?.avatar_url;
  const userName = profile?.name || user?.user_metadata?.full_name || user?.email || 'User';

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm md:px-6">
      <SidebarTrigger className="md:hidden" />
      <h1 className="hidden font-headline text-xl font-semibold md:block md:text-2xl">
        {getPageTitle(pathname)}
      </h1>
      
      {/* FILE INPUT OUTSIDE DROPDOWN */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={uploadAvatar}
        disabled={uploading}
        className="hidden"
      />
      
      <div className="ml-auto flex items-center gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative h-10 w-10 rounded-full p-0"
            >
              <div className="relative group">
                <Avatar className="h-10 w-10 border-2 border-primary/50">
                  <AvatarImage
                    src={avatarUrl}
                    alt={userName}
                  />
                  <AvatarFallback>{getInitials(userName)}</AvatarFallback>
                </Avatar>
                
                {uploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-full">
                    <div className="text-white text-[8px]">...</div>
                  </div>
                )}
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            
            <DropdownMenuItem 
              onClick={(e) => {
                e.preventDefault();
                console.log('Clicked Change Profile Picture');
                fileInputRef.current?.click();
              }}
            >
              <Camera className="h-4 w-4 mr-2" />
              <span>Change Profile Picture</span>
            </DropdownMenuItem>
            
            <DropdownMenuSeparator />
            <DropdownMenuItem>Settings</DropdownMenuItem>
            <DropdownMenuItem>Support</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={async () => {
                await supabase.auth.signOut();
                router.push('/');
              }}
            >
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
