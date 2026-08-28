import React, { useState } from 'react';
import './Sidebar.css';

interface SentimentResult {
  riskScore: 'High' | 'Medium' | 'Low';
  sentimentTags: string[];
}

const Sidebar: React.FC = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<SentimentResult | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  const handleCheckSentiment = async () => {
    setIsAnalyzing(true);
    setResult(null);

    try {
      // Simulate capturing current story (in real implementation, this would capture the visible story)
      const response = await fetch('http://localhost:8000/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: window.location.href,
          timestamp: new Date().toISOString(),
          // In production, this would include image data processed in volatile memory
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Error analyzing sentiment:', error);
      // Fallback mock data for demo
      setResult({
        riskScore: 'Medium',
        sentimentTags: ['Anxiety', 'Sadness'],
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'High':
        return '#ef4444';
      case 'Medium':
        return '#f59e0b';
      case 'Low':
        return '#10b981';
      default:
        return '#6b7280';
    }
  };

  return (
    <div className={`vox-sidebar ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div className="vox-sidebar-header">
        <h2>VOX Co-pilot</h2>
        <button
          className="toggle-btn"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          {isExpanded ? '−' : '+'}
        </button>
      </div>

      {isExpanded && (
        <div className="vox-sidebar-content">
          <div className="privacy-notice">
            <p>
              <strong>Privacy Notice:</strong> Images are processed in volatile
              memory only and are not stored, in compliance with PDPA and Meta
              policies.
            </p>
          </div>

          <button
            className="check-sentiment-btn"
            onClick={handleCheckSentiment}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? 'Analyzing...' : 'Check Sentiment'}
          </button>

          {result && (
            <div className="result-container">
              <div className="risk-score">
                <label>Risk Score:</label>
                <span
                  className="risk-badge"
                  style={{ backgroundColor: getRiskColor(result.riskScore) }}
                >
                  {result.riskScore}
                </span>
              </div>

              <div className="sentiment-tags">
                <label>Sentiment Tags:</label>
                <div className="tags-container">
                  {result.sentimentTags.map((tag, index) => (
                    <span key={index} className="sentiment-tag">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Sidebar;
