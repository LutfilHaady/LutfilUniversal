'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';

export function CourseSearch() {
  return (
    <div className="flex w-full max-w-2xl items-center space-x-2">
      <Input
        type="text"
        placeholder="Search by skill, e.g. 'Project Management'"
        className="flex-1"
      />
      <Button type="submit">
        <Search className="mr-2 h-4 w-4" /> Search
      </Button>
    </div>
  );
}
