import Image from 'next/image';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight } from 'lucide-react';

type CourseCardProps = {
  coursereferencenumber: string; // Added
  title: string;
  provider: string;
  imageUrl: string;
  imageHint: string;
};

export function CourseCard({
  coursereferencenumber,
  title,
  provider,
  imageUrl,
  imageHint,
}: CourseCardProps) {
  // Construct SkillsFuture URL
  const courseUrl = `https://www.myskillsfuture.gov.sg/content/portal/en/training-exchange/course-directory/course-detail.html?courseReferenceNumber=${coursereferencenumber}`;

  return (
    <Card className="flex h-full flex-col overflow-hidden transition-all hover:shadow-lg">
      <CardHeader className="p-0">
        <div className="relative h-48 w-full">
          <Image
            src={imageUrl}
            alt={title}
            fill
            className="object-cover"
            data-ai-hint={imageHint}
          />
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-4">
        <Badge variant="secondary" className="mb-2">{provider}</Badge>
        <CardTitle className="line-clamp-2 text-lg font-semibold">{title}</CardTitle>
      </CardContent>

      <CardFooter className="p-4 pt-0">
        <a
          href={courseUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full inline-flex items-center justify-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium shadow-sm hover:bg-gray-100 transition"
        >
          View Course
          <ArrowRight className="ml-2 h-4 w-4" />
        </a>
      </CardFooter>
    </Card>
  );
}
