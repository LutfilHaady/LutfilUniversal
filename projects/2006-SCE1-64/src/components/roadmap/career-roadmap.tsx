
'use client';

import { useState } from 'react';
import { CheckCircle2, Trash2, Plus, Edit, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { useRoadmap, type RoadmapStep } from '@/contexts/roadmap-context';

export function CareerRoadmap() {
  const { roadmap, addStep, deleteStep, toggleStatus, editStep } = useRoadmap();
  const [newStepTitle, setNewStepTitle] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editedStep, setEditedStep] = useState<Partial<RoadmapStep> | null>(
    null
  );

  const handleAddStep = () => {
    if (newStepTitle.trim() === '') return;
    addStep(newStepTitle);
    setNewStepTitle('');
  };

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    setEditedStep(roadmap[index]);
  };

  const handleSave = (index: number) => {
    if (editedStep)
      editStep(index, editedStep.title || '', editedStep.description || '');
    setEditingIndex(null);
    setEditedStep(null);
  };

  const handleCancel = () => {
    setEditingIndex(null);
    setEditedStep(null);
  };

  const getStatusIcon = (item: RoadmapStep) => {
    if (item.status === 'completed')
      return (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <CheckCircle2 className="h-6 w-6" />
        </div>
      );

    if (item.status === 'in_progress')
      return (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <CheckCircle2 className="h-6 w-6" />
        </div>
      );

    return (
      <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed bg-card">
        <CheckCircle2 className="h-6 w-6 text-muted-foreground" />
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <div className="relative pl-6 after:absolute after:inset-y-0 after:left-6 after:w-px after:bg-border">
        {roadmap.map((item, index) => (
          <div
            key={index}
            className="group relative grid grid-cols-[auto_1fr] items-start gap-x-6 pb-12"
          >
            <button
              onClick={() => toggleStatus(index)}
              className="relative z-10 flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-card transition-transform hover:scale-110"
              aria-label={`Toggle status for ${item.title}`}
            >
              {getStatusIcon(item)}
            </button>

            <div className="flex flex-col gap-1 pt-2">
              <div className="text-sm text-muted-foreground">{item.date}</div>

              {editingIndex === index ? (
                <div className="space-y-2">
                  <Input
                    value={editedStep?.title || ''}
                    onChange={(e) =>
                      setEditedStep({ ...editedStep, title: e.target.value })
                    }
                    className="font-headline text-lg font-semibold"
                  />
                  <Textarea
                    value={editedStep?.description || ''}
                    onChange={(e) =>
                      setEditedStep({
                        ...editedStep,
                        description: e.target.value,
                      })
                    }
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleSave(index)}>
                      <Save className="mr-1 h-4 w-4" /> Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleCancel}>
                      <X className="mr-1 h-4 w-4" /> Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <h3 className="font-headline text-lg font-semibold">
                    {item.title}
                  </h3>
                  <p className="text-muted-foreground">{item.description}</p>
                </>
              )}
            </div>

            {editingIndex !== index && (
              <div className="absolute right-0 top-2 z-10 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  onClick={() => handleEdit(index)}
                  aria-label={`Edit step: ${item.title}`}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  onClick={() => deleteStep(index)}
                  aria-label={`Delete step: ${item.title}`}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-2">
            <Input
              value={newStepTitle}
              onChange={(e) => setNewStepTitle(e.target.value)}
              placeholder="Add a new roadmap step..."
              onKeyDown={(e) => e.key === 'Enter' && handleAddStep()}
            />
            <Button onClick={handleAddStep}>
              <Plus className="mr-2 h-4 w-4" /> Add Step
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
