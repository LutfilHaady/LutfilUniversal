# Visualization Index
## Complete List of Generated Visualizations

## Question 1: When the Peg Breaks - Onset and Spread

### Q1.1: Onset - Price Depegging
- **File**: `visualizations/q1_onset/q1_onset_price_depegging.png`
- **Also saved as**: `q1_onset_price_depegging.png` (root directory)
- **Description**: Shows USTC price evolution and deviation from $1.00 peg
- **Key Insights**: 
  - First significant depegging detected on May 9, 2022
  - Major depegging (<$0.95) occurred on May 10, 2022
  - Visualizes the onset of the crisis

### Q1.4: Sentiment and Information Spread
- **File**: `visualizations/q1_propagation/q1_sentiment_events.png`
- **Also saved as**: `q1_sentiment_events.png` (root directory)
- **Description**: Shows USTC-related events (tweets/news) overlaid with price evolution
- **Key Insights**:
  - Negative sentiment events correlated with price decline
  - Information spread accelerated panic
  - Demonstrates how panic propagates through information channels

## Question 3: Who Bears the Losses

### Q3.3: System Design Failure - Death Spiral
- **File**: `visualizations/q3_losses/q3_system_design_failure.png`
- **Also saved as**: `q3_system_design_failure.png` (root directory)
- **Description**: Shows the death spiral mechanism - USTC and WLUNA price collapse together
- **Key Insights**:
  - High correlation (0.9326) between USTC and WLUNA prices
  - Algorithmic mechanism failed under stress
  - Demonstrates why the system couldn't protect participants

## Comparative Analysis

### Q3.4: Loss Evolution Comparison
- **File**: `visualizations/comparative/q3_comparative_analysis.png`
- **Also saved as**: `q3_comparative_analysis.png` (root directory)
- **Description**: Side-by-side comparison of loss evolution in Terra-Luna (2022) vs Reserve Primary Fund (2008)
- **Key Insights**:
  - Terra-Luna: Massive losses (up to 100%) over days
  - Reserve Primary: Smaller losses (3%) but rapid onset
  - Different loss magnitudes and timelines

### Additional: Side-by-Side Timeline
- **File**: `visualizations/comparative/comparative_timeline.png`
- **Description**: Timeline comparison showing price/NAV evolution for both crises
- **Key Insights**:
  - Terra-Luna: Gradual decline over days
  - Reserve Primary: Sudden break over hours
  - Visual comparison of crisis dynamics

---

## Visualization Usage in Presentation

### Slide 3: Question 1 - Onset
- Use: `q1_onset_price_depegging.png`
- Use: `comparative_timeline.png` (side-by-side)

### Slide 4: Question 1 - Stress Visibility
- Use: `q1_sentiment_events.png`

### Slide 5: Question 1 - Panic Propagation
- Use: `q3_system_design_failure.png` (death spiral)

### Slide 6: Question 3 - Terra-Luna Losses
- Use: `q3_system_design_failure.png` (correlation analysis)

### Slide 8: Comparative Analysis
- Use: `q3_comparative_analysis.png`
- Use: `comparative_timeline.png`

---

## File Organization

```
visualizations/
├── q1_onset/
│   └── q1_onset_price_depegging.png
├── q1_propagation/
│   └── q1_sentiment_events.png
├── q3_losses/
│   └── q3_system_design_failure.png
└── comparative/
    ├── q3_comparative_analysis.png
    └── comparative_timeline.png
```

All visualizations are also saved in the root directory for easy access.

---

## Notes

- All visualizations are saved at 300 DPI for publication quality
- Colors are consistent across visualizations (red for Terra-Luna, blue for Reserve Primary)
- All charts include proper labels, legends, and titles
- Visualizations are ready for direct use in slide deck
