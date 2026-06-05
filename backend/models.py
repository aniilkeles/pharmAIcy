from sqlalchemy import Column, Integer, String, Float, Date, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from backend.database import Base


class Product(Base):
    __tablename__ = "products"

    product_id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    barcode = Column(String(50), nullable=True)
    cost_price = Column(Float, nullable=False, default=0.0)
    sale_price = Column(Float, nullable=False, default=0.0)

    inventory = relationship("Inventory", back_populates="product", uselist=False, cascade="all, delete-orphan")
    sales = relationship("Sale", back_populates="product", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="product", cascade="all, delete-orphan")
    prescription_items = relationship("PrescriptionItem", back_populates="product")


class Inventory(Base):
    __tablename__ = "inventory"

    id = Column(Integer, primary_key=True, autoincrement=True)
    product_id = Column(Integer, ForeignKey("products.product_id"), nullable=False)
    stock = Column(Integer, nullable=False, default=0)
    critical_stock = Column(Integer, nullable=False, default=20)
    expiry_date = Column(Date, nullable=True)
    lot_number = Column(String(50), nullable=True)

    product = relationship("Product", back_populates="inventory")


class Sale(Base):
    __tablename__ = "sales"

    sale_id = Column(Integer, primary_key=True, autoincrement=True)
    product_id = Column(Integer, ForeignKey("products.product_id"), nullable=False)
    date = Column(Date, nullable=False)
    quantity = Column(Integer, nullable=False)
    prescription_id = Column(Integer, ForeignKey("prescriptions.id"), nullable=True)

    product = relationship("Product", back_populates="sales")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, autoincrement=True)
    type = Column(String(50), nullable=False)
    product_id = Column(Integer, ForeignKey("products.product_id"), nullable=True)
    product_name = Column(String(255), nullable=True)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    product = relationship("Product", back_populates="notifications")


class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, autoincrement=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    tc_no = Column(String(11), nullable=True, unique=True)
    phone = Column(String(20), nullable=True)
    birthdate = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    prescriptions = relationship("Prescription", back_populates="patient")


class Doctor(Base):
    __tablename__ = "doctors"

    id = Column(Integer, primary_key=True, autoincrement=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    specialty = Column(String(100), nullable=True)
    license_no = Column(String(50), nullable=True)
    hospital = Column(String(200), nullable=True)
    phone = Column(String(20), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    prescriptions = relationship("Prescription", back_populates="doctor")


class Prescription(Base):
    __tablename__ = "prescriptions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    rx_number = Column(String(20), nullable=False, unique=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=True)
    status = Column(String(20), nullable=False, default="pending")  # pending, dispensed, partial, cancelled
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    dispensed_at = Column(DateTime(timezone=True), nullable=True)

    patient = relationship("Patient", back_populates="prescriptions")
    doctor = relationship("Doctor", back_populates="prescriptions")
    items = relationship("PrescriptionItem", back_populates="prescription", cascade="all, delete-orphan")


class PrescriptionItem(Base):
    __tablename__ = "prescription_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    prescription_id = Column(Integer, ForeignKey("prescriptions.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.product_id"), nullable=False)
    quantity_requested = Column(Integer, nullable=False, default=1)
    quantity_dispensed = Column(Integer, nullable=False, default=0)
    dosage = Column(String(100), nullable=True)
    duration = Column(String(100), nullable=True)
    instructions = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="pending")  # pending, dispensed, partial, out_of_stock

    prescription = relationship("Prescription", back_populates="items")
    product = relationship("Product", back_populates="prescription_items")


class DrugInteraction(Base):
    __tablename__ = "drug_interactions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    drug_a = Column(String(200), nullable=False)
    drug_b = Column(String(200), nullable=False)
    severity = Column(String(20), nullable=False, default="moderate")  # mild, moderate, severe
    description = Column(Text, nullable=True)


class AuditLog(Base):
    __tablename__ = "audit_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(100), nullable=False)
    action = Column(String(100), nullable=False)
    entity_type = Column(String(50), nullable=True)
    entity_id = Column(Integer, nullable=True)
    details = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
