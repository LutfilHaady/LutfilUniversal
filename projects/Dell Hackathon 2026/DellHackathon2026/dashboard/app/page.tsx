'use client';

import { useState } from 'react';
import { AlertTriangle, TrendingUp, TrendingDown, Minus, Clock, User } from 'lucide-react';
import Link from 'next/link';

interface YouthProfile {
  id: string;
  username: string;
  riskScore: 'High' | 'Medium' | 'Low';
  lastChecked: string;
  sentimentTags: string[];
  trend: 'up' | 'down' | 'stable';
}

// Mock data for demonstration
const mockYouths: YouthProfile[] = [
  {
    id: '1',
    username: '@youth_alex',
    riskScore: 'High',
    lastChecked: '2 hours ago',
    sentimentTags: ['Anxiety', 'Sadness', 'Isolation'],
    trend: 'up',
  },
  {
    id: '2',
    username: '@youth_sam',
    riskScore: 'High',
    lastChecked: '5 hours ago',
    sentimentTags: ['Anger', 'Frustration'],
    trend: 'up',
  },
  {
    id: '3',
    username: '@youth_jordan',
    riskScore: 'Medium',
    lastChecked: '1 day ago',
    sentimentTags: ['Anxiety'],
    trend: 'stable',
  },
  {
    id: '4',
    username: '@youth_casey',
    riskScore: 'Medium',
    lastChecked: '2 days ago',
    sentimentTags: ['Sadness'],
    trend: 'down',
  },
  {
    id: '5',
    username: '@youth_riley',
    riskScore: 'Low',
    lastChecked: '3 days ago',
    sentimentTags: [],
    trend: 'stable',
  },
];

const getRiskColor = (risk: string) => {
  switch (risk) {
    case 'High':
      return 'bg-red-100 text-red-800 border-red-300';
    case 'Medium':
      return 'bg-amber-100 text-amber-800 border-amber-300';
    case 'Low':
      return 'bg-green-100 text-green-800 border-green-300';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300';
  }
};

const getTrendIcon = (trend: string) => {
  switch (trend) {
    case 'up':
      return <TrendingUp className="w-4 h-4 text-red-600" />;
    case 'down':
      return <TrendingDown className="w-4 h-4 text-green-600" />;
    default:
      return <Minus className="w-4 h-4 text-gray-600" />;
  }
};

export default function PriorityQueue() {
  const [selectedRisk, setSelectedRisk] = useState<string | null>(null);

  const filteredYouths = selectedRisk
    ? mockYouths.filter((y) => y.riskScore === selectedRisk)
    : mockYouths;

  // Sort by risk priority: High > Medium > Low
  const sortedYouths = [...filteredYouths].sort((a, b) => {
    const riskOrder = { High: 0, Medium: 1, Low: 2 };
    return riskOrder[a.riskScore] - riskOrder[b.riskScore];
  });

  const riskCounts = {
    High: mockYouths.filter((y) => y.riskScore === 'High').length,
    Medium: mockYouths.filter((y) => y.riskScore === 'Medium').length,
    Low: mockYouths.filter((y) => y.riskScore === 'Low').length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-vox-teal-50 via-vox-blue-50 to-vox-teal-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-vox-teal-800 mb-2">
            VOX CareCenter
          </h1>
          <p className="text-vox-teal-600 text-lg">
            Priority Queue - Flagged Youths Dashboard
          </p>
        </div>

        {/* Risk Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">High Risk</p>
                <p className="text-3xl font-bold text-red-600 mt-2">
                  {riskCounts.High}
                </p>
              </div>
              <AlertTriangle className="w-12 h-12 text-red-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-amber-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Medium Risk</p>
                <p className="text-3xl font-bold text-amber-600 mt-2">
                  {riskCounts.Medium}
                </p>
              </div>
              <AlertTriangle className="w-12 h-12 text-amber-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Low Risk</p>
                <p className="text-3xl font-bold text-green-600 mt-2">
                  {riskCounts.Low}
                </p>
              </div>
              <AlertTriangle className="w-12 h-12 text-green-500" />
            </div>
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setSelectedRisk(null)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedRisk === null
                ? 'bg-vox-teal-600 text-white'
                : 'bg-white text-vox-teal-600 hover:bg-vox-teal-50'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setSelectedRisk('High')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedRisk === 'High'
                ? 'bg-red-600 text-white'
                : 'bg-white text-red-600 hover:bg-red-50'
            }`}
          >
            High Risk
          </button>
          <button
            onClick={() => setSelectedRisk('Medium')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedRisk === 'Medium'
                ? 'bg-amber-600 text-white'
                : 'bg-white text-amber-600 hover:bg-amber-50'
            }`}
          >
            Medium Risk
          </button>
          <button
            onClick={() => setSelectedRisk('Low')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedRisk === 'Low'
                ? 'bg-green-600 text-white'
                : 'bg-white text-green-600 hover:bg-green-50'
            }`}
          >
            Low Risk
          </button>
        </div>

        {/* Priority Queue List */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="divide-y divide-gray-200">
            {sortedYouths.map((youth) => (
              <Link
                key={youth.id}
                href={`/profile/${youth.id}`}
                className="block hover:bg-vox-teal-50 transition-colors"
              >
                <div className="p-6 flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-12 h-12 rounded-full bg-vox-teal-200 flex items-center justify-center">
                      <User className="w-6 h-6 text-vox-teal-700" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {youth.username}
                        </h3>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold border ${getRiskColor(
                            youth.riskScore
                          )}`}
                        >
                          {youth.riskScore} Risk
                        </span>
                        {getTrendIcon(youth.trend)}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          <span>Last checked: {youth.lastChecked}</span>
                        </div>
                        {youth.sentimentTags.length > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Tags:</span>
                            <div className="flex gap-1">
                              {youth.sentimentTags.map((tag, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-1 bg-vox-blue-100 text-vox-blue-700 rounded text-xs"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-vox-teal-600">
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {sortedYouths.length === 0 && (
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <p className="text-gray-500 text-lg">
              No youths found with the selected risk level.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
