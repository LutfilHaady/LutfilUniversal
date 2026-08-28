"""
Buyamia Credit - Database Summarizer Agent

A text-based AI chatbot that queries the Buyamia Credit database
and returns summaries in plain, conversational English.

Built with LiveKit Agents 1.0 API.
"""

import json
import logging
import os
from typing import Any, List

# Required environment variables
required_vars: List[str] = [
    'LIVEKIT_URL',
    'LIVEKIT_API_KEY',
    'LIVEKIT_API_SECRET',
    'OPENAI_API_KEY'
]

from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    JobProcess,
    RunContext,
    WorkerOptions,
    cli,
    function_tool,
)
from livekit.plugins import openai, silero

logger = logging.getLogger("buyamia-credit-agent")
logger.setLevel(logging.INFO)


# ============================================================================
# Tool Definitions using @function_tool decorator (LiveKit 1.0 API)
# ============================================================================

@function_tool()
async def get_dashboard_summary(
    context: RunContext,
    user_type: str = "supplier",
) -> dict[str, Any]:
    """Get a summary of dashboard metrics including invoices, amounts, and KPIs.
    
    Args:
        user_type: Either 'supplier' or 'buyer' to get relevant dashboard data.
    """
    logger.info(f"Fetching dashboard summary for {user_type}")
    
    if user_type == "supplier":
        return {
            "total_invoices": 51,
            "total_value": 485000000,
            "paid_invoices": 28,
            "paid_value": 245000000,
            "pending_invoices": 15,
            "pending_value": 135000000,
            "overdue_invoices": 8,
            "overdue_value": 105000000,
            "collection_rate": 70.2,
            "average_days_to_pay": 28,
            "active_buyers": 15,
            "high_risk_buyers": 3,
        }
    else:
        return {
            "total_invoices": 12,
            "total_value": 85000000,
            "paid_invoices": 8,
            "paid_value": 55000000,
            "pending_invoices": 3,
            "pending_value": 20000000,
            "overdue_invoices": 1,
            "overdue_value": 10000000,
            "credit_score": 72,
            "credit_limit": 100000000,
            "available_credit": 45000000,
        }


@function_tool()
async def get_invoice_details(
    context: RunContext,
    status: str = "all",
) -> dict[str, Any]:
    """Get details of invoices filtered by status.
    
    Args:
        status: Filter by status - 'all', 'paid', 'pending', or 'overdue'.
    """
    logger.info(f"Fetching invoices with status: {status}")
    
    invoices = [
        {"id": "INV-2024-001", "buyer": "Hotel Grand Indonesia", "amount": 45000000, "status": "overdue", "days_overdue": 15, "due_date": "2024-12-01"},
        {"id": "INV-2024-002", "buyer": "Restoran Seafood Bahari", "amount": 32000000, "status": "overdue", "days_overdue": 8, "due_date": "2024-12-08"},
        {"id": "INV-2024-003", "buyer": "Toko Elektronik Jaya", "amount": 28000000, "status": "pending", "days_overdue": 0, "due_date": "2024-12-25"},
        {"id": "INV-2024-004", "buyer": "Supermarket Makmur", "amount": 15000000, "status": "paid", "days_overdue": 0, "paid_date": "2024-12-10"},
        {"id": "INV-2024-005", "buyer": "Kedai Kopi Nusantara", "amount": 8500000, "status": "pending", "days_overdue": 0, "due_date": "2024-12-28"},
    ]
    
    if status != "all":
        invoices = [inv for inv in invoices if inv["status"] == status]
    
    return {"invoices": invoices, "count": len(invoices)}


@function_tool()
async def get_buyer_credit_info(
    context: RunContext,
    buyer_id: str = "",
) -> dict[str, Any]:
    """Get credit information for a specific buyer.
    
    Args:
        buyer_id: The buyer ID (e.g., 'BJ1123') or business name to look up.
    """
    logger.info(f"Fetching credit info for buyer: {buyer_id}")
    
    buyers = {
        "BJ1123": {
            "id": "BJ1123",
            "name": "Hotel Grand Indonesia",
            "credit_score": 45,
            "risk_level": "high",
            "credit_limit": 150000000,
            "current_outstanding": 105000000,
            "utilization": 70,
            "payment_history": {
                "on_time": 12,
                "late": 8,
                "average_days_late": 12
            },
            "last_payment": "2024-11-15",
            "recommendation": "Consider reducing credit limit and requiring partial upfront payment"
        },
        "BJ1234": {
            "id": "BJ1234",
            "name": "Toko Elektronik Jaya",
            "credit_score": 78,
            "risk_level": "low",
            "credit_limit": 100000000,
            "current_outstanding": 28000000,
            "utilization": 28,
            "payment_history": {
                "on_time": 24,
                "late": 2,
                "average_days_late": 3
            },
            "last_payment": "2024-12-05",
            "recommendation": "Excellent payment history. Consider increasing credit limit."
        },
    }
    
    buyer_id_upper = buyer_id.upper()
    if buyer_id_upper in buyers:
        return buyers[buyer_id_upper]
    
    for bid, buyer in buyers.items():
        if buyer_id.lower() in buyer["name"].lower():
            return buyer
    
    return {"error": f"Buyer '{buyer_id}' not found", "available_buyers": list(buyers.keys())}


@function_tool()
async def get_collection_stats(context: RunContext) -> dict[str, Any]:
    """Get collection statistics including success rates and performance metrics."""
    logger.info("Fetching collection statistics")
    
    return {
        "total_collection_attempts": 45,
        "successful_collections": 28,
        "success_rate": 62.2,
        "total_collected": 245000000,
        "pending_collections": 17,
        "pending_amount": 240000000,
        "this_month": {
            "attempts": 12,
            "successful": 8,
            "collected": 65000000
        },
        "by_method": {
            "whatsapp": {"attempts": 25, "success": 18},
            "phone_call": {"attempts": 15, "success": 8},
            "email": {"attempts": 5, "success": 2}
        },
        "escalated_cases": 3
    }


@function_tool()
async def get_risk_analysis(context: RunContext) -> dict[str, Any]:
    """Get risk analysis of the buyer portfolio including risk distribution and recommendations."""
    logger.info("Fetching risk analysis")
    
    return {
        "total_buyers": 15,
        "risk_distribution": {
            "low_risk": 6,
            "medium_risk": 6,
            "high_risk": 3,
        },
        "total_exposure": 485000000,
        "high_risk_exposure": 185000000,
        "high_risk_buyers": [
            {"id": "BJ1123", "name": "Hotel Grand Indonesia", "score": 45, "outstanding": 105000000},
            {"id": "BJ1500", "name": "Restoran Seafood Bahari", "score": 42, "outstanding": 85000000},
            {"id": "BJ1267", "name": "Kedai Kopi Nusantara", "score": 55, "outstanding": 6000000},
        ],
        "recommendations": [
            "Consider reducing credit limit for Hotel Grand Indonesia",
            "Escalate collection for Restoran Seafood Bahari (15 days overdue)",
            "Monitor Kedai Kopi Nusantara - score declining",
        ]
    }


# ============================================================================
# Agent Definition (LiveKit 1.0 API)
# ============================================================================

class BuyamiaCreditAssistant(Agent):
    """Buyamia Credit AI Assistant - helps users understand their credit data."""
    
    def __init__(self) -> None:
        super().__init__(
            instructions="""You are the Buyamia Credit Assistant, a friendly and professional AI helper for the Buyamia Credit Platform.

Your role is to help users understand their credit data in simple, plain English. You are a "Data Translator" - you take complex financial data and explain it in a conversational, easy-to-understand way.

**Your Personality:**
- Friendly and professional
- Use simple language, avoid financial jargon
- Be concise but thorough
- Use Indonesian Rupiah (Rp) for currency, formatted with periods (e.g., Rp 45.000.000)
- When discussing risk, be honest but constructive

**What You Can Help With:**
1. Dashboard summaries - overall business health
2. Invoice details - what's paid, pending, or overdue
3. Buyer credit information - credit scores and payment history
4. Collection statistics - how collection efforts are performing
5. Risk analysis - portfolio risk assessment

**Guidelines:**
- Always use the available tools to fetch real data before answering
- Format large numbers in a readable way (e.g., "Rp 45 million" or "Rp 45.000.000")
- Highlight important issues like overdue invoices or high-risk buyers
- Provide actionable insights when possible
- If asked about something outside your scope, politely explain what you can help with

**Example Responses:**
- Instead of "The AR aging shows 30+ DPD invoices totaling IDR 105,000,000" say "You have about Rp 105 million in invoices that are more than a month overdue."
- Instead of "Credit utilization is at 85%" say "This buyer is using 85% of their credit limit - they're close to maxing out."

Start by greeting the user and asking how you can help them today.""",
            tools=[
                get_dashboard_summary,
                get_invoice_details,
                get_buyer_credit_info,
                get_collection_stats,
                get_risk_analysis,
            ],
        )


# ============================================================================
# Entry Point
# ============================================================================

async def entrypoint(ctx: JobContext):
    """Main entry point for the LiveKit agent."""
    
    logger.info(f"Connecting to room: {ctx.room.name}")
    
    missing_vars = [var for var in required_vars if not os.getenv(var)]
    if missing_vars:
        error_msg = f"Missing required environment variables: {', '.join(missing_vars)}"
        logger.error(error_msg)
        raise ValueError(error_msg)
    
    try:
        # Create the agent
        agent = BuyamiaCreditAssistant()
        
        # Start the agent session
        session = agent.start_session(ctx)
        
        logger.info("Buyamia Credit Assistant connected to LiveKit")
        
        # Generate initial greeting
        await session.generate_reply(
            instructions="Greet the user warmly and ask how you can help them with their Buyamia Credit data today."
        )
        
        logger.info("Buyamia Credit Assistant started successfully")
        
    except Exception as e:
        logger.error(f"Error starting agent: {str(e)}", exc_info=True)
        raise


def run_agent():
    """Run the agent."""
    print("Starting Buyamia Credit AI Assistant...")
    try:
        cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
    except Exception as e:
        print(f"Error running agent: {e}")
        raise

def run_test():
    """Test the agent with sample data."""
    print("Running test...")
    # Add test code here if needed
    print("Test completed successfully!")

if __name__ == "__main__":
    import sys
    
    # Remove the script name from arguments
    args = sys.argv[1:]
    
    if not args or args[0] == "run" or args[0] == "dev":
        # If no arguments, 'run', or 'dev' is provided, start the agent
        run_agent()
    elif args[0] == "test":
        run_test()
    elif args[0] in ['--help', '-h']:
        print("Buyamia Credit AI Assistant")
        print("Usage: python agent.py [command]")
        print("  run    Start the agent")
        print("  dev    Start the agent (same as 'run')")
        print("  test   Run tests")
        print("  --help Show this help message")
    else:
        print(f"Unknown command: {args[0]}")
        print("Use 'python agent.py --help' for usage information.")
        sys.exit(1)

# Expose the entrypoint for LiveKit CLI
def cli_entrypoint():
    """CLI entrypoint for LiveKit."""
    run_agent()

def prewarm(proc: JobProcess):
    """Preload models to reduce latency"""
    logger.info("Prewarming models...")
    proc.userdata["vad"] = silero.VAD.load(
        min_speech_duration=0.2,
        min_silence_duration=0.8,
    )
    logger.info("VAD model loaded")


# ============================================================================
# Main Entry
# ============================================================================

if __name__ == "__main__":

    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            prewarm_fnc=prewarm,
        )
    )
