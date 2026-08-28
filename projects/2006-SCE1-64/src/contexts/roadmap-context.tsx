'use client';

import React, { createContext, useContext, useState } from 'react';

export type RoadmapStep = {
  title: string;
  description?: string;
  date?: string;
  status: 'todo' | 'in_progress' | 'completed';
};

type RoadmapContextType = {
  roadmap: RoadmapStep[];
  addStep: (title: string) => void;
  deleteStep: (index: number) => void;
  toggleStatus: (index: number) => void;
  editStep: (index: number, title: string, description: string) => void;
};

const RoadmapContext = createContext<RoadmapContextType | undefined>(undefined);

export function RoadmapProvider({ children }: { children: React.ReactNode }) {
  const [roadmap, setRoadmap] = useState<RoadmapStep[]>([
    {
      title: 'Explore roles',
      description: 'Research software and AI career paths',
      date: '2025-11-04',
      status: 'in_progress',
    },
    {
      title: 'Build portfolio project',
      description: 'Finish Next.js job dashboard',
      date: '2025-11-10',
      status: 'todo',
    },
  ]);

  const addStep = (title: string) => {
    setRoadmap((prev) => [
      ...prev,
      {
        title,
        description: '',
        date: new Date().toISOString().split('T')[0],
        status: 'todo',
      },
    ]);
  };

  const deleteStep = (index: number) =>
    setRoadmap((prev) => prev.filter((_, i) => i !== index));

  const toggleStatus = (index: number) =>
    setRoadmap((prev) =>
      prev.map((step, i) =>
        i === index
          ? {
              ...step,
              status:
                step.status === 'todo'
                  ? 'in_progress'
                  : step.status === 'in_progress'
                  ? 'completed'
                  : 'todo',
            }
          : step
      )
    );

  const editStep = (index: number, title: string, description: string) =>
    setRoadmap((prev) =>
      prev.map((step, i) =>
        i === index ? { ...step, title, description } : step
      )
    );

  return (
    <RoadmapContext.Provider
      value={{ roadmap, addStep, deleteStep, toggleStatus, editStep }}
    >
      {children}
    </RoadmapContext.Provider>
  );
}

export function useRoadmap() {
  const context = useContext(RoadmapContext);
  if (!context)
    throw new Error('useRoadmap must be used within a RoadmapProvider');
  return context;
}
