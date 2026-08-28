"""
Backend tools for the LiveKit procurement copilot agent.
These tools provide direct database access for inventory and procurement operations.
"""

import asyncio
import json
import logging
import os
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Optional

from livekit.agents import RunContext, ToolError, function_tool
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from models import (
    InventoryItemCategory,
    InventoryMasterItem,
    InventoryStockLevel,
    InventoryStorageLocation,
    InventoryTrackedItem,
    InventoryTransactionDetail,
    InventoryTransactionHeader,
    ProcurementOffering,
    ProcurementPurchaseOrder,
    ProcurementPurchaseOrderItem,
    ProcurementSolution,
    PropertyProperty,
    Seller,
    SrmSupplierRelationship,
)
from sqlalchemy import func

logger = logging.getLogger("procurement-agent")

# Database connection
DATABASE_URL = "postgresql://postgres:PremiumB2BM4rk3tplac3!!!@postgres16-rw.dlt.buyamia.com:5432/buyamia_dlt_dev"

if DATABASE_URL:
    db_engine = create_engine(
        DATABASE_URL,
        pool_size=10,
        max_overflow=20,
        pool_recycle=300,
        pool_pre_ping=True,
        pool_use_lifo=True,
        connect_args={
            "keepalives": 1,
            "keepalives_idle": 30,
            "keepalives_interval": 10,
            "keepalives_count": 5,
            "connect_timeout": 10,  # Connection timeout
            "options": "-c statement_timeout=15000",  # 15 second query timeout
        },
    )
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)
else:
    logger.warning("BUYAMIA_DATABASE_URI not set - backend tools will not work")
    db_engine = None
    SessionLocal = None



def to_serializable(obj):
    """Convert any object to JSON-serializable format."""
    if isinstance(obj, dict):
        return {k: to_serializable(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [to_serializable(item) for item in obj]
    elif hasattr(obj, "hex"):  # UUID objects
        return str(obj)
    elif hasattr(obj, "isoformat"):  # datetime objects
        return obj.isoformat()
    else:
        return obj


@function_tool
async def find_inventory_items(
    organization_id: str,
    property_id: Optional[str] = None,
    limit: int = 100,
    context: RunContext = None,
) -> str:
    """
    Get ALL inventory items for an organization. Returns all items so the LLM can do semantic
    matching for queries like "carrots"/"wortel", "chicken"/"ayam", handling typos, language
    variations, and synonyms intelligently.

    Use this to answer questions like:
    - "Do we have carrots in inventory?" (LLM will match "carrots" semantically)
    - "What items do we have?" (returns full list)
    - "Find lettuce" (LLM will match "lettuce" with inventory items)

    Args:
        organization_id: Organization UUID to scope the search (REQUIRED)
        property_id: Property UUID to filter by (optional)
        limit: Max number of results (default: 100, max: 200)

    Returns:
        JSON string with list of ALL items. LLM does the semantic matching.
    """
    if not SessionLocal:
        raise ToolError("Database connection not configured")

    # Cap limit for safety
    if limit > 200:
        limit = 200

    session = SessionLocal()
    try:
        q = session.query(InventoryMasterItem).filter(
            InventoryMasterItem.organization_id == organization_id,
            InventoryMasterItem.deleted_at.is_(None),
        )

        if property_id:
            q = q.filter(InventoryMasterItem.property_id == property_id)

        q = q.limit(limit)
        items = q.all()

        results = []
        for item in items:
            tracked = session.query(InventoryTrackedItem).filter(
                InventoryTrackedItem.master_item_id == item.id,
                InventoryTrackedItem.deleted_at.is_(None),
            )
            if property_id:
                tracked = tracked.filter(InventoryTrackedItem.property_id == property_id)
            tracked = tracked.first()

            results.append(
                {
                    "master_item_id": str(item.id),
                    "name": item.name,
                    "category_id": str(item.item_category_id)
                    if item.item_category_id
                    else None,
                    "unit": item.unit_of_measure,
                    "brand": item.brand,
                    "description": item.description,
                    "is_perishable": item.is_perishable,
                    "tracked_item_id": str(tracked.id) if tracked else None,
                }
            )

        return json.dumps({"success": True, "data": results})
    except Exception as e:
        logger.error(f"Error in find_inventory_items: {e}")
        return json.dumps({"success": False, "error": str(e)})
    finally:
        session.close()


@function_tool
async def get_stock_levels(
    organization_id: str,
    item_id: Optional[str] = None,
    tracked_item_id: Optional[str] = None,
    property_id: Optional[str] = None,
    context: RunContext = None,
) -> str:
    """
    Get current stock levels for an item, optionally filtered by property/location.
    Can also return all stock levels for an organization if no item filters are provided.

    Args:
        organization_id: Organization UUID to scope the search (REQUIRED)
        item_id: InventoryMasterItem UUID (optional - only use if you need a specific item)
        tracked_item_id: InventoryTrackedItem UUID (optional - only use if you need a specific tracked item)
        property_id: Property UUID to filter by (optional - use to scope to a specific property)

    Returns:
        JSON string with list of stock levels including quantity_on_hand, min_stock_level, par_level, max_stock_level, item_name, property_name
    """
    if not SessionLocal:
        raise ToolError("Database connection not configured")

    session = SessionLocal()
    try:
        # Get tracked_item_id if only item_id was provided
        if not tracked_item_id and item_id:
            tracked = (
                session.query(InventoryTrackedItem)
                .join(
                    InventoryMasterItem,
                    InventoryTrackedItem.master_item_id == InventoryMasterItem.id,
                )
                .filter(
                    InventoryTrackedItem.master_item_id == item_id,
                    InventoryMasterItem.organization_id == organization_id,
                    InventoryTrackedItem.deleted_at.is_(None),
                )
            )
            if property_id:
                tracked = tracked.filter(InventoryTrackedItem.property_id == property_id)
            tracked = tracked.first()
            if not tracked:
                return json.dumps({"success": True, "data": []})
            tracked_item_id = tracked.id

        # Query stock levels with joins
        q = (
            session.query(
                InventoryStockLevel,
                InventoryStorageLocation,
                InventoryTrackedItem,
                PropertyProperty,
                InventoryMasterItem,
            )
            .join(
                InventoryTrackedItem,
                InventoryStockLevel.tracked_item_id == InventoryTrackedItem.id,
            )
            .join(
                InventoryMasterItem,
                InventoryTrackedItem.master_item_id == InventoryMasterItem.id,
            )
            .outerjoin(
                InventoryStorageLocation,
                InventoryStockLevel.storage_location_id == InventoryStorageLocation.id,
            )
            .outerjoin(
                PropertyProperty,
                (InventoryTrackedItem.property_id == PropertyProperty.id)
                & (PropertyProperty.organization_id == organization_id),
            )
            .filter(
                InventoryMasterItem.organization_id == organization_id,
                InventoryStockLevel.deleted_at.is_(None),
            )
        )

        if tracked_item_id:
            q = q.filter(InventoryStockLevel.tracked_item_id == tracked_item_id)

        if property_id:
            q = q.filter(InventoryTrackedItem.property_id == property_id)

        results = []
        for stock, location, tracked, prop, master_item in q.all():
            results.append(
                {
                    "stock_level_id": str(stock.id),
                    "tracked_item_id": str(tracked.id) if tracked else None,
                    "item_id": str(master_item.id) if master_item else None,
                    "item_name": master_item.name if master_item else None,
                    "quantity_on_hand": stock.quantity_on_hand,
                    "storage_location_id": str(stock.storage_location_id)
                    if stock.storage_location_id
                    else None,
                    "storage_location": {
                        "id": str(location.id),
                        "name": location.name,
                        "description": location.description,
                    }
                    if location
                    else None,
                    "par_level": tracked.par_level if tracked else None,
                    "min_stock_level": tracked.min_stock_level if tracked else None,
                    "max_stock_level": tracked.max_stock_level if tracked else None,
                    "property_id": str(tracked.property_id)
                    if tracked and tracked.property_id
                    else None,
                    "property_name": prop.name if prop else None,
                }
            )

        return json.dumps({"success": True, "data": results})
    except Exception as e:
        logger.error(f"Error in get_stock_levels: {e}")
        return json.dumps({"success": False, "error": str(e)})
    finally:
        session.close()


@function_tool
async def get_critical_stock_items(
    organization_id: str,
    property_id: Optional[str] = None,
    include_low_stock: bool = False,
    context: RunContext = None,
) -> str:
    """
    Get all items with critical or low stock levels. Critical items are those where quantity_on_hand <= min_stock_level.
    Low stock items are those where quantity_on_hand <= par_level but > min_stock_level.

    Args:
        organization_id: Organization UUID to scope the search (REQUIRED)
        property_id: Property UUID to filter by (optional - if not provided, returns items across all properties)
        include_low_stock: If True, also includes items that are low stock (quantity <= par_level but > min_stock_level). Default: False (only critical items)

    Returns:
        JSON string with list of critical/low stock items including item_name, quantity_on_hand, min_stock_level, par_level, property_name, and stock_status
    """
    if not SessionLocal:
        raise ToolError("Database connection not configured")

    session = SessionLocal()
    try:
        # Query stock levels with joins
        q = (
            session.query(
                InventoryStockLevel,
                InventoryStorageLocation,
                InventoryTrackedItem,
                PropertyProperty,
                InventoryMasterItem,
            )
            .join(
                InventoryTrackedItem,
                InventoryStockLevel.tracked_item_id == InventoryTrackedItem.id,
            )
            .join(
                InventoryMasterItem,
                InventoryTrackedItem.master_item_id == InventoryMasterItem.id,
            )
            .outerjoin(
                InventoryStorageLocation,
                InventoryStockLevel.storage_location_id == InventoryStorageLocation.id,
            )
            .outerjoin(
                PropertyProperty,
                (InventoryTrackedItem.property_id == PropertyProperty.id)
                & (PropertyProperty.organization_id == organization_id),
            )
            .filter(
                InventoryMasterItem.organization_id == organization_id,
                InventoryStockLevel.deleted_at.is_(None),
                InventoryTrackedItem.deleted_at.is_(None),
                InventoryMasterItem.deleted_at.is_(None),
            )
        )

        if property_id:
            q = q.filter(InventoryTrackedItem.property_id == property_id)

        results = []
        for stock, location, tracked, prop, master_item in q.all():
            quantity = stock.quantity_on_hand
            min_level = tracked.min_stock_level if tracked else None
            par_level = tracked.par_level if tracked else None

            # Determine stock status
            is_critical = min_level is not None and quantity <= min_level
            is_low = (
                not is_critical
                and par_level is not None
                and quantity <= par_level
            )

            # Only include if critical, or if include_low_stock is True and it's low stock
            if is_critical or (include_low_stock and is_low):
                status = "CRITICAL" if is_critical else "LOW"
                results.append(
                    {
                        "stock_level_id": str(stock.id),
                        "tracked_item_id": str(tracked.id) if tracked else None,
                        "item_id": str(master_item.id) if master_item else None,
                        "item_name": master_item.name if master_item else None,
                        "quantity_on_hand": float(quantity),
                        "min_stock_level": float(min_level) if min_level else None,
                        "par_level": float(par_level) if par_level else None,
                        "max_stock_level": float(tracked.max_stock_level)
                        if tracked and tracked.max_stock_level
                        else None,
                        "storage_location": {
                            "id": str(location.id),
                            "name": location.name,
                            "description": location.description,
                        }
                        if location
                        else None,
                        "property_id": str(tracked.property_id)
                        if tracked and tracked.property_id
                        else None,
                        "property_name": prop.name if prop else None,
                        "stock_status": status,
                    }
                )

        # Sort by status (CRITICAL first) then by quantity (lowest first)
        results.sort(
            key=lambda x: (
                0 if x["stock_status"] == "CRITICAL" else 1,
                x["quantity_on_hand"],
            )
        )

        return json.dumps({"success": True, "data": results})
    except Exception as e:
        logger.error(f"Error in get_critical_stock_items: {e}")
        return json.dumps({"success": False, "error": str(e)})
    finally:
        session.close()


@function_tool
async def get_consumption_history(
    organization_id: str,
    item_id: Optional[str] = None,
    tracked_item_id: Optional[str] = None,
    property_id: Optional[str] = None,
    days_back: int = 90,
    context: RunContext = None,
) -> str:
    """
    Get historical consumption data for an item.

    Args:
        organization_id: Organization UUID to scope the search (REQUIRED)
        item_id: InventoryMasterItem UUID (optional if tracked_item_id is given)
        tracked_item_id: InventoryTrackedItem UUID (optional if item_id is given)
        property_id: Property UUID to filter by (optional)
        days_back: Number of days to look back (default: 90)

    Returns:
        JSON string with list of daily consumption records
    """
    if not SessionLocal:
        raise ToolError("Database connection not configured")

    session = SessionLocal()
    try:
        if not tracked_item_id and item_id:
            tracked = (
                session.query(InventoryTrackedItem)
                .join(
                    InventoryMasterItem,
                    InventoryTrackedItem.master_item_id == InventoryMasterItem.id,
                )
                .filter(
                    InventoryTrackedItem.master_item_id == item_id,
                    InventoryMasterItem.organization_id == organization_id,
                )
            )
            if property_id:
                tracked = tracked.filter(InventoryTrackedItem.property_id == property_id)
            tracked = tracked.first()
            if not tracked:
                return json.dumps({"success": True, "data": []})
            tracked_item_id = tracked.id

        if not tracked_item_id:
            return json.dumps({"success": True, "data": []})

        cutoff = datetime.utcnow() - timedelta(days=days_back)

        q = session.query(
            InventoryTransactionHeader.transaction_date,
            InventoryTransactionDetail.quantity_change,
        )
        q = q.join(
            InventoryTransactionDetail,
            InventoryTransactionHeader.id == InventoryTransactionDetail.header_id,
        )
        q = q.join(
            InventoryTrackedItem,
            InventoryTransactionDetail.tracked_item_id == InventoryTrackedItem.id,
        )
        q = q.join(
            InventoryMasterItem,
            InventoryTrackedItem.master_item_id == InventoryMasterItem.id,
        )
        q = q.filter(
            InventoryTransactionDetail.tracked_item_id == tracked_item_id,
            InventoryMasterItem.organization_id == organization_id,
            InventoryTransactionHeader.transaction_date >= cutoff,
        )

        if property_id:
            q = q.filter(InventoryTrackedItem.property_id == property_id)

        q = q.order_by(InventoryTransactionHeader.transaction_date)
        data = q.all()

        daily = defaultdict(float)
        for dt, qty in data:
            day = dt.date().isoformat()
            daily[day] += qty

        result = [
            {"date": day, "quantity_change": qty} for day, qty in sorted(daily.items())
        ]
        return json.dumps({"success": True, "data": result})
    except Exception as e:
        logger.error(f"Error in get_consumption_history: {e}")
        return json.dumps({"success": False, "error": str(e)})
    finally:
        session.close()


@function_tool
async def get_open_purchase_orders(
    organization_id: str,
    item_id: Optional[str] = None,
    tracked_item_id: Optional[str] = None,
    property_id: Optional[str] = None,
    context: RunContext = None,
) -> str:
    """
    List open purchase orders for an item.

    Args:
        organization_id: Organization UUID to scope the search (REQUIRED)
        item_id: InventoryMasterItem UUID (optional)
        tracked_item_id: InventoryTrackedItem UUID (optional)
        property_id: Property UUID to filter by (optional)

    Returns:
        JSON string with list of open POs including status, quantity, expected delivery
    """
    if not SessionLocal:
        raise ToolError("Database connection not configured")

    session = SessionLocal()
    try:
        tracked_ids = []
        if tracked_item_id:
            tracked = (
                session.query(InventoryTrackedItem)
                .join(
                    InventoryMasterItem,
                    InventoryTrackedItem.master_item_id == InventoryMasterItem.id,
                )
                .filter(
                    InventoryTrackedItem.id == tracked_item_id,
                    InventoryMasterItem.organization_id == organization_id,
                )
            )
            if property_id:
                tracked = tracked.filter(InventoryTrackedItem.property_id == property_id)
            tracked = tracked.first()
            if tracked:
                tracked_ids = [tracked.id]
        elif item_id:
            tracked = (
                session.query(InventoryTrackedItem)
                .join(
                    InventoryMasterItem,
                    InventoryTrackedItem.master_item_id == InventoryMasterItem.id,
                )
                .filter(
                    InventoryTrackedItem.master_item_id == item_id,
                    InventoryMasterItem.organization_id == organization_id,
                )
            )
            if property_id:
                tracked = tracked.filter(InventoryTrackedItem.property_id == property_id)
            tracked = tracked.all()
            tracked_ids = [t.id for t in tracked]

        if not tracked_ids:
            return json.dumps({"success": True, "data": []})

        po_items = (
            session.query(ProcurementPurchaseOrderItem)
            .filter(ProcurementPurchaseOrderItem.request_item_id.in_(tracked_ids))
            .all()
        )
        po_ids = [item.purchase_order_id for item in po_items]

        if not po_ids:
            return json.dumps({"success": True, "data": []})

        pos = (
            session.query(ProcurementPurchaseOrder)
            .filter(
                ProcurementPurchaseOrder.id.in_(po_ids),
                ProcurementPurchaseOrder.status.in_(["OPEN", "PENDING", "ORDERED"]),
            )
            .all()
        )

        results = []
        for po in pos:
            items = [item for item in po_items if item.purchase_order_id == po.id]
            for item in items:
                results.append(
                    {
                        "po_id": str(po.id),
                        "status": po.status,
                        "quantity_ordered": item.quantity,
                        "expected_delivery": po.expected_delivery_date.isoformat()
                        if po.expected_delivery_date
                        else None,
                        "supplier_id": str(po.seller_id) if po.seller_id else None,
                    }
                )

        return json.dumps({"success": True, "data": results})
    except Exception as e:
        logger.error(f"Error in get_open_purchase_orders: {e}")
        return json.dumps({"success": False, "error": str(e)})
    finally:
        session.close()


@function_tool
async def get_suppliers_for_item(
    organization_id: str,
    item_id: Optional[str] = None,
    tracked_item_id: Optional[str] = None,
    property_id: Optional[str] = None,
    context: RunContext = None,
) -> str:
    """
    List suppliers for an item with relationship status.

    Args:
        organization_id: Organization UUID to scope the search (REQUIRED)
        item_id: InventoryMasterItem UUID (optional)
        tracked_item_id: InventoryTrackedItem UUID (optional)
        property_id: Property UUID to filter by (optional)

    Returns:
        JSON string with list of suppliers including name, status, and preferred flag
    """
    if not SessionLocal:
        raise ToolError("Database connection not configured")

    session = SessionLocal()
    try:
        tracked = None
        if tracked_item_id:
            tracked = (
                session.query(InventoryTrackedItem)
                .join(
                    InventoryMasterItem,
                    InventoryTrackedItem.master_item_id == InventoryMasterItem.id,
                )
                .filter(
                    InventoryTrackedItem.id == tracked_item_id,
                    InventoryMasterItem.organization_id == organization_id,
                )
            )
            if property_id:
                tracked = tracked.filter(InventoryTrackedItem.property_id == property_id)
            tracked = tracked.first()
        elif item_id:
            tracked = (
                session.query(InventoryTrackedItem)
                .join(
                    InventoryMasterItem,
                    InventoryTrackedItem.master_item_id == InventoryMasterItem.id,
                )
                .filter(
                    InventoryTrackedItem.master_item_id == item_id,
                    InventoryMasterItem.organization_id == organization_id,
                )
            )
            if property_id:
                tracked = tracked.filter(InventoryTrackedItem.property_id == property_id)
            tracked = tracked.first()

        if not tracked:
            return json.dumps({"success": True, "data": []})

        preferred_supplier_id = tracked.preferred_supplier_id
        rels = session.query(SrmSupplierRelationship).filter(
            SrmSupplierRelationship.organization_id == organization_id,
            SrmSupplierRelationship.deleted_at.is_(None),
        )

        results = []
        for rel in rels:
            supplier = (
                session.query(Seller).filter(Seller.id == rel.seller_id).first()
            )
            if not supplier:
                continue
            results.append(
                {
                    "supplier_id": str(supplier.id),
                    "supplier_name": supplier.name or str(supplier.id),
                    "relationship_status": rel.status_for_org,
                    "is_preferred": supplier.id == preferred_supplier_id,
                }
            )

        return json.dumps({"success": True, "data": results})
    except Exception as e:
        logger.error(f"Error in get_suppliers_for_item: {e}")
        return json.dumps({"success": False, "error": str(e)})
    finally:
        session.close()


@function_tool
async def get_available_procurement_methods(context: RunContext = None) -> str:
    """
    Get available procurement methods.

    Returns:
        JSON string with list of procurement methods/solutions
    """
    if not SessionLocal:
        raise ToolError("Database connection not configured")

    session = SessionLocal()
    try:
        solutions = (
            session.query(ProcurementSolution)
            .filter(ProcurementSolution.deleted_at.is_(None))
            .all()
        )

        results = []
        for solution in solutions:
            solution_dict = {
                c.name: getattr(solution, c.name)
                for c in solution.__table__.columns
            }
            results.append(to_serializable(solution_dict))

        return json.dumps({"success": True, "data": results})
    except Exception as e:
        logger.error(f"Error in get_available_procurement_methods: {e}")
        return json.dumps({"success": False, "error": str(e)})
    finally:
        session.close()


@function_tool
async def get_available_procurement_offerings(context: RunContext = None) -> str:
    """
    Get available products and services that can be procured.

    Returns:
        JSON string with list of procurement offerings
    """
    if not SessionLocal:
        raise ToolError("Database connection not configured")

    session = SessionLocal()
    try:
        offerings = (
            session.query(ProcurementOffering)
            .filter(ProcurementOffering.deleted_at.is_(None))
            .all()
        )

        results = []
        for offering in offerings:
            offering_dict = {
                c.name: getattr(offering, c.name)
                for c in offering.__table__.columns
            }
            results.append(to_serializable(offering_dict))

        return json.dumps({"success": True, "data": results})
    except Exception as e:
        logger.error(f"Error in get_available_procurement_offerings: {e}")
        return json.dumps({"success": False, "error": str(e)})
    finally:
        session.close()


@function_tool
async def search_suppliers(
    organization_id: str,
    property_id: Optional[str] = None,
    include_items: bool = True,
    limit: int = 50,
    context: RunContext = None,
) -> str:
    """
    Get all suppliers for an organization with the products they supply. Returns ALL suppliers
    so the LLM can do semantic matching for queries like "mango"/"mangga"/"manggo", handling
    typos, language variations, and synonyms intelligently.
    
    Use this to answer questions like:
    - "How many suppliers do I have?"
    - "Do I have a chicken supplier?" (LLM will match "chicken" semantically with supplier items)
    - "Who are my meat suppliers?" (LLM will match "meat"/"daging" with relevant items)
    - "Find mango suppliers" (LLM will match "mango"/"mangga"/"manggo" variations)

    Args:
        organization_id: Organization UUID to scope the search (REQUIRED)
        property_id: Property UUID to filter by (optional - shows suppliers assigned to this property)
        include_items: Whether to include the list of items each supplier provides (default: True)
        limit: Max number of suppliers to return (default: 50, max: 100)

    Returns:
        JSON string with list of ALL suppliers and their supplied items. LLM does the semantic matching.
    """
    if not db_engine:
        raise ToolError("Database connection not configured")

    # Cap limit for safety
    if limit > 100:
        limit = 100

    try:
        # Use a single optimized raw SQL query instead of ORM + autoload
        # This avoids the expensive Table metadata introspection
        if include_items:
            # Build property filter condition based on whether property_id is provided
            if property_id:
                property_filter = "AND (si.property_id = :property_id OR si.property_id IS NULL)"
                params = {"org_id": organization_id, "property_id": property_id, "limit": limit}
            else:
                property_filter = ""
                params = {"org_id": organization_id, "limit": limit}
            
            # Single query that gets suppliers with their items using JSON aggregation
            sql = text(f"""
                WITH supplier_data AS (
                    SELECT 
                        sr.id as relationship_id,
                        sr.status_for_org,
                        s.id as seller_id,
                        s.name as seller_name,
                        s.email,
                        s.primary_phone,
                        s.description,
                        s.status as seller_status
                    FROM srm.supplier_relationships sr
                    JOIN public.sellers s ON sr.seller_id = s.id
                    WHERE sr.organization_id = :org_id
                      AND sr.deleted_at IS NULL
                      AND s.deleted_at IS NULL
                    LIMIT :limit
                )
                SELECT 
                    sd.*,
                    COALESCE(
                        json_agg(
                            json_build_object(
                                'item_id', si.master_item_id::text,
                                'item_name', imi.name,
                                'unit', imi.unit_of_measure,
                                'description', imi.description
                            )
                        ) FILTER (WHERE si.id IS NOT NULL),
                        '[]'::json
                    ) as items
                FROM supplier_data sd
                LEFT JOIN srm.supplier_items si 
                    ON si.seller_id = sd.seller_id 
                    AND si.organization_id = :org_id
                    AND si.deleted_at IS NULL
                    {property_filter}
                LEFT JOIN inventory.master_items imi 
                    ON si.master_item_id = imi.id 
                    AND imi.deleted_at IS NULL
                GROUP BY 
                    sd.relationship_id, sd.status_for_org, sd.seller_id, 
                    sd.seller_name, sd.email, sd.primary_phone, 
                    sd.description, sd.seller_status
            """)
        else:
            # Simple query without items
            sql = text("""
                SELECT 
                    sr.id as relationship_id,
                    sr.status_for_org,
                    s.id as seller_id,
                    s.name as seller_name,
                    s.email,
                    s.primary_phone,
                    s.description,
                    s.status as seller_status
                FROM srm.supplier_relationships sr
                JOIN public.sellers s ON sr.seller_id = s.id
                WHERE sr.organization_id = :org_id
                  AND sr.deleted_at IS NULL
                  AND s.deleted_at IS NULL
                LIMIT :limit
            """)
            params = {"org_id": organization_id, "limit": limit}

        # Run query with timeout
        loop = asyncio.get_event_loop()

        def execute_query():
            with db_engine.connect() as conn:
                result = conn.execute(sql, params)
                return result.fetchall(), result.keys()

        rows, keys = await asyncio.wait_for(
            loop.run_in_executor(None, execute_query),
            timeout=15.0,
        )

        # Format results
        results = []
        for row in rows:
            row_dict = dict(zip(keys, row))
            result_item = {
                "relationship_id": str(row_dict["relationship_id"]),
                "seller_id": str(row_dict["seller_id"]),
                "name": row_dict["seller_name"] or "Unnamed Supplier",
                "email": row_dict["email"],
                "phone": row_dict["primary_phone"],
                "description": row_dict["description"],
                "status": row_dict["status_for_org"],
                "seller_status": row_dict["seller_status"],
            }
            if include_items and "items" in row_dict:
                # Parse JSON items if it's a string, otherwise use as-is
                items = row_dict["items"]
                if isinstance(items, str):
                    items = json.loads(items)
                # Filter out null items from the JSON aggregation
                result_item["items"] = [i for i in items if i.get("item_id")]
            results.append(result_item)

        return json.dumps({
            "success": True,
            "data": results,
            "meta": {"totalCount": len(results)},
        })

    except asyncio.TimeoutError:
        logger.error("search_suppliers timed out after 15 seconds")
        return json.dumps({
            "success": False,
            "error": "Query timed out. Try with a smaller limit or without items.",
        })
    except Exception as e:
        logger.error(f"Error in search_suppliers: {e}")
        return json.dumps({"success": False, "error": str(e)})


@function_tool
async def search_global_suppliers(
    query: Optional[str] = None,
    include_products: bool = True,
    page: int = 1,
    limit: int = 20,
    context: RunContext = None,
) -> str:
    """
    Search Buyamia's global supplier database. Use this when the user asks you to find suppliers 
    from Buyamia's database (e.g., "Can you find a flour supplier for me?", "Boleh tolong carikan yang ada?").
    
    This searches ALL suppliers in Buyamia's system, not just the organization's current suppliers.
    The search is intelligent and matches against:
    - Supplier names and descriptions
    - Products they sell in the marketplace (with fuzzy matching for typos/variations)
    - Supplier items they can provide (with fuzzy matching)

    Args:
        query: Search term - can be supplier name, product name, or item name (case-insensitive, supports typos/variations)
        include_products: Whether to include products/items the supplier offers (default: True)
        page: Page number for pagination (default: 1)
        limit: Number of results per page (default: 20, max: 100)

    Returns:
        JSON string with paginated list of global suppliers including id, name, contact info, description,
        and optionally their marketplace products and assigned supplier items (prices for supplier items
        are only available via quote/negotiation).
    """
    if not db_engine:
        raise ToolError("Database connection not configured")

    # Validate limit
    if limit > 100:
        limit = 100

    try:
        # Build query filter conditionally using the same multi-strategy search as marketplace
        if query:
            # Search by supplier name OR products they sell OR supplier items
            # Using multiple strategies: full-text search, trigram similarity, and ILIKE
            search_filter = """AND (
                        -- Supplier name/description matching
                        s.name ILIKE :query_pattern
                        OR s.description ILIKE :query_pattern
                        OR similarity(s.name, :query_text) > 0.3
                        -- Marketplace products matching (with fuzzy search)
                        OR EXISTS (
                            SELECT 1 FROM public.products p
                            WHERE p.seller_id = s.id
                              AND p.deleted_at IS NULL
                              AND p.status = 'active'
                              AND (
                                p.search_vector @@ plainto_tsquery('english', :query_text)
                                OR similarity(p.name, :query_text) > 0.3
                                OR p.name ILIKE :query_pattern
                                OR p.description ILIKE :query_pattern
                              )
                        )
                        -- Supplier items matching (with fuzzy search)
                        OR EXISTS (
                            SELECT 1 FROM srm.supplier_items si
                            JOIN inventory.master_items imi ON si.master_item_id = imi.id
                            WHERE si.seller_id = s.id
                              AND si.deleted_at IS NULL
                              AND imi.deleted_at IS NULL
                              AND (
                                similarity(imi.name, :query_text) > 0.3
                                OR imi.name ILIKE :query_pattern
                                OR imi.description ILIKE :query_pattern
                              )
                        )
                    )"""
            params = {
                "query_pattern": f"%{query}%",
                "query_text": query,
                "limit": limit,
                "offset": (page - 1) * limit,
            }
        else:
            search_filter = ""
            params = {
                "limit": limit,
                "offset": (page - 1) * limit,
            }

        if include_products:
            # Query with products and supplier items
            sql = text(f"""
                WITH seller_data AS (
                    SELECT 
                        s.id as seller_id,
                        s.name,
                        s.email,
                        s.primary_phone,
                        s.description,
                        s.status,
                        s.creation_source,
                        COUNT(*) OVER() as total_count
                    FROM public.sellers s
                    WHERE s.deleted_at IS NULL
                      AND UPPER(s.status) IN ('ACTIVE', 'APPROVED')
                      {search_filter}
                    ORDER BY s.name
                    LIMIT :limit
                    OFFSET :offset
                )
                SELECT 
                    sd.*,
                    -- Marketplace products (seller's own listings)
                    COALESCE(
                        (SELECT json_agg(json_build_object(
                            'product_id', p.id::text,
                            'name', p.name,
                            'brand', p.brand_name,
                            'description', LEFT(p.description, 200),
                            'base_price', p.base_price_per_unit,
                            'status', p.status
                        ))
                        FROM (
                            SELECT DISTINCT ON (p.name) p.id, p.name, p.brand_name, p.description, p.base_price_per_unit, p.status
                            FROM public.products p
                            WHERE p.seller_id = sd.seller_id
                              AND p.deleted_at IS NULL
                              AND p.status = 'active'
                            ORDER BY p.name, p.created_at DESC
                            LIMIT 20
                        ) p),
                        '[]'::json
                    ) as marketplace_products,
                    -- Supplier items (from any org's assignments - prices only via quote)
                    COALESCE(
                        (SELECT json_agg(json_build_object(
                            'item_name', imi.name,
                            'unit', imi.unit_of_measure,
                            'brand', imi.brand,
                            'description', LEFT(imi.description, 200),
                            'price_note', 'Price available on quote'
                        ))
                        FROM (
                            SELECT DISTINCT ON (imi.name) imi.name, imi.unit_of_measure, imi.brand, imi.description
                            FROM srm.supplier_items si
                            JOIN inventory.master_items imi ON si.master_item_id = imi.id AND imi.deleted_at IS NULL
                            WHERE si.seller_id = sd.seller_id
                              AND si.deleted_at IS NULL
                            ORDER BY imi.name, si.created_at DESC
                            LIMIT 20
                        ) imi),
                        '[]'::json
                    ) as supplier_items
                FROM seller_data sd
            """)
        else:
            # Simple query without products
            sql = text(f"""
                SELECT 
                    s.id as seller_id,
                    s.name,
                    s.email,
                    s.primary_phone,
                    s.description,
                    s.status,
                    s.creation_source,
                    COUNT(*) OVER() as total_count
                FROM public.sellers s
                WHERE s.deleted_at IS NULL
                  AND UPPER(s.status) IN ('ACTIVE', 'APPROVED')
                  {search_filter}
                ORDER BY s.name
                LIMIT :limit
                OFFSET :offset
            """)

        # Run query with timeout
        loop = asyncio.get_event_loop()

        def execute_query():
            with db_engine.connect() as conn:
                result = conn.execute(sql, params)
                return result.fetchall(), result.keys()

        rows, keys = await asyncio.wait_for(
            loop.run_in_executor(None, execute_query),
            timeout=15.0,
        )

        # Format results
        results = []
        total_count = 0
        for row in rows:
            row_dict = dict(zip(keys, row))
            if total_count == 0:
                total_count = row_dict.get("total_count", 0)
            
            result_item = {
                "seller_id": str(row_dict["seller_id"]),
                "name": row_dict["name"] or "Unnamed Supplier",
                "email": row_dict["email"],
                "phone": row_dict["primary_phone"],
                "description": row_dict["description"],
                "status": row_dict["status"],
                "creation_source": row_dict["creation_source"],
            }
            
            if include_products:
                # Parse JSON if string
                marketplace = row_dict.get("marketplace_products", [])
                if isinstance(marketplace, str):
                    marketplace = json.loads(marketplace)
                result_item["marketplace_products"] = marketplace or []
                
                supplier_items = row_dict.get("supplier_items", [])
                if isinstance(supplier_items, str):
                    supplier_items = json.loads(supplier_items)
                result_item["supplier_items"] = supplier_items or []
            
            results.append(result_item)

        total_pages = (total_count + limit - 1) // limit if total_count > 0 else 0

        return json.dumps({
            "success": True,
            "data": results,
            "meta": {
                "currentPage": page,
                "totalPages": total_pages,
                "limit": limit,
                "totalCount": total_count,
            }
        })

    except asyncio.TimeoutError:
        logger.error("search_global_suppliers timed out after 15 seconds")
        return json.dumps({
            "success": False,
            "error": "Query timed out. Try with a smaller limit or a more specific query.",
        })
    except Exception as e:
        logger.error(f"Error in search_global_suppliers: {e}")
        return json.dumps({"success": False, "error": str(e)})


# Export all backend tools
BACKEND_TOOLS = [
    find_inventory_items,
    get_stock_levels,
    get_critical_stock_items,
    get_consumption_history,
    get_open_purchase_orders,
    get_suppliers_for_item,
    get_available_procurement_methods,
    # get_available_procurement_offerings,  # Commented out - not relevant for inventory/supplier queries, has schema issues
    search_suppliers,
    search_global_suppliers,
]

