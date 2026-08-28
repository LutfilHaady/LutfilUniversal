# Financial Run Dynamics Analysis - Code Summary

## Overview
This notebook contains comprehensive analysis code for answering **Questions 1 and 3** from the Databusters 2026 case prompt, focusing on the Terra-Luna stablecoin collapse (2022).

## Questions Addressed

### Question 1: When the Peg Breaks - Onset and Spread
- **1.1 Onset Identification**: Analyzes when USTC first depegged from $1.00
- **1.2 Stress Visibility**: Examines transaction volumes and flows as indicators of panic
- **1.3 Panic Propagation**: Tracks how capital moved between tokens (flight to safety)
- **1.4 Sentiment Analysis**: Analyzes event data and information spread

### Question 3: Who Bears the Losses
- **3.1 Loss Identification**: Identifies which addresses/participants suffered losses
- **3.2 Loss Estimation**: Calculates estimated losses based on price decline
- **3.3 System Design Failures**: Analyzes why the algorithmic mechanism failed
- **3.4 Comparative Analysis**: Compares Terra-Luna with Reserve Primary Fund (2008)

## Key Features

### Data Loading
- Loads price data for all stablecoins (USTC, WLUNA, USDC, USDT, DAI, PAX)
- Loads transaction data in chunks to handle large files
- Loads event/sentiment data
- Handles nested ZIP files efficiently

### Visualizations Generated
1. `q1_onset_price_depegging.png` - Price evolution and depegging timeline
2. `q1_stress_transaction_patterns.png` - Transaction volumes and flight to safety
3. `q1_panic_propagation_flows.png` - Heatmaps showing panic propagation
4. `q1_sentiment_events.png` - Sentiment analysis over time
5. `q3_loss_identification.png` - Address-level loss analysis
6. `q3_loss_estimation.png` - Estimated losses distribution
7. `q3_system_design_failure.png` - Death spiral analysis (USTC vs WLUNA)
8. `q3_comparative_analysis.png` - Comparison with Reserve Primary Fund

## Key Findings

### Question 1 Findings
- USTC began depegging on May 9, 2022
- Transaction volumes spiked dramatically during collapse
- Clear flight to safety observed (flows to USDC, USDT, DAI)
- Negative sentiment correlated with price decline

### Question 3 Findings
- All USTC holders suffered losses proportional to holdings
- Algorithmic mechanism failed due to circular dependency
- No reserve backing or insurance protection
- Comparison shows both Terra and Reserve Primary lacked adequate safeguards

## Usage

1. Ensure `ERC20-stablecoins.zip` is in the same directory as the notebook
2. Run all cells sequentially
3. Visualizations will be saved as PNG files in the same directory
4. Review output for key statistics and findings

## Dependencies
- pandas
- numpy
- matplotlib
- seaborn
- zipfile (standard library)
- io (standard library)

## Notes
- The code handles missing data gracefully
- Transaction data is loaded in chunks to manage memory
- All visualizations are saved at 300 DPI for publication quality
- The analysis focuses on the period April 1 - June 1, 2022
