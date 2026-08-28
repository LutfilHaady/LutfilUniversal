"""
Database models for the LiveKit procurement copilot agent.
These mirror the models from the main backend for database access.
"""

from typing import ClassVar

from sqlalchemy import JSON, Boolean, Column, DateTime, Float, ForeignKey, String
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

Base = declarative_base()


class InventoryItemCategory(Base):
    __tablename__ = "item_categories"
    __table_args__: ClassVar[dict] = {"schema": "inventory"}

    budget_category_id = Column(String, nullable=True)
    created_at = Column(DateTime, nullable=False)
    deleted_at = Column(DateTime, nullable=True)
    description = Column(String, nullable=True)
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    organization_id = Column(String, nullable=True)
    updated_at = Column(DateTime, nullable=False)


class InventoryMasterItem(Base):
    __tablename__ = "master_items"
    __table_args__: ClassVar[dict] = {"schema": "inventory"}

    brand = Column(String, nullable=True)
    created_at = Column(DateTime, nullable=False)
    deleted_at = Column(DateTime, nullable=True)
    description = Column(String, nullable=True)
    id = Column(String, primary_key=True)
    image_file_id = Column(String, nullable=True)
    is_manual_input = Column(Boolean, nullable=True, default=None)
    is_perishable = Column(Boolean, nullable=False, default=False)
    is_service = Column(Boolean, nullable=False, default=False)
    item_category_id = Column(String, nullable=True)
    item_code = Column(String, nullable=False)
    name = Column(String, nullable=False)
    organization_id = Column(String, nullable=True)
    property_id = Column(String, nullable=True)
    requires_lot_tracking = Column(Boolean, nullable=False, default=False)
    specifications = Column(JSON, nullable=True)
    status = Column(String, nullable=False, default="")
    unit_of_measure = Column(String, nullable=False)
    updated_at = Column(DateTime, nullable=False)


class InventoryStockLevel(Base):
    __tablename__ = "stock_levels"
    __table_args__: ClassVar[dict] = {"schema": "inventory"}

    created_at = Column(DateTime, nullable=False)
    deleted_at = Column(DateTime, nullable=True)
    id = Column(String, primary_key=True)
    last_counted_at = Column(DateTime, nullable=True)
    notes = Column(String, nullable=True)
    quantity_on_hand = Column(Float, nullable=False, default=0)
    storage_location_id = Column(
        String, ForeignKey("inventory.storage_locations.id"), nullable=False
    )
    tracked_item_id = Column(
        String, ForeignKey("inventory.tracked_items.id"), nullable=False
    )
    updated_at = Column(DateTime, nullable=False)
    storage_location = relationship(
        "InventoryStorageLocation", back_populates="stock_levels"
    )


class InventoryStorageLocation(Base):
    __tablename__ = "storage_locations"
    __table_args__: ClassVar[dict] = {"schema": "inventory"}

    created_at = Column(DateTime, nullable=False)
    deleted_at = Column(DateTime, nullable=True)
    description = Column(String, nullable=True)
    floor_id = Column(String, nullable=True)
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    property_id = Column(String, nullable=False)
    updated_at = Column(DateTime, nullable=False)
    stock_levels = relationship(
        "InventoryStockLevel", back_populates="storage_location"
    )


class InventoryTrackedItem(Base):
    __tablename__ = "tracked_items"
    __table_args__: ClassVar[dict] = {"schema": "inventory"}

    created_at = Column(DateTime, nullable=False)
    deleted_at = Column(DateTime, nullable=True)
    id = Column(String, primary_key=True)
    master_item_id = Column(String, nullable=False)
    max_stock_level = Column(Float, nullable=True)
    min_stock_level = Column(Float, nullable=False, default=0)
    notes = Column(String, nullable=True)
    par_level = Column(Float, nullable=True)
    preferred_supplier_id = Column(String, nullable=True)
    property_id = Column(String, nullable=False)
    status = Column(String, nullable=False, default="")
    updated_at = Column(DateTime, nullable=False)


class InventoryTransactionDetail(Base):
    __tablename__ = "transaction_details"
    __table_args__: ClassVar[dict] = {"schema": "inventory"}

    created_at = Column(DateTime, nullable=False)
    expiration_date = Column(DateTime, nullable=True)
    header_id = Column(String, nullable=False)
    id = Column(String, primary_key=True)
    lot_number = Column(String, nullable=True)
    lot_stock_id = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    quantity_change = Column(Float, nullable=False)
    storage_location_id = Column(String, nullable=False)
    tracked_item_id = Column(String, nullable=False)
    unit_cost = Column(Float, nullable=True)


class InventoryTransactionHeader(Base):
    __tablename__ = "transaction_headers"
    __table_args__: ClassVar[dict] = {"schema": "inventory"}

    associated_task_ref = Column(String, nullable=True)
    created_at = Column(DateTime, nullable=False)
    deleted_at = Column(DateTime, nullable=True)
    destination = Column(String, nullable=True)
    id = Column(String, primary_key=True)
    notes = Column(String, nullable=True)
    property_id = Column(String, nullable=False)
    reason = Column(String, nullable=True)
    reference_number = Column(String, nullable=True)
    related_document_id = Column(String, nullable=True)
    related_document_type = Column(String, nullable=True)
    transaction_date = Column(DateTime, nullable=False)
    transaction_type = Column(String, nullable=False)
    updated_at = Column(DateTime, nullable=False)
    user_id = Column(String, nullable=True)


class PropertyProperty(Base):
    __tablename__ = "properties"
    __table_args__: ClassVar[dict] = {"schema": "property"}

    address_line_1 = Column(String, nullable=True)
    address_line_2 = Column(String, nullable=True)
    city = Column(String, nullable=True)
    country = Column(String, nullable=True)
    created_at = Column(DateTime, nullable=False)
    deleted_at = Column(DateTime, nullable=True)
    description = Column(String, nullable=True)
    id = Column(String, primary_key=True)
    latitude = Column(Float, nullable=True)
    logo_image_id = Column(String, nullable=True)
    longitude = Column(Float, nullable=True)
    name = Column(String, nullable=False)
    organization_id = Column(String, nullable=False)
    postal_code = Column(String, nullable=True)
    property_style_id = Column(String, nullable=True)
    property_type_id = Column(String, nullable=True)
    state = Column(String, nullable=True)
    thumbnail_image_id = Column(String, nullable=True)
    updated_at = Column(DateTime, nullable=False)


class ProcurementSolution(Base):
    __tablename__ = "solutions"
    __table_args__: ClassVar[dict] = {"schema": "procurement"}

    code = Column(String, nullable=False)
    created_at = Column(DateTime, nullable=False)
    deleted_at = Column(DateTime, nullable=True)
    description = Column(String, nullable=True)
    display_name = Column(String, nullable=False)
    id = Column(String, primary_key=True)
    is_active = Column(Boolean, nullable=False, default=True)
    name = Column(String, nullable=False)
    updated_at = Column(DateTime, nullable=False)


class ProcurementOffering(Base):
    __tablename__ = "offerings"
    __table_args__: ClassVar[dict] = {"schema": "procurement"}

    code = Column(String, nullable=True)
    created_at = Column(DateTime, nullable=False)
    deleted_at = Column(DateTime, nullable=True)
    description = Column(String, nullable=True)
    display_name = Column(String, nullable=True)
    group_id = Column(String, nullable=True)
    id = Column(String, primary_key=True)
    is_active = Column(Boolean, nullable=False, default=True)
    name = Column(String, nullable=False)
    updated_at = Column(DateTime, nullable=False)


class ProcurementPurchaseOrder(Base):
    __tablename__ = "purchase_orders"
    __table_args__: ClassVar[dict] = {"schema": "procurement"}

    created_at = Column(DateTime, nullable=False)
    deleted_at = Column(DateTime, nullable=True)
    expected_delivery_date = Column(DateTime, nullable=True)
    id = Column(String, primary_key=True)
    organization_id = Column(String, nullable=False)
    seller_id = Column(String, nullable=True)
    status = Column(String, nullable=False)
    updated_at = Column(DateTime, nullable=False)


class ProcurementPurchaseOrderItem(Base):
    __tablename__ = "purchase_order_items"
    __table_args__: ClassVar[dict] = {"schema": "procurement"}

    created_at = Column(DateTime, nullable=False)
    deleted_at = Column(DateTime, nullable=True)
    id = Column(String, primary_key=True)
    purchase_order_id = Column(String, nullable=False)
    quantity = Column(Float, nullable=False)
    request_item_id = Column(String, nullable=True)
    updated_at = Column(DateTime, nullable=False)


class SrmSupplierRelationship(Base):
    __tablename__ = "supplier_relationships"
    __table_args__: ClassVar[dict] = {"schema": "srm"}

    created_at = Column(DateTime, nullable=False)
    deleted_at = Column(DateTime, nullable=True)
    id = Column(String, primary_key=True)
    organization_id = Column(String, nullable=False)
    seller_id = Column(String, nullable=False)
    status_for_org = Column(String, nullable=True)
    updated_at = Column(DateTime, nullable=False)


class Seller(Base):
    __tablename__ = "sellers"

    created_at = Column(DateTime, nullable=False)
    deleted_at = Column(DateTime, nullable=True)
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    primary_phone = Column(String, nullable=False)
    description = Column(String, nullable=True)
    status = Column(String, nullable=False)
    updated_at = Column(DateTime, nullable=False)

