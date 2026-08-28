'use client';

import { useState } from 'react';
import { supabase } from '@/backend/supabaseClient';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Camera } from 'lucide-react';

interface AvatarUploadProps {
  currentAvatarUrl?: string;
  userId: string;
  userName: string;
  onUploadComplete?: (url: string) => void;
}

export function AvatarUpload({
  currentAvatarUrl,
  userId,
  userName,
  onUploadComplete,
}: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl);

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);

      if (!event.target.files || event.target.files.length === 0) {
        return;
      }

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}-${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const publicUrl = data.publicUrl;

      // Update user profile in database
      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: publicUrl })
        .eq('id', userId);

      if (updateError) {
        throw updateError;
      }

      setAvatarUrl(publicUrl);
      onUploadComplete?.(publicUrl);
      
      alert('Profile picture updated successfully!');
    } catch (error) {
      console.error('Error uploading avatar:', error);
      alert('Error uploading profile picture!');
    } finally {
      setUploading(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="relative group">
      <Avatar className="h-20 w-20">
        <AvatarImage src={avatarUrl} alt={userName} />
        <AvatarFallback>{getInitials(userName)}</AvatarFallback>
      </Avatar>
      
      <label
        htmlFor="avatar-upload"
        className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
      >
        <Camera className="h-6 w-6 text-white" />
        <input
          id="avatar-upload"
          type="file"
          accept="image/*"
          onChange={uploadAvatar}
          disabled={uploading}
          className="hidden"
        />
      </label>
      
      {uploading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-full">
          <div className="text-white text-xs">Uploading...</div>
        </div>
      )}
    </div>
  );
}
