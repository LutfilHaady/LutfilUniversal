"""
Navigation tools for Buyamia Credit Platform AI Assistant

Provides tools for the agent to help users navigate the website
and understand page structure.
"""

import logging
from typing import Literal

from livekit.agents import function_tool, RunContext

logger = logging.getLogger("buyamia-credit-agent")

# Website structure map (matches lib/navigation.ts)
WEBSITE_STRUCTURE = {
    "/": {
        "name": "Home",
        "description": "Landing page with registration options and platform overview",
        "roles": ["BUYER", "SUPPLIER"],
        "features": ["Registration options", "Platform introduction", "Login access"],
    },
    "/login": {
        "name": "Login",
        "description": "User authentication page to access the platform",
        "roles": ["BUYER", "SUPPLIER"],
        "features": ["User ID login", "Phone number verification", "Session management"],
    },
    "/register": {
        "name": "Registration",
        "description": "Create a new account as a buyer or supplier",
        "roles": ["BUYER", "SUPPLIER"],
        "features": ["Buyer registration", "Supplier registration", "Profile setup"],
    },
    "/dashboard": {
        "name": "Dashboard",
        "description": "Overview of your credit score, reliability metrics, and recent activity",
        "roles": ["BUYER", "SUPPLIER"],
        "features": ["Credit score display", "Reliability metrics", "Recent invoices", "Ongoing orders", "Score history"],
    },
    "/invoices": {
        "name": "Invoices",
        "description": "View and manage all your invoices",
        "roles": ["BUYER", "SUPPLIER"],
        "features": ["Invoice list", "Create new invoice", "Filter and search", "Invoice status tracking"],
    },
    "/invoices/new": {
        "name": "New Invoice",
        "description": "Create a new invoice",
        "roles": ["BUYER", "SUPPLIER"],
        "features": ["Invoice creation form", "Buyer selection", "Amount and due date", "Invoice details"],
    },
    "/issues": {
        "name": "Issues",
        "description": "View and manage reported issues",
        "roles": ["BUYER", "SUPPLIER"],
        "features": ["Issue list", "Report new issue", "Issue status tracking", "Issue resolution"],
    },
    "/issues/new": {
        "name": "New Issue",
        "description": "Report a new issue",
        "roles": ["BUYER", "SUPPLIER"],
        "features": ["Issue reporting form", "Issue type selection", "Description and details", "Attachments"],
    },
    "/search": {
        "name": "Search",
        "description": "Search for buyers or suppliers",
        "roles": ["BUYER", "SUPPLIER"],
        "features": ["Buyer search", "Supplier search", "Credit score filtering", "Category filtering", "Weather-aware search"],
    },
    "/buyer-registry": {
        "name": "Buyer Registry",
        "description": "View and manage registered buyers (Supplier only)",
        "roles": ["SUPPLIER"],
        "features": ["Buyer list", "Credit score viewing", "Payment history", "Buyer details"],
    },
    "/risk-monitor": {
        "name": "Risk Monitor",
        "description": "Monitor weather-related risks and supplier status",
        "roles": ["BUYER", "SUPPLIER"],
        "features": ["Weather impact monitoring", "Risk assessment", "Supplier status", "Regional alerts"],
    },
    "/collections": {
        "name": "Collections",
        "description": "Manage collection attempts and payment reminders (Supplier only)",
        "roles": ["SUPPLIER"],
        "features": ["Collection history", "Collection statistics", "Automated reminders", "Collection status tracking"],
    },
    "/profile": {
        "name": "Profile",
        "description": "View and edit your profile information",
        "roles": ["BUYER", "SUPPLIER"],
        "features": ["Profile information", "Business details", "Contact information", "Account settings"],
    },
}


@function_tool
async def get_page_info(
    context: RunContext,
    page_path: str,
    user_type: str = "SUPPLIER",
) -> str:
    """Get information about a specific page on the website.
    
    Args:
        page_path: The path of the page (e.g., '/dashboard', '/invoices')
        user_type: The user type ('BUYER' or 'SUPPLIER') to check access
    """
    try:
        # Handle dynamic routes
        if page_path.startswith("/issues/") and page_path != "/issues/new":
            page_path = "/issues/[id]"
        
        page_info = WEBSITE_STRUCTURE.get(page_path)
        if not page_info:
            return f"Page '{page_path}' not found in the website structure."
        
        # Check role-based access
        if user_type.upper() not in page_info["roles"]:
            return f"Page '{page_path}' ({page_info['name']}) is not accessible to {user_type} users."
        
        features_str = ", ".join(page_info["features"])
        return (
            f"Page: {page_info['name']} ({page_path})\n"
            f"Description: {page_info['description']}\n"
            f"Available features: {features_str}\n"
            f"Accessible to: {', '.join(page_info['roles'])}"
        )
    except Exception as e:
        logger.error(f"Error getting page info: {e}")
        return f"Error retrieving page information: {str(e)}"


@function_tool
async def suggest_navigation(
    context: RunContext,
    intent: str,
    user_type: str = "SUPPLIER",
) -> str:
    """Suggest which page the user should navigate to based on their intent.
    
    Args:
        intent: What the user wants to do (e.g., 'view invoices', 'check credit score')
        user_type: The user type ('BUYER' or 'SUPPLIER')
    """
    try:
        intent_lower = intent.lower()
        suggestions = []
        
        # Invoice-related
        if "invoice" in intent_lower or "bill" in intent_lower or "payment" in intent_lower:
            if "/invoices" in WEBSITE_STRUCTURE:
                suggestions.append(("/invoices", WEBSITE_STRUCTURE["/invoices"]))
            if "create" in intent_lower or "new" in intent_lower:
                if "/invoices/new" in WEBSITE_STRUCTURE:
                    suggestions.append(("/invoices/new", WEBSITE_STRUCTURE["/invoices/new"]))
        
        # Issue-related
        if "issue" in intent_lower or "problem" in intent_lower or "complaint" in intent_lower:
            if "/issues" in WEBSITE_STRUCTURE:
                suggestions.append(("/issues", WEBSITE_STRUCTURE["/issues"]))
            if "report" in intent_lower or "new" in intent_lower:
                if "/issues/new" in WEBSITE_STRUCTURE:
                    suggestions.append(("/issues/new", WEBSITE_STRUCTURE["/issues/new"]))
        
        # Dashboard/overview
        if any(word in intent_lower for word in ["dashboard", "overview", "home", "summary", "credit score", "reliability"]):
            if "/dashboard" in WEBSITE_STRUCTURE:
                suggestions.append(("/dashboard", WEBSITE_STRUCTURE["/dashboard"]))
        
        # Search
        if any(word in intent_lower for word in ["search", "find", "look for", "buyer", "supplier"]):
            if "/search" in WEBSITE_STRUCTURE:
                suggestions.append(("/search", WEBSITE_STRUCTURE["/search"]))
        
        # Profile
        if any(word in intent_lower for word in ["profile", "account", "settings", "information"]):
            if "/profile" in WEBSITE_STRUCTURE:
                suggestions.append(("/profile", WEBSITE_STRUCTURE["/profile"]))
        
        # Risk monitoring
        if any(word in intent_lower for word in ["risk", "weather", "monitor"]):
            if "/risk-monitor" in WEBSITE_STRUCTURE:
                suggestions.append(("/risk-monitor", WEBSITE_STRUCTURE["/risk-monitor"]))
        
        # Collections (Supplier only)
        if user_type.upper() == "SUPPLIER" and any(word in intent_lower for word in ["collection", "reminder", "payment reminder"]):
            if "/collections" in WEBSITE_STRUCTURE:
                suggestions.append(("/collections", WEBSITE_STRUCTURE["/collections"]))
        
        # Buyer Registry (Supplier only)
        if user_type.upper() == "SUPPLIER" and any(word in intent_lower for word in ["buyer registry", "buyer list", "registered buyers"]):
            if "/buyer-registry" in WEBSITE_STRUCTURE:
                suggestions.append(("/buyer-registry", WEBSITE_STRUCTURE["/buyer-registry"]))
        
        if not suggestions:
            return f"Could not find a specific page for '{intent}'. Available pages: Dashboard, Invoices, Issues, Search, Profile, Risk Monitor."
        
        # Filter by user type access
        filtered_suggestions = [
            (path, info) for path, info in suggestions
            if user_type.upper() in info["roles"]
        ]
        
        if not filtered_suggestions:
            return f"No accessible pages found for '{intent}' for {user_type} users."
        
        # Format suggestions
        result = f"Based on '{intent}', I suggest:\n\n"
        for path, info in filtered_suggestions[:3]:  # Limit to top 3
            result += f"- {info['name']} ({path}): {info['description']}\n"
        
        return result.strip()
    except Exception as e:
        logger.error(f"Error suggesting navigation: {e}")
        return f"Error suggesting navigation: {str(e)}"


@function_tool
async def navigate_to_page(
    context: RunContext,
    page_path: str,
    user_type: str = "SUPPLIER",
) -> str:
    """Offer to navigate the user to a specific page.
    
    This tool should be used when the user explicitly wants to go to a page
    or when suggesting navigation. The agent should offer navigation and
    include a navigation action in the response.
    
    Args:
        page_path: The path to navigate to (e.g., '/dashboard', '/invoices')
        user_type: The user type ('BUYER' or 'SUPPLIER') to verify access
    """
    try:
        # Handle dynamic routes
        check_path = page_path
        if page_path.startswith("/issues/") and page_path != "/issues/new":
            check_path = "/issues/[id]"
        
        page_info = WEBSITE_STRUCTURE.get(check_path)
        if not page_info:
            return f"Page '{page_path}' not found. Available pages: /dashboard, /invoices, /issues, /search, /profile, /risk-monitor"
        
        # Check role-based access
        if user_type.upper() not in page_info["roles"]:
            return f"Page '{page_path}' ({page_info['name']}) is not accessible to {user_type} users."
        
        # Return navigation suggestion with action
        return (
            f"I can take you to the {page_info['name']} page. "
            f"{page_info['description']}. "
            f"Would you like me to navigate there?"
        )
    except Exception as e:
        logger.error(f"Error navigating to page: {e}")
        return f"Error navigating to page: {str(e)}"


@function_tool
async def get_current_page_context(
    context: RunContext,
    current_page: str,
    user_type: str = "SUPPLIER",
) -> str:
    """Get contextual information about the page the user is currently on.
    
    Args:
        current_page: The current page path (e.g., '/dashboard')
        user_type: The user type ('BUYER' or 'SUPPLIER')
    """
    try:
        # Handle dynamic routes
        check_path = current_page
        if current_page.startswith("/issues/") and current_page != "/issues/new":
            check_path = "/issues/[id]"
        
        page_info = WEBSITE_STRUCTURE.get(check_path)
        if not page_info:
            return f"You are currently on page: {current_page}. This page is not in my knowledge base."
        
        features_str = ", ".join(page_info["features"])
        return (
            f"You are currently on the {page_info['name']} page. "
            f"{page_info['description']}. "
            f"On this page, you can: {features_str}. "
            f"How can I help you with this page?"
        )
    except Exception as e:
        logger.error(f"Error getting current page context: {e}")
        return f"Error getting page context: {str(e)}"



