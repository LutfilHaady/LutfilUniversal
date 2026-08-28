'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Activity,
  Heart,
  Brain,
  AlertCircle,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface EmotionalData {
  date: string;
  anxiety: number;
  sadness: number;
  anger: number;
  overall: number;
}

interface YouthProfile {
  id: string;
  username: string;
  riskScore: 'High' | 'Medium' | 'Low';
  lastChecked: string;
  sentimentTags: string[];
  trend: 'up' | 'down' | 'stable';
  emotionalTrends: EmotionalData[];
}

// Mock data generator
const generateMockTrends = (): EmotionalData[] => {
  const dates = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    dates.push(date.toISOString().split('T')[0]);
  }

  return dates.map((date) => ({
    date: date.split('-').slice(1).join('/'), // MM/DD format
    anxiety: Math.floor(Math.random() * 80) + 10,
    sadness: Math.floor(Math.random() * 80) + 10,
    anger: Math.floor(Math.random() * 80) + 10,
    overall: Math.floor(Math.random() * 80) + 10,
  }));
};

const mockProfiles: Record<string, YouthProfile> = {
  '1': {
    id: '1',
    username: '@youth_alex',
    riskScore: 'High',
    lastChecked: '2 hours ago',
    sentimentTags: ['Anxiety', 'Sadness', 'Isolation'],
    trend: 'up',
    emotionalTrends: generateMockTrends(),
  },
  '2': {
    id: '2',
    username: '@youth_sam',
    riskScore: 'High',
    lastChecked: '5 hours ago',
    sentimentTags: ['Anger', 'Frustration'],
    trend: 'up',
    emotionalTrends: generateMockTrends(),
  },
  '3': {
    id: '3',
    username: '@youth_jordan',
    riskScore: 'Medium',
    lastChecked: '1 day ago',
    sentimentTags: ['Anxiety'],
    trend: 'stable',
    emotionalTrends: generateMockTrends(),
  },
  '4': {
    id: '4',
    username: '@youth_casey',
    riskScore: 'Medium',
    lastChecked: '2 days ago',
    sentimentTags: ['Sadness'],
    trend: 'down',
    emotionalTrends: generateMockTrends(),
  },
  '5': {
    id: '5',
    username: '@youth_riley',
    riskScore: 'Low',
    lastChecked: '3 days ago',
    sentimentTags: [],
    trend: 'stable',
    emotionalTrends: generateMockTrends(),
  },
};

export default function YouthProfilePage() {
  const params = useParams();
  const router = useRouter();
  const [profile, setProfile] = useState<YouthProfile | null>(null);

  useEffect(() => {
    const id = params.id as string;
    const foundProfile = mockProfiles[id];
    if (foundProfile) {
      setProfile(foundProfile);
    }
  }, [params.id]);

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-vox-teal-50 via-vox-blue-50 to-vox-teal-100 flex items-center justify-center">
        <p className="text-gray-600">Loading profile...</p>
      </div>
    );
  }

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

  const recentData = profile.emotionalTrends.slice(-7); // Last 7 days
  const avgAnxiety =
    recentData.reduce((sum, d) => sum + d.anxiety, 0) / recentData.length;
  const avgSadness =
    recentData.reduce((sum, d) => sum + d.sadness, 0) / recentData.length;
  const avgAnger =
    recentData.reduce((sum, d) => sum + d.anger, 0) / recentData.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-vox-teal-50 via-vox-blue-50 to-vox-teal-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <button
          onClick={() => router.push('/')}
          className="mb-6 flex items-center gap-2 text-vox-teal-700 hover:text-vox-teal-900 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Back to Priority Queue</span>
        </button>

        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {profile.username}
              </h1>
              <div className="flex items-center gap-4">
                <span
                  className={`px-4 py-2 rounded-full text-sm font-semibold border ${getRiskColor(
                    profile.riskScore
                  )}`}
                >
                  {profile.riskScore} Risk
                </span>
                <span className="text-gray-600 text-sm">
                  Last checked: {profile.lastChecked}
                </span>
              </div>
            </div>
          </div>

          {profile.sentimentTags.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                Active Sentiment Tags
              </h3>
              <div className="flex gap-2 flex-wrap">
                {profile.sentimentTags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-vox-blue-100 text-vox-blue-700 rounded-full text-sm font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Emotional Trends Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                  <Brain className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Anxiety</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {Math.round(avgAnxiety)}%
                  </p>
                </div>
              </div>
              {avgAnxiety > 60 ? (
                <TrendingUp className="w-5 h-5 text-red-500" />
              ) : (
                <TrendingDown className="w-5 h-5 text-green-500" />
              )}
            </div>
            <div className="text-xs text-gray-500">7-day average</div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <Heart className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Sadness</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {Math.round(avgSadness)}%
                  </p>
                </div>
              </div>
              {avgSadness > 60 ? (
                <TrendingUp className="w-5 h-5 text-red-500" />
              ) : (
                <TrendingDown className="w-5 h-5 text-green-500" />
              )}
            </div>
            <div className="text-xs text-gray-500">7-day average</div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Anger</p>
                  <p className="text-2xl font-bold text-red-600">
                    {Math.round(avgAnger)}%
                  </p>
                </div>
              </div>
              {avgAnger > 60 ? (
                <TrendingUp className="w-5 h-5 text-red-500" />
              ) : (
                <TrendingDown className="w-5 h-5 text-green-500" />
              )}
            </div>
            <div className="text-xs text-gray-500">7-day average</div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* 30-Day Trend Line Chart */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">
              30-Day Emotional Trends
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={profile.emotionalTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="anxiety"
                  stroke="#9333ea"
                  strokeWidth={2}
                  name="Anxiety"
                />
                <Line
                  type="monotone"
                  dataKey="sadness"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  name="Sadness"
                />
                <Line
                  type="monotone"
                  dataKey="anger"
                  stroke="#ef4444"
                  strokeWidth={2}
                  name="Anger"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* 7-Day Bar Chart */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">
              Last 7 Days Overview
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={recentData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="anxiety" fill="#9333ea" name="Anxiety" />
                <Bar dataKey="sadness" fill="#3b82f6" name="Sadness" />
                <Bar dataKey="anger" fill="#ef4444" name="Anger" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Overall Trend Chart */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">
            Overall Emotional State Trend
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={profile.emotionalTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="overall"
                stroke="#0f766e"
                strokeWidth={3}
                name="Overall Emotional State"
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
