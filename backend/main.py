import os
import io
import csv
import json
import base64
import pandas as pd
from datetime import datetime, date, timedelta
from typing import Optional, List
from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from dotenv import load_dotenv

load_dotenv()

from backend.database import engine, Base, get_db_for_user
from backend.models import (
    Product, Inventory, Sale, Notification,
    Patient, Doctor, Prescription, PrescriptionItem, DrugInteraction, AuditLog
)

Base.metadata.create_all(bind=engine)

from agents.data_agent import analyze_sales, get_low_stock, get_prescription_stats
from agents.prediction_agent import predict_sales, train_model
from agents.interaction_agent import find_cross_sell, get_prescription_cross_sell
from agents.expiry_agent import get_expiring, get_fefo_suggestion
from agents.decision_agent import aggregate_context, get_decisions, chat, identify_barcode, check_drug_interactions

limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="PharmAIcy API", version="2.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# ─── Auth ─────────────────────────────────────────────────────────────────────

def get_user_id(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
        jwt_secret = os.getenv("SUPABASE_JWT_SECRET", "")
        if jwt_secret:
            try:
                from jose import jwt as jose_jwt
                payload = jose_jwt.decode(token, jwt_secret, algorithms=["HS256"], audience="authenticated")
                return payload.get("sub", "")
            except Exception:
                pass
    return request.headers.get("X-User-ID", "dev-user")


def get_current_db(request: Request):
    user_id = get_user_id(request)
    db = get_db_for_user(user_id)
    try:
        yield db
    finally:
        db.close()


def _audit(db: Session, user_id: str, action: str, entity_type: str = None, entity_id: int = None, details: dict = None):
    log = AuditLog(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=json.dumps(details or {})
    )
    db.add(log)


def _generate_rx_number(db: Session) -> str:
    today = date.today().strftime("%Y%m%d")
    count = db.query(Prescription).filter(
        Prescription.rx_number.like(f"RX-{today}-%")
    ).count()
    return f"RX-{today}-{count + 1:04d}"

# ─── Pydantic Models ───────────────────────────────────────────────────────────

class UploadDataRequest(BaseModel):
    csv_bytes: str

class ChatRequest(BaseModel):
    message: str
    context: Optional[dict] = None
    history: Optional[list] = None

class NotificationReadRequest(BaseModel):
    id: int

class BarcodeRequest(BaseModel):
    barcode: str

class AddProductRequest(BaseModel):
    name: str
    barcode: Optional[str] = None
    cost_price: float
    sale_price: float
    stock: int = 0
    critical_stock: int = 20
    expiry_date: Optional[str] = None

class PatientCreate(BaseModel):
    first_name: str
    last_name: str
    tc_no: Optional[str] = None
    phone: Optional[str] = None
    birthdate: Optional[str] = None
    notes: Optional[str] = None

class PatientUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    tc_no: Optional[str] = None
    phone: Optional[str] = None
    birthdate: Optional[str] = None
    notes: Optional[str] = None

class DoctorCreate(BaseModel):
    first_name: str
    last_name: str
    specialty: Optional[str] = None
    license_no: Optional[str] = None
    hospital: Optional[str] = None
    phone: Optional[str] = None

class PrescriptionItemCreate(BaseModel):
    product_id: int
    quantity_requested: int = 1
    dosage: Optional[str] = None
    duration: Optional[str] = None
    instructions: Optional[str] = None

class PrescriptionCreate(BaseModel):
    patient_id: int
    doctor_id: Optional[int] = None
    notes: Optional[str] = None
    items: List[PrescriptionItemCreate] = []
    confirm_immediately: bool = False

class DrugInteractionCheck(BaseModel):
    product_ids: List[int]

# ─── Notification helpers ──────────────────────────────────────────────────────

def _check_and_create_notifications(db: Session):
    today = date.today()
    inventories = db.query(Inventory).all()

    for inv in inventories:
        product = db.query(Product).filter(Product.product_id == inv.product_id).first()
        if not product:
            continue

        if inv.stock <= inv.critical_stock // 2:
            existing = db.query(Notification).filter(
                Notification.type == "stock_critical",
                Notification.product_id == inv.product_id,
                Notification.is_read == False
            ).first()
            if not existing:
                db.add(Notification(
                    type="stock_critical", product_id=inv.product_id,
                    product_name=product.name,
                    message=f"CRITICAL: {product.name} has only {inv.stock} units left (threshold: {inv.critical_stock})",
                    is_read=False
                ))
        elif inv.stock <= inv.critical_stock:
            existing = db.query(Notification).filter(
                Notification.type == "stock_warning",
                Notification.product_id == inv.product_id,
                Notification.is_read == False
            ).first()
            if not existing:
                db.add(Notification(
                    type="stock_warning", product_id=inv.product_id,
                    product_name=product.name,
                    message=f"Low stock: {product.name} has {inv.stock} units (threshold: {inv.critical_stock})",
                    is_read=False
                ))

        if inv.expiry_date:
            expiry = inv.expiry_date
            if isinstance(expiry, str):
                expiry = date.fromisoformat(expiry)
            days_left = (expiry - today).days

            if days_left <= 30:
                existing = db.query(Notification).filter(
                    Notification.type == "expiry_urgent",
                    Notification.product_id == inv.product_id,
                    Notification.is_read == False
                ).first()
                if not existing:
                    db.add(Notification(
                        type="expiry_urgent", product_id=inv.product_id,
                        product_name=product.name,
                        message=f"URGENT: {product.name} expires in {days_left} days ({expiry})",
                        is_read=False
                    ))
            elif days_left <= 90:
                existing = db.query(Notification).filter(
                    Notification.type == "expiry_warning",
                    Notification.product_id == inv.product_id,
                    Notification.is_read == False
                ).first()
                if not existing:
                    db.add(Notification(
                        type="expiry_warning", product_id=inv.product_id,
                        product_name=product.name,
                        message=f"Expiry warning: {product.name} expires in {days_left} days ({expiry})",
                        is_read=False
                    ))

    db.commit()

# ─── System ───────────────────────────────────────────────────────────────────

@app.get("/agent-status")
def agent_status():
    return {
        "status": "ok",
        "agents": {
            "data_agent": "ready", "prediction_agent": "ready",
            "interaction_agent": "ready", "expiry_agent": "ready", "decision_agent": "ready"
        },
        "timestamp": datetime.now().isoformat()
    }

# ─── Upload / Export ───────────────────────────────────────────────────────────

@app.post("/upload-data")
def upload_data(request_body: UploadDataRequest, request: Request, db: Session = Depends(get_current_db)):
    try:
        raw_bytes = base64.b64decode(request_body.csv_bytes)
        df = None
        for enc in ['utf-8', 'utf-8-sig', 'latin-1', 'cp1252', 'iso-8859-1']:
            try:
                df = pd.read_csv(io.BytesIO(raw_bytes), encoding=enc, dtype=str)
                break
            except Exception:
                continue

        if df is None or df.empty:
            raise HTTPException(status_code=400, detail="File is empty or could not be read")

        df.columns = df.columns.str.strip().str.lstrip('﻿')

        if 'name' not in set(df.columns):
            raise HTTPException(status_code=400, detail=f"Required column 'name' not found. Got: {sorted(df.columns)}")

        def safe_float(val, default=0.0):
            try: return float(str(val).strip().replace(',', '.'))
            except: return default

        def safe_int(val, default=0):
            try: return int(float(str(val).strip().replace(',', '.')))
            except: return default

        def safe_date(val):
            if pd.isna(val) or str(val).strip() in ('', 'None', 'nan'):
                return None
            s = str(val).strip()
            for fmt in ['%Y-%m-%d', '%d/%m/%Y', '%d.%m.%Y', '%m/%d/%Y', '%d-%m-%Y']:
                try: return datetime.strptime(s, fmt).date()
                except: continue
            return None

        cols = set(df.columns)
        db.query(Sale).delete()
        db.query(Inventory).delete()
        db.query(Notification).delete()
        db.query(Product).delete()
        db.commit()

        for _, row in df.iterrows():
            name = str(row.get('name', '') or '').strip()
            if not name or name == 'nan':
                continue

            product = Product(
                name=name,
                barcode=str(row['barcode']).strip() if 'barcode' in cols and not pd.isna(row.get('barcode')) else None,
                cost_price=safe_float(row.get('cost_price', 0)),
                sale_price=safe_float(row.get('sale_price', 0))
            )
            db.add(product)
            db.flush()

            inv = Inventory(
                product_id=product.product_id,
                stock=safe_int(row.get('stock', 0)),
                critical_stock=safe_int(row.get('critical_stock', 20), default=20),
                expiry_date=safe_date(row.get('expiry_date')) if 'expiry_date' in cols else None
            )
            db.add(inv)

        db.commit()
        train_model(db)
        _check_and_create_notifications(db)

        product_count = db.query(Product).count()
        return {"message": f"Uploaded {product_count} products successfully", "count": product_count}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/export-data")
def export_data(request: Request, db: Session = Depends(get_current_db)):
    products = db.query(Product).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["product_id", "name", "barcode", "cost_price", "sale_price", "stock", "critical_stock", "expiry_date"])

    for p in products:
        inv = db.query(Inventory).filter(Inventory.product_id == p.product_id).first()
        writer.writerow([
            p.product_id, p.name, p.barcode or "",
            p.cost_price, p.sale_price,
            inv.stock if inv else 0,
            inv.critical_stock if inv else 20,
            str(inv.expiry_date) if inv and inv.expiry_date else ""
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=pharmacy_export.csv"}
    )

# ─── Analytics ────────────────────────────────────────────────────────────────

@app.post("/analyze-sales")
def analyze_sales_endpoint(request: Request, db: Session = Depends(get_current_db)):
    return analyze_sales(db)

@app.post("/predict-sales")
def predict_sales_endpoint(request: Request, db: Session = Depends(get_current_db)):
    return predict_sales(db)

@app.get("/low-stock")
def low_stock_endpoint(request: Request, db: Session = Depends(get_current_db)):
    return get_low_stock(db)

@app.get("/expiry-products")
def expiry_products_endpoint(request: Request, db: Session = Depends(get_current_db)):
    return get_expiring(db)

@app.get("/cross-sell")
def cross_sell_endpoint(request: Request, db: Session = Depends(get_current_db)):
    return find_cross_sell(db)

@app.get("/decisions")
@limiter.limit("10/minute")
def decisions_endpoint(request: Request, db: Session = Depends(get_current_db)):
    context = aggregate_context(db)
    decisions = get_decisions(context)
    return {"decisions": decisions}

@app.post("/chat")
@limiter.limit("10/minute")
def chat_endpoint(request_body: ChatRequest, request: Request, db: Session = Depends(get_current_db)):
    context = request_body.context or aggregate_context(db)
    response = chat(request_body.message, context, request_body.history)
    return {"response": response}

@app.get("/dashboard-summary")
def dashboard_summary(request: Request, db: Session = Depends(get_current_db)):
    product_count = db.query(Product).count()
    if product_count == 0:
        return {
            "has_data": False, "product_count": 0, "sales": None,
            "low_stock_count": 0, "expiry_count": 0, "unread_notifications": 0,
            "prescription_stats": {"today": 0, "pending": 0, "fulfillment_rate": 0}
        }

    sales = analyze_sales(db)
    low_stock = get_low_stock(db)
    expiring = get_expiring(db)
    unread = db.query(Notification).filter(Notification.is_read == False).count()
    rx_stats = get_prescription_stats(db)

    return {
        "has_data": True,
        "product_count": product_count,
        "sales": sales,
        "low_stock_count": len(low_stock),
        "low_stock": low_stock[:5],
        "expiry_count": len(expiring),
        "expiring": expiring[:5],
        "unread_notifications": unread,
        "prescription_stats": rx_stats
    }

# ─── Notifications ─────────────────────────────────────────────────────────────

@app.get("/notifications")
def get_notifications(request: Request, db: Session = Depends(get_current_db)):
    notifs = db.query(Notification).order_by(
        Notification.is_read.asc(), Notification.created_at.desc()
    ).all()
    return [{
        "id": n.id, "type": n.type, "product_id": n.product_id,
        "product_name": n.product_name, "message": n.message,
        "is_read": n.is_read,
        "created_at": n.created_at.isoformat() if n.created_at else None
    } for n in notifs]

@app.post("/notifications/read")
def mark_notification_read(body: NotificationReadRequest, request: Request, db: Session = Depends(get_current_db)):
    notif = db.query(Notification).filter(Notification.id == body.id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.is_read = True
    db.commit()
    return {"success": True}

@app.post("/notifications/read-all")
def mark_all_read(request: Request, db: Session = Depends(get_current_db)):
    db.query(Notification).filter(Notification.is_read == False).update({"is_read": True})
    db.commit()
    return {"success": True}

@app.get("/notifications/unread-count")
def unread_count(request: Request, db: Session = Depends(get_current_db)):
    count = db.query(Notification).filter(Notification.is_read == False).count()
    return {"count": count}

@app.post("/notifications/check")
def check_notifications(request: Request, db: Session = Depends(get_current_db)):
    _check_and_create_notifications(db)
    count = db.query(Notification).filter(Notification.is_read == False).count()
    return {"message": "Notification check complete", "unread_count": count}

# ─── Products ──────────────────────────────────────────────────────────────────

@app.post("/products/add")
def add_product(body: AddProductRequest, request: Request, db: Session = Depends(get_current_db)):
    product = Product(
        name=body.name, barcode=body.barcode,
        cost_price=body.cost_price, sale_price=body.sale_price
    )
    db.add(product)
    db.flush()

    expiry_date = None
    if body.expiry_date:
        try: expiry_date = date.fromisoformat(body.expiry_date)
        except ValueError: pass

    inv = Inventory(
        product_id=product.product_id,
        stock=body.stock, critical_stock=body.critical_stock, expiry_date=expiry_date
    )
    db.add(inv)
    db.commit()

    return {"success": True, "product_id": product.product_id, "message": f"Product '{body.name}' added successfully"}

@app.get("/products/search")
def search_products(q: str = "", request: Request = None, db: Session = Depends(get_current_db)):
    query = db.query(Product)
    if q:
        query = query.filter(Product.name.ilike(f"%{q}%"))
    products = query.limit(20).all()
    return [{
        "product_id": p.product_id, "name": p.name, "barcode": p.barcode,
        "sale_price": p.sale_price, "cost_price": p.cost_price,
        "stock": p.inventory.stock if p.inventory else 0,
        "critical_stock": p.inventory.critical_stock if p.inventory else 20
    } for p in products]

# ─── Barcode ───────────────────────────────────────────────────────────────────

@app.post("/barcode-lookup")
def barcode_lookup(body: BarcodeRequest, request: Request, db: Session = Depends(get_current_db)):
    barcode = body.barcode.strip()
    product = db.query(Product).filter(Product.barcode == barcode).first()

    if not product:
        identified = identify_barcode(barcode)
        return {"found": False, "barcode": barcode, "identified": identified}

    inv = db.query(Inventory).filter(Inventory.product_id == product.product_id).first()
    stock = inv.stock if inv else 0
    critical_stock = inv.critical_stock if inv else 20

    if stock <= critical_stock // 2:
        stock_status = "critical"
    elif stock <= critical_stock:
        stock_status = "low"
    else:
        stock_status = "ok"

    return {
        "found": True, "product_name": product.name, "barcode": product.barcode,
        "stock": stock, "critical_stock": critical_stock,
        "sale_price": product.sale_price, "cost_price": product.cost_price,
        "expiry_date": str(inv.expiry_date) if inv and inv.expiry_date else None,
        "stock_status": stock_status
    }

# ─── Patients ──────────────────────────────────────────────────────────────────

@app.get("/patients")
def list_patients(q: str = "", request: Request = None, db: Session = Depends(get_current_db)):
    query = db.query(Patient)
    if q:
        query = query.filter(
            (Patient.first_name + " " + Patient.last_name).ilike(f"%{q}%") |
            Patient.tc_no.ilike(f"%{q}%") |
            Patient.phone.ilike(f"%{q}%")
        )
    patients = query.order_by(Patient.last_name).all()
    result = []
    for p in patients:
        last_rx = db.query(Prescription).filter(
            Prescription.patient_id == p.id
        ).order_by(Prescription.created_at.desc()).first()
        result.append({
            "id": p.id, "first_name": p.first_name, "last_name": p.last_name,
            "tc_no": p.tc_no, "phone": p.phone,
            "birthdate": str(p.birthdate) if p.birthdate else None,
            "notes": p.notes,
            "prescription_count": len(p.prescriptions),
            "last_visit": last_rx.created_at.strftime("%Y-%m-%d") if last_rx and last_rx.created_at else None
        })
    return result

@app.post("/patients")
def create_patient(body: PatientCreate, request: Request, db: Session = Depends(get_current_db)):
    patient = Patient(
        first_name=body.first_name, last_name=body.last_name,
        tc_no=body.tc_no, phone=body.phone, notes=body.notes,
        birthdate=date.fromisoformat(body.birthdate) if body.birthdate else None
    )
    db.add(patient)
    db.commit()
    db.refresh(patient)
    _audit(db, get_user_id(request), "create_patient", "patient", patient.id)
    db.commit()
    return {"id": patient.id, "first_name": patient.first_name, "last_name": patient.last_name}

@app.get("/patients/{patient_id}")
def get_patient(patient_id: int, request: Request, db: Session = Depends(get_current_db)):
    p = db.query(Patient).filter(Patient.id == patient_id).first()
    if not p:
        raise HTTPException(404, "Patient not found")

    prescriptions = db.query(Prescription).filter(
        Prescription.patient_id == patient_id
    ).order_by(Prescription.created_at.desc()).all()

    return {
        "id": p.id, "first_name": p.first_name, "last_name": p.last_name,
        "tc_no": p.tc_no, "phone": p.phone, "notes": p.notes,
        "birthdate": str(p.birthdate) if p.birthdate else None,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "prescriptions": [{
            "id": rx.id, "rx_number": rx.rx_number, "status": rx.status,
            "created_at": rx.created_at.isoformat() if rx.created_at else None,
            "item_count": len(rx.items)
        } for rx in prescriptions]
    }

@app.put("/patients/{patient_id}")
def update_patient(patient_id: int, body: PatientUpdate, request: Request, db: Session = Depends(get_current_db)):
    p = db.query(Patient).filter(Patient.id == patient_id).first()
    if not p:
        raise HTTPException(404, "Patient not found")
    for field, val in body.dict(exclude_none=True).items():
        if field == "birthdate" and val:
            val = date.fromisoformat(val)
        setattr(p, field, val)
    db.commit()
    return {"success": True}

# ─── Doctors ───────────────────────────────────────────────────────────────────

@app.get("/doctors")
def list_doctors(q: str = "", request: Request = None, db: Session = Depends(get_current_db)):
    query = db.query(Doctor)
    if q:
        query = query.filter(
            (Doctor.first_name + " " + Doctor.last_name).ilike(f"%{q}%") |
            Doctor.specialty.ilike(f"%{q}%")
        )
    doctors = query.order_by(Doctor.last_name).all()
    return [{
        "id": d.id, "first_name": d.first_name, "last_name": d.last_name,
        "specialty": d.specialty, "license_no": d.license_no,
        "hospital": d.hospital, "phone": d.phone
    } for d in doctors]

@app.post("/doctors")
def create_doctor(body: DoctorCreate, request: Request, db: Session = Depends(get_current_db)):
    doctor = Doctor(
        first_name=body.first_name, last_name=body.last_name,
        specialty=body.specialty, license_no=body.license_no,
        hospital=body.hospital, phone=body.phone
    )
    db.add(doctor)
    db.commit()
    db.refresh(doctor)
    return {"id": doctor.id, "first_name": doctor.first_name, "last_name": doctor.last_name}

# ─── Prescriptions ─────────────────────────────────────────────────────────────

@app.get("/prescriptions")
def list_prescriptions(status: str = "", request: Request = None, db: Session = Depends(get_current_db)):
    query = db.query(Prescription)
    if status:
        query = query.filter(Prescription.status == status)
    prescriptions = query.order_by(Prescription.created_at.desc()).all()

    result = []
    for rx in prescriptions:
        total_price = sum(
            (item.product.sale_price * item.quantity_requested) if item.product else 0
            for item in rx.items
        )
        result.append({
            "id": rx.id, "rx_number": rx.rx_number, "status": rx.status,
            "patient_name": f"{rx.patient.first_name} {rx.patient.last_name}" if rx.patient else "",
            "doctor_name": f"{rx.doctor.first_name} {rx.doctor.last_name}" if rx.doctor else None,
            "item_count": len(rx.items),
            "total_price": round(total_price, 2),
            "notes": rx.notes,
            "created_at": rx.created_at.isoformat() if rx.created_at else None,
            "dispensed_at": rx.dispensed_at.isoformat() if rx.dispensed_at else None
        })
    return result

@app.post("/prescriptions")
def create_prescription(body: PrescriptionCreate, request: Request, db: Session = Depends(get_current_db)):
    user_id = get_user_id(request)

    patient = db.query(Patient).filter(Patient.id == body.patient_id).first()
    if not patient:
        raise HTTPException(404, "Patient not found")

    rx = Prescription(
        rx_number=_generate_rx_number(db),
        patient_id=body.patient_id,
        doctor_id=body.doctor_id,
        notes=body.notes,
        status="pending"
    )
    db.add(rx)
    db.flush()

    for item_data in body.items:
        item = PrescriptionItem(
            prescription_id=rx.id,
            product_id=item_data.product_id,
            quantity_requested=item_data.quantity_requested,
            dosage=item_data.dosage,
            duration=item_data.duration,
            instructions=item_data.instructions
        )
        db.add(item)

    db.commit()
    _audit(db, user_id, "create_prescription", "prescription", rx.id)
    db.commit()

    if body.confirm_immediately:
        return _do_confirm(rx.id, user_id, db)

    return {"id": rx.id, "rx_number": rx.rx_number, "status": rx.status}

@app.get("/prescriptions/{rx_id}")
def get_prescription(rx_id: int, request: Request, db: Session = Depends(get_current_db)):
    rx = db.query(Prescription).filter(Prescription.id == rx_id).first()
    if not rx:
        raise HTTPException(404, "Prescription not found")

    product_ids = [item.product_id for item in rx.items]
    interactions = check_drug_interactions(db, product_ids)
    cross_sell = get_prescription_cross_sell(db, rx_id)

    items = []
    for item in rx.items:
        fefo = get_fefo_suggestion(db, item.product_id)
        items.append({
            "id": item.id,
            "product_id": item.product_id,
            "product_name": item.product.name if item.product else "",
            "quantity_requested": item.quantity_requested,
            "quantity_dispensed": item.quantity_dispensed,
            "dosage": item.dosage, "duration": item.duration, "instructions": item.instructions,
            "status": item.status,
            "stock_available": fefo.get("stock", 0),
            "expiry_info": fefo
        })

    return {
        "id": rx.id, "rx_number": rx.rx_number, "status": rx.status,
        "patient": {
            "id": rx.patient.id,
            "name": f"{rx.patient.first_name} {rx.patient.last_name}",
            "tc_no": rx.patient.tc_no
        } if rx.patient else None,
        "doctor": {
            "id": rx.doctor.id,
            "name": f"{rx.doctor.first_name} {rx.doctor.last_name}",
            "specialty": rx.doctor.specialty
        } if rx.doctor else None,
        "items": items,
        "notes": rx.notes,
        "interactions": interactions,
        "cross_sell": cross_sell,
        "total_price": round(sum(
            (i.product.sale_price * i.quantity_requested) if i.product else 0
            for i in rx.items
        ), 2),
        "created_at": rx.created_at.isoformat() if rx.created_at else None,
        "dispensed_at": rx.dispensed_at.isoformat() if rx.dispensed_at else None
    }

def _do_confirm(rx_id: int, user_id: str, db: Session) -> dict:
    rx = db.query(Prescription).filter(Prescription.id == rx_id).first()
    if not rx:
        raise HTTPException(404, "Prescription not found")
    if rx.status == "dispensed":
        raise HTTPException(400, "Already dispensed")
    if rx.status == "cancelled":
        raise HTTPException(400, "Prescription is cancelled")

    all_dispensed = True
    any_dispensed = False

    for item in rx.items:
        inv = db.query(Inventory).filter(Inventory.product_id == item.product_id).first()
        if not inv or inv.stock == 0:
            item.quantity_dispensed = 0
            item.status = "out_of_stock"
            all_dispensed = False
        elif inv.stock >= item.quantity_requested:
            inv.stock -= item.quantity_requested
            item.quantity_dispensed = item.quantity_requested
            item.status = "dispensed"
            any_dispensed = True
            db.add(Sale(product_id=item.product_id, date=date.today(),
                        quantity=item.quantity_requested, prescription_id=rx.id))
        else:
            qty = inv.stock
            inv.stock = 0
            item.quantity_dispensed = qty
            item.status = "partial"
            all_dispensed = False
            any_dispensed = True
            db.add(Sale(product_id=item.product_id, date=date.today(),
                        quantity=qty, prescription_id=rx.id))

    rx.status = "dispensed" if all_dispensed else ("partial" if any_dispensed else rx.status)
    rx.dispensed_at = datetime.now()
    db.commit()
    _audit(db, user_id, "confirm_prescription", "prescription", rx.id)
    db.commit()
    return {"id": rx.id, "rx_number": rx.rx_number, "status": rx.status}

@app.post("/prescriptions/{rx_id}/confirm")
def confirm_prescription(rx_id: int, request: Request, db: Session = Depends(get_current_db)):
    user_id = get_user_id(request)
    return _do_confirm(rx_id, user_id, db)

@app.post("/prescriptions/{rx_id}/cancel")
def cancel_prescription(rx_id: int, request: Request, db: Session = Depends(get_current_db)):
    user_id = get_user_id(request)
    rx = db.query(Prescription).filter(Prescription.id == rx_id).first()
    if not rx:
        raise HTTPException(404, "Prescription not found")
    if rx.status == "dispensed":
        raise HTTPException(400, "Cannot cancel a dispensed prescription")
    rx.status = "cancelled"
    db.commit()
    _audit(db, user_id, "cancel_prescription", "prescription", rx.id)
    db.commit()
    return {"success": True, "status": "cancelled"}

@app.post("/prescriptions/{rx_id}/repeat")
def repeat_prescription(rx_id: int, request: Request, db: Session = Depends(get_current_db)):
    user_id = get_user_id(request)
    original = db.query(Prescription).filter(Prescription.id == rx_id).first()
    if not original:
        raise HTTPException(404, "Prescription not found")

    new_rx = Prescription(
        rx_number=_generate_rx_number(db),
        patient_id=original.patient_id,
        doctor_id=original.doctor_id,
        notes=original.notes,
        status="pending"
    )
    db.add(new_rx)
    db.flush()

    for item in original.items:
        db.add(PrescriptionItem(
            prescription_id=new_rx.id,
            product_id=item.product_id,
            quantity_requested=item.quantity_requested,
            dosage=item.dosage, duration=item.duration, instructions=item.instructions
        ))

    db.commit()
    _audit(db, user_id, "repeat_prescription", "prescription", new_rx.id,
           {"original_id": rx_id})
    db.commit()
    return {"id": new_rx.id, "rx_number": new_rx.rx_number, "status": new_rx.status}

# ─── Drug Interactions ─────────────────────────────────────────────────────────

@app.post("/drug-interactions/check")
def check_interactions(body: DrugInteractionCheck, request: Request, db: Session = Depends(get_current_db)):
    return check_drug_interactions(db, body.product_ids)

# ─── Sales ─────────────────────────────────────────────────────────────────────

@app.get("/sales")
def list_sales(limit: int = 50, request: Request = None, db: Session = Depends(get_current_db)):
    sales = db.query(Sale).order_by(Sale.sale_id.desc()).limit(limit).all()
    return [{
        "sale_id": s.sale_id,
        "product_name": s.product.name if s.product else "",
        "date": str(s.date), "quantity": s.quantity,
        "prescription_id": s.prescription_id
    } for s in sales]

# ─── Audit Log ─────────────────────────────────────────────────────────────────

@app.get("/audit-log")
def get_audit_log(limit: int = 100, request: Request = None, db: Session = Depends(get_current_db)):
    logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit).all()
    return [{
        "id": l.id, "action": l.action, "entity_type": l.entity_type,
        "entity_id": l.entity_id, "details": l.details,
        "created_at": l.created_at.isoformat() if l.created_at else None
    } for l in logs]
