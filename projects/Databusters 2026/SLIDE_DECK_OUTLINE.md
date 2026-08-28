# Databusters 2026: Financial Run Dynamics
## Slide Deck Outline (10 Slides)

---

## **Slide 1: Title Slide**
**Content:**
- Title: "Financial Run Dynamics: Comparing Terra-Luna (2022) and Reserve Primary Fund (2008)"
- Subtitle: "When Confidence Breaks: Onset, Spread, and Loss Distribution"
- Group Name: [Your Group Name]
- Team Members: [Names]
- Date: February 2026

**Visual Elements:**
- Clean, professional design
- Minimal text

---

## **Slide 2: Problem Statement & Research Questions**
**Content:**
- **Problem**: Financial runs occur in both traditional (MMFs) and new-age (stablecoins) systems
- **Research Questions**:
  1. **Question 1**: When the Peg Breaks - Onset and Spread
     - When does confidence break down?
     - How does stress become visible?
     - How does panic propagate?
  2. **Question 3**: Who Bears the Losses?
     - Which parties suffer losses?
     - Why couldn't the system protect them?
     - How did design differences affect outcomes?

**Key Points to Explain:**
- Both crises share similar dynamics despite different institutional settings
- Need to understand onset, propagation, and loss distribution
- Focus on algorithmic stablecoins vs. regulated money market funds

**Visual Elements:**
- Side-by-side comparison of Terra-Luna and Reserve Primary Fund logos/icons
- Timeline showing both crises (2008 vs 2022)

---

## **Slide 3: Question 1 - When the Peg Breaks: Onset**
**Content:**
- **Terra-Luna (2022)**:
  - First significant depegging: May 9, 2022 (>1% deviation)
  - Major depegging (<$0.95): May 10, 2022
  - Complete collapse within 72 hours
- **Reserve Primary Fund (2008)**:
  - Broke the buck: September 16, 2008
  - NAV dropped from $1.00 to $0.97
  - Crisis unfolded over hours, not days

**Visual Elements:**
- **Use**: `visualizations/q1_onset/q1_onset_price_depegging.png`
- **Use**: `visualizations/comparative/comparative_timeline.png` (side-by-side)

**Key Points to Explain:**
- Terra-Luna: Gradual depegging visible in price data, algorithmic mechanism failed
- Reserve Primary: Sudden break due to Lehman exposure, first-come-first-served created run
- Both: Loss of confidence triggered self-reinforcing dynamics
- Speed difference: Crypto (days) vs. Traditional (hours)

---

## **Slide 4: Question 1 - How Stress Becomes Visible**
**Content:**
- **Terra-Luna Indicators**:
  - Price deviation from $1.00 peg
  - Transaction volume spikes
  - Negative sentiment events
  - Flight to safety (USDC, USDT, DAI)
- **Reserve Primary Fund Indicators**:
  - NAV decline below $1.00
  - Redemption requests ($40B in days)
  - Market panic signals

**Visual Elements:**
- **Use**: `visualizations/q1_propagation/q1_sentiment_events.png`
- Show correlation between negative events and price decline

**Key Points to Explain:**
- **Terra-Luna**: Stress visible through on-chain data (transparent blockchain)
  - Price depegging = first visible sign
  - Sentiment analysis shows information spread
  - Transaction patterns reveal panic selling
- **Reserve Primary**: Stress visible through NAV and redemption flows
  - Breaking the buck = loss of confidence signal
  - Redemption requests = panic indicator
- **Common Pattern**: Information spread accelerates panic in both cases

---

## **Slide 5: Question 1 - Panic Propagation**
**Content:**
- **Terra-Luna Propagation Mechanism**:
  - Death spiral: UST depegging → LUNA collapse → further UST depegging
  - Algorithmic arbitrage mechanism failed
  - No circuit breakers or intervention
- **Reserve Primary Fund Propagation**:
  - First-come-first-served redemptions
  - Early redeemers got out at $1.00
  - Late redeemers received $0.97
  - Created incentive to redeem early

**Visual Elements:**
- **Use**: `visualizations/q3_losses/q3_system_design_failure.png` (death spiral)
- Flow diagram showing propagation mechanisms

**Key Points to Explain:**
- **Terra-Luna**: 
  - Algorithmic mechanism designed to restore peg actually accelerated collapse
  - Circular dependency: UST stability ↔ LUNA value
  - No regulatory intervention possible
- **Reserve Primary**:
  - Sequential redemption created first-mover advantage
  - Information asymmetry: early movers benefited
  - Regulatory framework existed but couldn't prevent run
- **Commonality**: Both systems lacked adequate safeguards during stress

---

## **Slide 6: Question 3 - Who Bears the Losses: Terra-Luna**
**Content:**
- **Loss Distribution**:
  - All USTC holders suffered losses proportional to holdings
  - No first-come-first-served advantage (blockchain transparency)
  - Estimated losses: [Calculate from data]
  - Large holders and small holders affected equally based on position size
- **Why System Couldn't Protect**:
  - No reserve backing
  - Algorithmic mechanism failed
  - No insurance fund
  - No regulatory protection

**Visual Elements:**
- **Use**: `visualizations/q3_losses/q3_system_design_failure.png` (correlation analysis)
- Loss distribution chart (if transaction data available)

**Key Points to Explain:**
- **Transparency**: Blockchain made all positions visible, no information advantage
- **Proportional Losses**: Everyone lost based on their USTC holdings at collapse
- **No Protection**: Decentralized system meant no safety net
- **Design Failure**: Algorithmic mechanism was the vulnerability

---

## **Slide 7: Question 3 - Who Bears the Losses: Reserve Primary Fund**
**Content:**
- **Loss Distribution**:
  - All shareholders affected, but unequally
  - Early redeemers: Got out at $1.00 (no loss)
  - Late redeemers: Received $0.97 (3% loss)
  - Total losses: ~$785 million
- **Why System Couldn't Protect**:
  - Lehman Brothers commercial paper defaulted
  - No insurance or guarantee fund (unlike FDIC for banks)
  - First-come-first-served created run dynamics
  - Regulatory oversight existed but couldn't prevent the run

**Visual Elements:**
- Timeline showing redemption sequence
- Loss distribution comparison chart

**Key Points to Explain:**
- **First-Mover Advantage**: Early redeemers avoided losses
- **Information Asymmetry**: Those who acted quickly benefited
- **Regulatory Gap**: SEC oversight but no guarantee fund
- **Systemic Risk**: Triggered broader MMF industry concerns

---

## **Slide 8: Comparative Analysis - Design Differences**
**Content:**
- **Institutional Design**:
  - Terra-Luna: Decentralized, algorithmic, unregulated
  - Reserve Primary: Centralized, regulated, SEC oversight
- **Backing Mechanism**:
  - Terra-Luna: Algorithmic (LUNA token) - circular dependency
  - Reserve Primary: Commercial paper, debt securities - credit risk
- **Loss Distribution**:
  - Terra-Luna: Proportional, transparent, no first-mover advantage
  - Reserve Primary: Sequential, first-come-first-served advantage
- **Speed of Collapse**:
  - Terra-Luna: Days (May 9-11, 2022)
  - Reserve Primary: Hours (September 15-16, 2008)

**Visual Elements:**
- **Use**: `visualizations/comparative/q3_comparative_analysis.png`
- Comparison table highlighting key differences

**Key Points to Explain:**
- **Design Matters**: Different institutional structures led to different loss patterns
- **Transparency Trade-off**: Blockchain transparency (Terra) vs. information asymmetry (Reserve Primary)
- **Regulation Impact**: Regulation didn't prevent Reserve Primary run, but absence of regulation in Terra meant no intervention possible
- **Common Vulnerability**: Both lacked adequate safeguards during extreme stress

---

## **Slide 9: Section B - Policy Recommendation**
**Content:**
- **Proposed Design Change**: Hybrid Reserve-Backed Algorithmic Stablecoin
  - Maintain algorithmic mechanism for normal operations
  - Add reserve fund (e.g., 20-30% of market cap) in liquid assets (USDC, USDT, Treasury bills)
  - Implement circuit breakers: automatic trading halt if depeg >5% for >1 hour
  - Mandatory insurance fund: 2-5% of market cap
- **How It Prevents Failure**:
  - Reserve fund provides buffer during stress
  - Circuit breakers prevent death spiral
  - Insurance fund protects against catastrophic losses
  - Maintains algorithmic efficiency during normal times
- **Trade-offs**:
  - **Cost**: Reserve fund requires capital allocation (opportunity cost)
  - **Complexity**: More complex than pure algorithmic design
  - **Centralization Risk**: Reserve management requires trusted custodian
  - **Regulatory Compliance**: May require regulatory oversight

**Visual Elements:**
- Diagram showing proposed architecture
- Comparison: Current design vs. Proposed design

**Key Points to Explain:**
- **Addresses Specific Failure**: Reserve fund prevents death spiral by providing liquidity buffer
- **Circuit Breakers**: Give time for mechanism to restore peg before collapse
- **Insurance Fund**: Protects against residual losses
- **Balanced Approach**: Maintains algorithmic benefits while adding safety
- **Trade-offs Acknowledged**: No perfect solution, but reduces risk significantly

---

## **Slide 10: Conclusions & Key Takeaways**
**Content:**
- **Key Findings**:
  1. **Onset**: Both crises showed similar patterns - loss of confidence triggers self-reinforcing runs
  2. **Propagation**: Different mechanisms (algorithmic vs. sequential) but similar outcomes
  3. **Loss Distribution**: Design differences matter - transparency vs. first-mover advantage
  4. **System Failures**: Both lacked adequate safeguards during extreme stress
- **Policy Implications**:
  - Stablecoins need safeguards similar to traditional financial instruments
  - Algorithmic mechanisms alone are insufficient during stress
  - Hybrid approaches may offer better protection
- **Future Research**:
  - Real-time monitoring systems
  - Dynamic reserve requirements
  - Cross-crisis learning

**Visual Elements:**
- Summary infographic
- Key statistics comparison

**Key Points to Explain:**
- **Unified Framework**: Both crises follow similar economic dynamics despite different settings
- **Design Matters**: Institutional structure shapes outcomes and loss distribution
- **Prevention Possible**: With proper safeguards, severity can be reduced
- **Ongoing Challenge**: Financial stability requires continuous adaptation

---

## **References Slide (Not Counted in 10)**
**Content:**
- Gorton, G. (1988). Banking Panics and Business Cycles.
- Anadu, K., et al. (2025). Runs and Flights to Safety: Are Stablecoins the New Money Market Funds?
- Liu, J., Makarov, I., & Schoar, A. (2023). Anatomy of a Run: The Terra Luna Crash.
- Gorton, G., & Metrick, A. (2010). Regulating the Shadow Banking System.
- Data sources: ERC20-stablecoins.zip, gfc.zip

---

## **Presentation Tips**

### **Timing (10 minutes total)**:
- Slide 1: 30 seconds
- Slide 2: 1 minute
- Slides 3-5 (Q1): 3 minutes
- Slides 6-8 (Q3): 3 minutes
- Slide 9 (Policy): 2 minutes
- Slide 10 (Conclusions): 30 seconds
- Q&A buffer: 30 seconds

### **Key Messages to Emphasize**:
1. **Similar Dynamics**: Despite different settings, both crises show similar run patterns
2. **Design Matters**: Institutional structure determines loss distribution
3. **Prevention Possible**: Proper safeguards can reduce severity
4. **Data-Driven**: All conclusions supported by quantitative analysis

### **Visualization Usage**:
- Use visualizations to support key points, don't just show them
- Explain what each chart reveals
- Connect visualizations to economic reasoning
- Highlight comparative elements

### **Delivery Tips**:
- Start with the problem (why this matters)
- Build narrative: Onset → Propagation → Losses → Solution
- Use data to support every claim
- End with actionable policy recommendation
- Be ready to discuss trade-offs in detail

---

## **Backup Slides (If Time Permits)**
- Detailed methodology
- Additional transaction flow analysis
- Sensitivity analysis of policy recommendation
- Historical context of both crises
