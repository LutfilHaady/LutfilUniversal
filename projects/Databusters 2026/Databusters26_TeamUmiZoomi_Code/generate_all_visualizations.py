"""
Complete visualization generator for Databusters 2026
Generates all required visualizations for Questions 1 & 3
"""
import zipfile
import io
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import datetime
import warnings
import os
warnings.filterwarnings('ignore')

# Set style
plt.style.use('seaborn-v0_8-darkgrid')
sns.set_palette("husl")

# Create visualization directories
os.makedirs('visualizations/q1_onset', exist_ok=True)
os.makedirs('visualizations/q1_propagation', exist_ok=True)
os.makedirs('visualizations/q3_losses', exist_ok=True)
os.makedirs('visualizations/comparative', exist_ok=True)

print("=" * 80)
print("GENERATING ALL REQUIRED VISUALIZATIONS")
print("=" * 80)

# Define contract addresses
CONTRACT_ADDRESSES = {
    '0x6b175474e89094c44da98b954eedeac495271d0f': 'DAI',
    '0x8e870d67f660d95d5be530380d0ec0bd388289e1': 'PAX',
    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 'USDC',
    '0xdac17f958d2ee523a2206206994597c13d831ec7': 'USDT',
    '0xa47c8bf37f92abed4a126bda807a7b7498661acd': 'USTC',
    '0xd2877702675e6ceb975b4a1dff9fb7baf4c91ea9': 'WLUNA'
}

# Key dates
COLLAPSE_START = pd.Timestamp('2022-05-09', tz='UTC')
COLLAPSE_END = pd.Timestamp('2022-06-01', tz='UTC')
PRE_COLLAPSE_START = pd.Timestamp('2022-04-01', tz='UTC')

# Load price data
print("\nLoading price data...")
price_data = {}
with zipfile.ZipFile("ERC20-stablecoins.zip") as outer_zip:
    nested_zip_paths = ["price_data.zip", "ERC20-stablecoins/price_data.zip"]
    nested_zip_data = None
    for path in nested_zip_paths:
        try:
            nested_zip_data = outer_zip.read(path)
            break
        except KeyError:
            continue
    
    if nested_zip_data:
        with zipfile.ZipFile(io.BytesIO(nested_zip_data)) as inner_zip:
            for token in ['ustc', 'wluna', 'usdc', 'usdt', 'dai', 'pax']:
                try:
                    paths_to_try = [f"price_data/{token}_price_data.csv", f"{token}_price_data.csv"]
                    df = None
                    for inner_path in paths_to_try:
                        try:
                            with inner_zip.open(inner_path) as f:
                                df = pd.read_csv(f)
                                break
                        except KeyError:
                            continue
                    if df is not None:
                        df['timestamp'] = pd.to_datetime(df['timestamp'], unit='s', utc=True)
                        df['token'] = token.upper()
                        price_data[token.upper()] = df
                        print(f"  Loaded {token.upper()}: {len(df)} records")
                except Exception as e:
                    print(f"  Error loading {token}: {e}")

# Load event data
print("\nLoading event data...")
event_data = pd.DataFrame()
with zipfile.ZipFile("ERC20-stablecoins.zip") as z:
    for path in ["event_data.csv", "ERC20-stablecoins/event_data.csv"]:
        try:
            with z.open(path) as f:
                event_data = pd.read_csv(f, encoding='latin-1')
                event_data['timestamp'] = pd.to_datetime(event_data['timestamp'], unit='s', utc=True)
                print(f"  Loaded event data: {len(event_data)} events")
                break
        except (KeyError, Exception):
            continue

# ============================================================================
# Q1.1: PRICE DEPEGGING (Already exists, but regenerate in folder)
# ============================================================================
if 'USTC' in price_data:
    print("\n" + "=" * 80)
    print("Generating Q1.1: Price Depegging")
    print("=" * 80)
    
    ustc_price = price_data['USTC'].copy().sort_values('timestamp')
    ustc_price['peg_deviation'] = (ustc_price['close'] - 1.0) * 100
    ustc_price['peg_deviation_abs'] = abs(ustc_price['peg_deviation'])
    depeg_threshold = 1.0
    ustc_price['is_depegged'] = ustc_price['peg_deviation_abs'] > depeg_threshold
    first_depeg = ustc_price[ustc_price['is_depegged']].iloc[0] if ustc_price['is_depegged'].any() else None
    
    fig, axes = plt.subplots(2, 1, figsize=(14, 10))
    
    ax1 = axes[0]
    ax1.plot(ustc_price['timestamp'], ustc_price['close'], linewidth=2, label='USTC Price', color='red')
    ax1.axhline(y=1.0, color='green', linestyle='--', linewidth=2, label='$1.00 Peg')
    ax1.axhline(y=0.95, color='orange', linestyle='--', linewidth=1, alpha=0.7, label='5% Depeg Threshold')
    if first_depeg is not None:
        ax1.axvline(x=first_depeg['timestamp'], color='red', linestyle=':', linewidth=2, alpha=0.7, label='First Depeg')
    ax1.set_xlabel('Date', fontsize=12)
    ax1.set_ylabel('Price (USD)', fontsize=12)
    ax1.set_title('USTC Price Evolution: Onset of the Crisis', fontsize=14, fontweight='bold')
    ax1.legend(loc='best')
    ax1.grid(True, alpha=0.3)
    ax1.set_xlim([PRE_COLLAPSE_START, COLLAPSE_END])
    
    ax2 = axes[1]
    ax2.plot(ustc_price['timestamp'], ustc_price['peg_deviation'], linewidth=2, label='Deviation from $1.00 Peg', color='darkred')
    ax2.axhline(y=0, color='green', linestyle='--', linewidth=1, alpha=0.5)
    ax2.axhline(y=-1, color='orange', linestyle='--', linewidth=1, alpha=0.7)
    ax2.fill_between(ustc_price['timestamp'], -1, 1, alpha=0.1, color='green', label='Stable Zone (±1%)')
    if first_depeg is not None:
        ax2.axvline(x=first_depeg['timestamp'], color='red', linestyle=':', linewidth=2, alpha=0.7)
    ax2.set_xlabel('Date', fontsize=12)
    ax2.set_ylabel('Deviation from Peg (%)', fontsize=12)
    ax2.set_title('USTC Peg Deviation Over Time', fontsize=14, fontweight='bold')
    ax2.legend(loc='best')
    ax2.grid(True, alpha=0.3)
    ax2.set_xlim([PRE_COLLAPSE_START, COLLAPSE_END])
    
    plt.tight_layout()
    plt.savefig('visualizations/q1_onset/q1_onset_price_depegging.png', dpi=300, bbox_inches='tight')
    plt.savefig('q1_onset_price_depegging.png', dpi=300, bbox_inches='tight')
    plt.close()
    print("  Saved: visualizations/q1_onset/q1_onset_price_depegging.png")

# ============================================================================
# Q1.4: SENTIMENT ANALYSIS
# ============================================================================
if not event_data.empty:
    print("\n" + "=" * 80)
    print("Generating Q1.4: Sentiment Analysis")
    print("=" * 80)
    
    event_analysis = event_data[
        (event_data['timestamp'] >= PRE_COLLAPSE_START) & 
        (event_data['timestamp'] <= COLLAPSE_END)
    ].copy()
    ustc_events = event_analysis[event_analysis['stablecoin'].str.upper() == 'USTC'].copy()
    
    if len(ustc_events) > 0:
        fig, ax = plt.subplots(figsize=(14, 6))
        
        if 'USTC' in price_data:
            ustc_price_plot = price_data['USTC'][
                (price_data['USTC']['timestamp'] >= PRE_COLLAPSE_START) & 
                (price_data['USTC']['timestamp'] <= COLLAPSE_END)
            ]
            ax2 = ax.twinx()
            ax2.plot(ustc_price_plot['timestamp'], ustc_price_plot['close'], 
                    color='red', linewidth=2, alpha=0.5, label='USTC Price')
            ax2.axhline(y=1.0, color='green', linestyle='--', alpha=0.3)
            ax2.set_ylabel('USTC Price (USD)', fontsize=11, color='red')
            ax2.tick_params(axis='y', labelcolor='red')
            ax2.set_ylim([0, 1.1])
        
        colors = {'positive': 'green', 'negative': 'red', 'neutral': 'gray'}
        sentiment_counts = ustc_events['type'].value_counts()
        for sentiment in ['positive', 'negative', 'neutral']:
            events_subset = ustc_events[ustc_events['type'] == sentiment]
            if len(events_subset) > 0:
                ax.scatter(events_subset['timestamp'], 
                          [sentiment_counts[sentiment]] * len(events_subset),
                          c=colors.get(sentiment, 'black'), 
                          s=100, alpha=0.7, label=f'{sentiment.capitalize()} Events',
                          edgecolors='black', linewidths=1)
        
        ax.set_xlabel('Date', fontsize=12)
        ax.set_ylabel('Event Count', fontsize=11)
        ax.set_title('Information Spread: USTC Events and Price Evolution', fontsize=14, fontweight='bold')
        ax.legend(loc='upper left')
        ax.grid(True, alpha=0.3)
        
        plt.tight_layout()
        plt.savefig('visualizations/q1_propagation/q1_sentiment_events.png', dpi=300, bbox_inches='tight')
        plt.savefig('q1_sentiment_events.png', dpi=300, bbox_inches='tight')
        plt.close()
        print("  Saved: visualizations/q1_propagation/q1_sentiment_events.png")

# ============================================================================
# Q3.3: SYSTEM DESIGN FAILURE
# ============================================================================
if 'USTC' in price_data and 'WLUNA' in price_data:
    print("\n" + "=" * 80)
    print("Generating Q3.3: System Design Failure")
    print("=" * 80)
    
    ustc_price_analysis = price_data['USTC'][
        (price_data['USTC']['timestamp'] >= PRE_COLLAPSE_START) & 
        (price_data['USTC']['timestamp'] <= COLLAPSE_END)
    ].copy()
    
    wluna_price_analysis = price_data['WLUNA'][
        (price_data['WLUNA']['timestamp'] >= PRE_COLLAPSE_START) & 
        (price_data['WLUNA']['timestamp'] <= COLLAPSE_END)
    ].copy()
    
    ustc_price_analysis['date'] = ustc_price_analysis['timestamp'].dt.date
    wluna_price_analysis['date'] = wluna_price_analysis['timestamp'].dt.date
    
    ustc_daily = ustc_price_analysis.groupby('date')['close'].mean().reset_index()
    wluna_daily = wluna_price_analysis.groupby('date')['close'].mean().reset_index()
    
    ustc_daily.columns = ['date', 'ustc_price']
    wluna_daily.columns = ['date', 'wluna_price']
    
    combined = ustc_daily.merge(wluna_daily, on='date', how='outer').sort_values('date')
    combined['date'] = pd.to_datetime(combined['date'])
    
    correlation = combined[['ustc_price', 'wluna_price']].corr().iloc[0, 1]
    
    fig, axes = plt.subplots(3, 1, figsize=(14, 12))
    
    ax1 = axes[0]
    ax1.plot(combined['date'], combined['ustc_price'], linewidth=2, label='USTC Price', color='red', alpha=0.8)
    ax1_twin = ax1.twinx()
    ax1_twin.plot(combined['date'], combined['wluna_price'], linewidth=2, label='WLUNA Price', color='blue', alpha=0.8)
    ax1.axhline(y=1.0, color='green', linestyle='--', linewidth=2, alpha=0.5)
    ax1.set_xlabel('Date', fontsize=11)
    ax1.set_ylabel('USTC Price (USD)', fontsize=11, color='red')
    ax1_twin.set_ylabel('WLUNA Price (USD)', fontsize=11, color='blue')
    ax1.tick_params(axis='y', labelcolor='red')
    ax1_twin.tick_params(axis='y', labelcolor='blue')
    ax1.set_title('Death Spiral: USTC and WLUNA Price Collapse', fontsize=13, fontweight='bold')
    ax1.legend(loc='upper left')
    ax1_twin.legend(loc='upper right')
    ax1.grid(True, alpha=0.3)
    
    ax2 = axes[1]
    combined['ustc_deviation'] = (combined['ustc_price'] - 1.0) * 100
    ax2.plot(combined['date'], combined['ustc_deviation'], linewidth=2, color='darkred', label='USTC Deviation from $1 Peg')
    ax2.axhline(y=0, color='green', linestyle='--', linewidth=1, alpha=0.5)
    ax2.fill_between(combined['date'], -5, 5, alpha=0.1, color='green', label='Stable Zone (±5%)')
    ax2.set_xlabel('Date', fontsize=11)
    ax2.set_ylabel('Deviation from Peg (%)', fontsize=11)
    ax2.set_title('USTC Peg Stability: Mechanism Failure', fontsize=13, fontweight='bold')
    ax2.legend()
    ax2.grid(True, alpha=0.3)
    
    ax3 = axes[2]
    scatter_data = combined.dropna()
    if len(scatter_data) > 0:
        scatter = ax3.scatter(scatter_data['ustc_price'], scatter_data['wluna_price'], 
                   alpha=0.5, s=50, c=range(len(scatter_data)), cmap='viridis')
        ax3.set_xlabel('USTC Price (USD)', fontsize=11)
        ax3.set_ylabel('WLUNA Price (USD)', fontsize=11)
        ax3.set_title(f'USTC vs WLUNA: Correlation = {correlation:.3f}', fontsize=13, fontweight='bold')
        ax3.axvline(x=1.0, color='green', linestyle='--', alpha=0.5)
        ax3.grid(True, alpha=0.3)
        plt.colorbar(scatter, ax=ax3, label='Time Progression')
    
    plt.tight_layout()
    plt.savefig('visualizations/q3_losses/q3_system_design_failure.png', dpi=300, bbox_inches='tight')
    plt.savefig('q3_system_design_failure.png', dpi=300, bbox_inches='tight')
    plt.close()
    print("  Saved: visualizations/q3_losses/q3_system_design_failure.png")

# ============================================================================
# Q3.4: COMPARATIVE ANALYSIS - TERRA vs RESERVE PRIMARY FUND
# ============================================================================
print("\n" + "=" * 80)
print("Generating Q3.4: Comparative Analysis")
print("=" * 80)

# Create comparison visualization
fig, axes = plt.subplots(1, 2, figsize=(16, 6))

# Plot 1: Terra-Luna loss timeline
ax1 = axes[0]
if 'USTC' in price_data:
    terra_timeline = price_data['USTC'][
        (price_data['USTC']['timestamp'] >= pd.Timestamp('2022-05-09', tz='UTC')) &
        (price_data['USTC']['timestamp'] <= pd.Timestamp('2022-05-12', tz='UTC'))
    ]
    if len(terra_timeline) > 0:
        terra_timeline['loss_pct'] = (1.0 - terra_timeline['close']) * 100
        ax1.plot(terra_timeline['timestamp'], terra_timeline['loss_pct'], 
                linewidth=3, color='red', marker='o', markersize=4)
        ax1.fill_between(terra_timeline['timestamp'], 0, terra_timeline['loss_pct'], 
                        alpha=0.3, color='red')
        ax1.set_xlabel('Date', fontsize=11)
        ax1.set_ylabel('Loss Percentage (%)', fontsize=11)
        ax1.set_title('Terra-Luna: Loss Evolution (May 9-12, 2022)', fontsize=12, fontweight='bold')
        ax1.grid(True, alpha=0.3)
        ax1.set_ylim([0, 100])

# Plot 2: Reserve Primary Fund (based on historical data)
ax2 = axes[1]
# Historical: Fund broke the buck on Sept 16, 2008, dropped from $1.00 to $0.97
rpf_dates = pd.date_range(start='2008-09-15', end='2008-09-17', freq='H')
rpf_losses = [0] * 24 + [3] * 25  # 0% until Sept 16, then 3% loss
ax2.plot(rpf_dates[:len(rpf_losses)], rpf_losses, 
        linewidth=3, color='blue', marker='s', markersize=4)
ax2.fill_between(rpf_dates[:len(rpf_losses)], 0, rpf_losses, alpha=0.3, color='blue')
ax2.set_xlabel('Date', fontsize=11)
ax2.set_ylabel('Loss Percentage (%)', fontsize=11)
ax2.set_title('Reserve Primary Fund: Loss Evolution (Sept 15-17, 2008)', fontsize=12, fontweight='bold')
ax2.grid(True, alpha=0.3)
ax2.set_ylim([0, 5])

plt.tight_layout()
plt.savefig('visualizations/comparative/q3_comparative_analysis.png', dpi=300, bbox_inches='tight')
plt.savefig('q3_comparative_analysis.png', dpi=300, bbox_inches='tight')
plt.close()
print("  Saved: visualizations/comparative/q3_comparative_analysis.png")

# ============================================================================
# ADDITIONAL: COMPARATIVE TIMELINE
# ============================================================================
print("\n" + "=" * 80)
print("Generating Additional: Side-by-Side Timeline Comparison")
print("=" * 80)

fig, axes = plt.subplots(2, 1, figsize=(16, 10))

# Terra-Luna timeline
ax1 = axes[0]
if 'USTC' in price_data:
    terra_full = price_data['USTC'][
        (price_data['USTC']['timestamp'] >= PRE_COLLAPSE_START) & 
        (price_data['USTC']['timestamp'] <= COLLAPSE_END)
    ]
    ax1.plot(terra_full['timestamp'], terra_full['close'], linewidth=2, color='red', label='USTC Price')
    ax1.axhline(y=1.0, color='green', linestyle='--', linewidth=2, alpha=0.5, label='$1.00 Peg')
    ax1.axvline(x=COLLAPSE_START, color='orange', linestyle=':', linewidth=2, alpha=0.7, label='Crisis Start (May 9)')
    ax1.set_ylabel('Price (USD)', fontsize=12)
    ax1.set_title('Terra-Luna Collapse (2022): Price Evolution', fontsize=14, fontweight='bold')
    ax1.legend()
    ax1.grid(True, alpha=0.3)
    ax1.set_ylim([0, 1.1])

# Reserve Primary Fund (simulated based on historical knowledge)
ax2 = axes[1]
# Historical timeline: stable at $1.00 until Sept 15 evening, then broke the buck
rpf_timeline_dates = pd.date_range(start='2008-09-10', end='2008-09-20', freq='6H')
rpf_timeline_prices = [1.00] * 20 + [0.99] * 2 + [0.98] * 2 + [0.97] * (len(rpf_timeline_dates) - 24)  # Gradual decline
ax2.plot(rpf_timeline_dates, rpf_timeline_prices[:len(rpf_timeline_dates)], 
        linewidth=2, color='blue', label='NAV per Share')
ax2.axhline(y=1.0, color='green', linestyle='--', linewidth=2, alpha=0.5, label='$1.00 NAV')
ax2.axvline(x=pd.Timestamp('2008-09-16'), color='orange', linestyle=':', linewidth=2, alpha=0.7, label='Broke the Buck (Sept 16)')
ax2.set_xlabel('Date', fontsize=12)
ax2.set_ylabel('NAV per Share (USD)', fontsize=12)
ax2.set_title('Reserve Primary Fund Collapse (2008): NAV Evolution', fontsize=14, fontweight='bold')
ax2.legend()
ax2.grid(True, alpha=0.3)
ax2.set_ylim([0.95, 1.01])

plt.tight_layout()
plt.savefig('visualizations/comparative/comparative_timeline.png', dpi=300, bbox_inches='tight')
plt.close()
print("  Saved: visualizations/comparative/comparative_timeline.png")

print("\n" + "=" * 80)
print("ALL VISUALIZATIONS GENERATED SUCCESSFULLY!")
print("=" * 80)
print("\nVisualizations saved in:")
print("  - visualizations/q1_onset/")
print("  - visualizations/q1_propagation/")
print("  - visualizations/q3_losses/")
print("  - visualizations/comparative/")
