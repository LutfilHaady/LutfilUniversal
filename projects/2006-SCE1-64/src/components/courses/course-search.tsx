'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import { CourseCard } from './course-card';
import { PlaceHolderImages } from '@/backend/placeholder-images';
import { supabase3 } from '@/backend/supabaseClient';

type Course = {
  coursereferencenumber: string;
  coursetitle: string;
  trainingprovideralias: string;
};

const PAGE_SIZE = 30;

export function CourseSearch() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchCourses = async (reset = false) => {
  setLoading(true);
  const lowerSearch = searchTerm.toLowerCase();

  let skillData: any[] | null = null;
  let titleData: any[] | null = null;
  let skillError: any = null;
  let titleError: any = null;

  if (!searchTerm) {
    // No search term → fetch all courses from Course table
    const { data, error } = await supabase3
      .from('Course')
      .select('coursereferencenumber, coursetitle, trainingprovideralias')
      .range(reset ? 0 : offset, (reset ? 0 : offset) + PAGE_SIZE - 1);

    if (error) console.error('Error fetching all courses:', error);

    const fetchedCourses: Course[] = data || [];
    if (reset) {
      setCourses(fetchedCourses);
      setOffset(fetchedCourses.length);
    } else {
      setCourses((prev) => [...prev, ...fetchedCourses]);
      setOffset((prev) => prev + fetchedCourses.length);
    }

    setHasMore(fetchedCourses.length === PAGE_SIZE);
    setLoading(false);
    return;
  }

  // --- Otherwise, perform search ---
  const [skillRes, titleRes] = await Promise.all([
    supabase3
      .from('course_with_skills')
      .select('coursereferencenumber, coursetitle, trainingprovideralias')
      .ilike('skillsName', `%${lowerSearch}%`)
      .range(reset ? 0 : offset, (reset ? 0 : offset) + PAGE_SIZE - 1),

    supabase3
      .from('Course')
      .select('coursereferencenumber, coursetitle, trainingprovideralias')
      .ilike('coursetitle', `%${lowerSearch}%`)
      .range(reset ? 0 : offset, (reset ? 0 : offset) + PAGE_SIZE - 1),
  ]);

  skillData = skillRes.data || [];
  titleData = titleRes.data || [];
  skillError = skillRes.error;
  titleError = titleRes.error;

  if (skillError) console.error('Error fetching from course_with_skills:', skillError);
  if (titleError) console.error('Error fetching from Course:', titleError);

  // Merge and deduplicate by course reference number
  const combined = [...skillData, ...titleData];
  const uniqueCourses = combined.filter(
    (course, index, self) =>
      index === self.findIndex((c) => c.coursereferencenumber === course.coursereferencenumber)
  );

  if (reset) {
    setCourses(uniqueCourses);
    setOffset(uniqueCourses.length);
  } else {
    setCourses((prev) => [...prev, ...uniqueCourses]);
    setOffset((prev) => prev + uniqueCourses.length);
  }

  setHasMore(uniqueCourses.length === PAGE_SIZE);
  setLoading(false);
};

  useEffect(() => {
    fetchCourses(true);
  }, []);

  const handleSearch = async () => {
    setOffset(0);
    await fetchCourses(true);
  };

  const handleShowMore = async () => {
    await fetchCourses();
  };

  return (
    <div className="space-y-6">
      <div className="flex w-full max-w-2xl items-center space-x-2">
        <Input
          type="text"
          placeholder="Search by skill or course, e.g. 'SAP' or 'Python'"
          className="flex-1"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <Button onClick={handleSearch}>
          <Search className="mr-2 h-4 w-4" /> Search
        </Button>
      </div>

      {loading && <p>Loading courses...</p>}
      {!loading && !courses.length && <p>No courses available</p>}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((course, idx) => (
          <CourseCard
            key={course.coursereferencenumber + '-' + idx}
            coursereferencenumber={course.coursereferencenumber}
            title={course.coursetitle}
            provider={course.trainingprovideralias}
            imageUrl={PlaceHolderImages[idx % PlaceHolderImages.length].imageUrl}
            imageHint={PlaceHolderImages[idx % PlaceHolderImages.length].imageHint || 'course'}
          />
        ))}
      </div>

      {hasMore && !loading && (
        <div className="flex justify-center">
          <Button onClick={handleShowMore}>Show More</Button>
        </div>
      )}
    </div>
  );
}
