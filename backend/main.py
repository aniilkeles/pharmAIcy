import os
import io
import csv
import json
import base64
import random
import traceback
import requests as _requests
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

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")

from backend.database import engine, Base, get_db_for_user
from backend.models import (
    Product, Inventory, Sale, Notification,
    Patient, Doctor, Prescription, PrescriptionItem, DrugInteraction, AuditLog
)

Base.metadata.create_all(bind=engine)

from agents.data_agent import analyze_sales, get_low_stock, get_prescription_stats
from agents.prediction_agent import predict_sales, train_model
from agents.interaction_agent import get_prescription_cross_sell, suggest_for_prescription
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
    auth = request.headers.get("Authorization", "").strip()
    if not auth:
        raise HTTPException(status_code=401, detail="Authentication required")
    token = auth[7:] if auth.startswith("Bearer ") else auth
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        resp = _requests.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={"Authorization": f"Bearer {token}", "apikey": SUPABASE_ANON_KEY},
            timeout=10
        )
    except Exception:
        raise HTTPException(status_code=401, detail="Authentication service unavailable")
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid token")
    user_id = resp.json().get("id", "")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    return user_id


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

class UpdateProductRequest(BaseModel):
    stock: Optional[int] = None
    critical_stock: Optional[int] = None
    sale_price: Optional[float] = None
    cost_price: Optional[float] = None

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

        for _, row in df.iterrows():
            name = str(row.get('name', '') or '').strip()
            if not name or name == 'nan':
                continue

            barcode = str(row['barcode']).strip() if 'barcode' in cols and not pd.isna(row.get('barcode')) else None
            cost_price = safe_float(row.get('cost_price', 0))
            sale_price = safe_float(row.get('sale_price', 0))

            product = db.query(Product).filter(Product.name == name).first()
            if product:
                product.cost_price = cost_price
                product.sale_price = sale_price
                if barcode is not None:
                    product.barcode = barcode
            else:
                product = Product(name=name, barcode=barcode, cost_price=cost_price, sale_price=sale_price)
                db.add(product)
                db.flush()

            inv = db.query(Inventory).filter(Inventory.product_id == product.product_id).first()
            new_stock = safe_int(row.get('stock', 0))
            new_critical = safe_int(row.get('critical_stock', 20), default=20)
            new_expiry = safe_date(row.get('expiry_date')) if 'expiry_date' in cols else None
            if inv:
                inv.stock = new_stock
                inv.critical_stock = new_critical
                inv.expiry_date = new_expiry
            else:
                db.add(Inventory(
                    product_id=product.product_id,
                    stock=new_stock,
                    critical_stock=new_critical,
                    expiry_date=new_expiry
                ))

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

class SuggestRequest(BaseModel):
    product_ids: List[int]

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

@app.get("/products")
def get_products(
    filter: str = "all", search: str = "", sort_by: str = "name",
    sort_order: str = "asc", page: int = 1, per_page: int = 50,
    request: Request = None, db: Session = Depends(get_current_db)
):
    def base_query():
        q = db.query(Product, Inventory).outerjoin(Inventory, Product.product_id == Inventory.product_id)
        if search:
            q = q.filter(
                Product.name.ilike(f"%{search}%") | Product.barcode.ilike(f"%{search}%")
            )
        return q

    def apply_filter(q, f):
        if f == "low":
            return q.filter(Inventory.stock <= Inventory.critical_stock, Inventory.stock > 0)
        elif f == "critical":
            return q.filter(Inventory.stock * 2 <= Inventory.critical_stock)
        elif f == "out_of_stock":
            return q.filter(Inventory.stock == 0)
        return q

    counts = {
        "all":          base_query().count(),
        "low":          apply_filter(base_query(), "low").count(),
        "critical":     apply_filter(base_query(), "critical").count(),
        "out_of_stock": apply_filter(base_query(), "out_of_stock").count(),
    }

    q = apply_filter(base_query(), filter)

    sort_map = {
        "name":        Product.name,
        "stock":       Inventory.stock,
        "sale_price":  Product.sale_price,
        "expiry_date": Inventory.expiry_date,
    }
    col = sort_map.get(sort_by, Product.name)
    q = q.order_by(col.desc() if sort_order == "desc" else col.asc())

    total = q.count()
    rows = q.offset((page - 1) * per_page).limit(per_page).all()

    def status(stock, crit):
        if stock == 0:               return "out_of_stock"
        if stock * 2 <= crit:        return "critical"
        if stock <= crit:            return "low"
        return "ok"

    items = []
    for p, inv in rows:
        stk  = inv.stock          if inv else 0
        crit = inv.critical_stock if inv else 20
        exp  = inv.expiry_date    if inv else None
        items.append({
            "product_id": p.product_id, "name": p.name, "barcode": p.barcode,
            "cost_price": p.cost_price, "sale_price": p.sale_price,
            "stock": stk, "critical_stock": crit,
            "expiry_date": str(exp) if exp else None,
            "stock_status": status(stk, crit),
        })

    return {"items": items, "total": total, "page": page, "counts": counts}


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

@app.put("/products/{product_id}")
def update_product(product_id: int, body: UpdateProductRequest, request: Request, db: Session = Depends(get_current_db)):
    try:
        product = db.query(Product).filter(Product.product_id == product_id).first()
        if not product:
            raise HTTPException(404, "Product not found")
        inv = db.query(Inventory).filter(Inventory.product_id == product_id).first()

        if body.sale_price is not None:
            product.sale_price = body.sale_price
        if body.cost_price is not None:
            product.cost_price = body.cost_price

        if inv:
            if body.stock is not None:
                inv.stock = body.stock
            if body.critical_stock is not None:
                inv.critical_stock = body.critical_stock

        db.commit()
        return {
            "product_id": product.product_id,
            "name": product.name,
            "sale_price": product.sale_price,
            "cost_price": product.cost_price,
            "stock": inv.stock if inv else 0,
            "critical_stock": inv.critical_stock if inv else 20,
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] PUT /products/{product_id} failed:\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/products/{product_id}")
def delete_product(product_id: int, request: Request, db: Session = Depends(get_current_db)):
    user_id = get_user_id(request)
    product = db.query(Product).filter(Product.product_id == product_id).first()
    if not product:
        raise HTTPException(404, "Product not found")
    name = product.name
    db.delete(product)
    _audit(db, user_id, "product_deleted", "product", product_id, {"name": name})
    db.commit()
    return {"success": True}

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
    try:
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
    except Exception as e:
        print(f"[ERROR] GET /patients failed:\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/patients")
def create_patient(body: PatientCreate, request: Request, db: Session = Depends(get_current_db)):
    print(f"[POST /patients] {body.first_name} {body.last_name}, tc_no={body.tc_no!r}")
    patient = Patient(
        first_name=body.first_name.strip(),
        last_name=body.last_name.strip(),
        tc_no=body.tc_no.strip() if body.tc_no and body.tc_no.strip() else None,
        phone=body.phone.strip() if body.phone and body.phone.strip() else None,
        notes=body.notes,
        birthdate=date.fromisoformat(body.birthdate) if body.birthdate else None
    )
    db.add(patient)
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    db.refresh(patient)
    _audit(db, get_user_id(request), "create_patient", "patient", patient.id)
    db.commit()
    print(f"[POST /patients] created id={patient.id}")
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
    try:
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
    except Exception as e:
        print(f"[ERROR] GET /prescriptions failed:\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/prescriptions")
def create_prescription(body: PrescriptionCreate, request: Request, db: Session = Depends(get_current_db)):
    print(f"[POST /prescriptions] Received: patient_id={body.patient_id}, doctor_id={body.doctor_id}, items={len(body.items)}, confirm={body.confirm_immediately}")
    try:
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
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] POST /prescriptions failed:\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/prescriptions/suggest")
def suggest_prescription(body: SuggestRequest, request: Request, db: Session = Depends(get_current_db)):
    return suggest_for_prescription(db, body.product_ids)


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

    total_requested = 0
    total_dispensed = 0
    dispensed_items = []
    partial_items = []
    out_of_stock_items = []

    for item in rx.items:
        requested = item.quantity_requested or 1
        total_requested += requested
        inv = db.query(Inventory).filter(Inventory.product_id == item.product_id).first()
        product_name = item.product.name if item.product else f"Product {item.product_id}"

        if not inv or inv.stock == 0:
            item.quantity_dispensed = 0
            item.status = "out_of_stock"
            out_of_stock_items.append(product_name)
            db.add(Notification(
                type="stock_critical", product_id=item.product_id,
                product_name=product_name,
                message=f"Out of stock during dispense: {product_name} (Rx #{rx.rx_number})",
                is_read=False
            ))
        elif inv.stock >= requested:
            inv.stock -= requested
            item.quantity_dispensed = requested
            item.status = "dispensed"
            total_dispensed += requested
            dispensed_items.append(product_name)
            db.add(Sale(product_id=item.product_id, date=date.today(),
                        quantity=requested, prescription_id=rx.id))
        else:
            qty = inv.stock
            inv.stock = 0
            item.quantity_dispensed = qty
            item.status = "partial"
            total_dispensed += qty
            partial_items.append({"name": product_name, "dispensed": qty, "requested": requested})
            db.add(Sale(product_id=item.product_id, date=date.today(),
                        quantity=qty, prescription_id=rx.id))
            db.add(Notification(
                type="stock_critical", product_id=item.product_id,
                product_name=product_name,
                message=f"Partial dispense: {product_name} — {qty}/{requested} units (Rx #{rx.rx_number})",
                is_read=False
            ))

    fulfillment_rate = round(total_dispensed / total_requested * 100, 1) if total_requested > 0 else 0.0

    if fulfillment_rate == 100:
        rx.status = "dispensed"
    elif fulfillment_rate == 0:
        rx.status = "cancelled"
    else:
        rx.status = "partial"

    rx.dispensed_at = datetime.now()
    db.commit()
    _audit(db, user_id, "confirm_prescription", "prescription", rx.id)
    db.commit()

    return {
        "id": rx.id,
        "rx_number": rx.rx_number,
        "status": rx.status,
        "fulfillment_rate": fulfillment_rate,
        "dispensed_items": dispensed_items,
        "partial_items": partial_items,
        "out_of_stock_items": out_of_stock_items,
    }

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
def get_audit_log(
    action: str = "", from_date: str = "", to_date: str = "", search: str = "",
    page: int = 1, per_page: int = 20,
    request: Request = None, db: Session = Depends(get_current_db)
):
    q = db.query(AuditLog)
    if action:
        q = q.filter(AuditLog.action == action)
    if from_date:
        try:
            q = q.filter(AuditLog.created_at >= datetime.strptime(from_date, "%Y-%m-%d"))
        except ValueError:
            pass
    if to_date:
        try:
            q = q.filter(AuditLog.created_at < datetime.strptime(to_date, "%Y-%m-%d") + timedelta(days=1))
        except ValueError:
            pass
    if search:
        q = q.filter(AuditLog.entity_type.ilike(f"%{search}%"))
    total = q.count()
    offset = (page - 1) * per_page
    logs = q.order_by(AuditLog.created_at.desc()).offset(offset).limit(per_page).all()
    return {
        "items": [{
            "id": l.id, "action": l.action, "entity_type": l.entity_type,
            "entity_id": l.entity_id, "details": l.details,
            "created_at": l.created_at.isoformat() if l.created_at else None
        } for l in logs],
        "total": total,
        "page": page,
        "per_page": per_page
    }


# ─── Demo Data Seeder ──────────────────────────────────────────────────────────

def _seed_demo_data(db: Session) -> dict:
    today = date.today()

    PRODUCTS = [
        {"name": "Parol 500mg",          "barcode": "8699514010016", "cost": 8.50,  "sale": 12.00, "stock": 45, "critical": 20, "expiry": None},
        {"name": "Parol Forte 500mg",    "barcode": "8699514010023", "cost": 12.00, "sale": 18.00, "stock": 3,  "critical": 20, "expiry": today + timedelta(days=30)},
        {"name": "Augmentin 1g",         "barcode": "8699522090054", "cost": 85.00, "sale": 120.00,"stock": 22, "critical": 20, "expiry": None},
        {"name": "Amoksisilin 500mg",    "barcode": "8699514020015", "cost": 25.00, "sale": 38.00, "stock": 0,  "critical": 20, "expiry": None},
        {"name": "İbuprofen 400mg",      "barcode": "8699514030014", "cost": 15.00, "sale": 22.00, "stock": 8,  "critical": 10, "expiry": None},
        {"name": "Aspirin 100mg",        "barcode": "8699514040013", "cost": 10.00, "sale": 15.00, "stock": 67, "critical": 20, "expiry": None},
        {"name": "Pantoprazol 40mg",     "barcode": "8699514050012", "cost": 28.00, "sale": 42.00, "stock": 31, "critical": 20, "expiry": None},
        {"name": "Metformin 1000mg",     "barcode": "8699514060011", "cost": 18.00, "sale": 27.00, "stock": 14, "critical": 20, "expiry": None},
        {"name": "Atorvastatin 20mg",    "barcode": "8699514070010", "cost": 35.00, "sale": 52.00, "stock": 19, "critical": 20, "expiry": None},
        {"name": "Vitamin D3 1000IU",    "barcode": "8699514080019", "cost": 22.00, "sale": 33.00, "stock": 88, "critical": 20, "expiry": None},
        {"name": "Vitamin C 1000mg",     "barcode": "8699514090018", "cost": 12.00, "sale": 18.00, "stock": 120,"critical": 20, "expiry": None},
        {"name": "Omega-3 1000mg",       "barcode": "8699514100014", "cost": 45.00, "sale": 68.00, "stock": 34, "critical": 20, "expiry": None},
        {"name": "Coumadin 5mg",         "barcode": "8699514110013", "cost": 32.00, "sale": 48.00, "stock": 5,  "critical": 20, "expiry": today + timedelta(days=60)},
        {"name": "Metoprolol 50mg",      "barcode": "8699514120012", "cost": 20.00, "sale": 30.00, "stock": 28, "critical": 20, "expiry": None},
        {"name": "Amlodipin 5mg",        "barcode": "8699514130011", "cost": 18.00, "sale": 27.00, "stock": 41, "critical": 20, "expiry": None},
        {"name": "Losartan 50mg",        "barcode": "8699514140010", "cost": 22.00, "sale": 33.00, "stock": 37, "critical": 20, "expiry": None},
        {"name": "Lansoprazol 30mg",     "barcode": "8699514150019", "cost": 30.00, "sale": 45.00, "stock": 2,  "critical": 15, "expiry": today + timedelta(days=25)},
        {"name": "Sertralin 50mg",       "barcode": "8699514160018", "cost": 28.00, "sale": 42.00, "stock": 16, "critical": 20, "expiry": None},
        {"name": "Parasetamol Şurup",    "barcode": "8699514170017", "cost": 14.00, "sale": 21.00, "stock": 23, "critical": 20, "expiry": None},
        {"name": "Ambroksol Şurup",      "barcode": "8699514180016", "cost": 16.00, "sale": 24.00, "stock": 18, "critical": 20, "expiry": None},
        {"name": "Desloratadin 5mg",     "barcode": "8699514190015", "cost": 24.00, "sale": 36.00, "stock": 29, "critical": 20, "expiry": None},
        {"name": "Montelukast 10mg",     "barcode": "8699514200018", "cost": 38.00, "sale": 57.00, "stock": 11, "critical": 20, "expiry": None},
        {"name": "Diklofenak 75mg",      "barcode": "8699514210017", "cost": 20.00, "sale": 30.00, "stock": 44, "critical": 20, "expiry": None},
        {"name": "Tramadol 100mg",       "barcode": "8699514220016", "cost": 35.00, "sale": 52.00, "stock": 7,  "critical": 10, "expiry": None},
        {"name": "Metilprednizolon 16mg","barcode": "8699514230015", "cost": 42.00, "sale": 63.00, "stock": 13, "critical": 20, "expiry": None},
        {"name": "Esomeprazol 40mg",     "barcode": "8699514240014", "cost": 32.00, "sale": 48.00, "stock": 26, "critical": 20, "expiry": None},
        {"name": "Klaritromisin 500mg",  "barcode": "8699514250013", "cost": 55.00, "sale": 82.00, "stock": 9,  "critical": 20, "expiry": None},
        {"name": "Siprofloksasin 500mg", "barcode": "8699514260012", "cost": 30.00, "sale": 45.00, "stock": 33, "critical": 20, "expiry": None},
        {"name": "B12 Vitamini 1000mcg", "barcode": "8699514270011", "cost": 18.00, "sale": 27.00, "stock": 56, "critical": 20, "expiry": None},
        {"name": "Probiyotik Kapsül",    "barcode": "8699514280010", "cost": 40.00, "sale": 60.00, "stock": 42, "critical": 20, "expiry": None},
    ]

    PATIENTS = [
        {"first_name": "Ahmet",   "last_name": "Yılmaz",  "tc_no": "12345678901", "phone": "0532 111 2233"},
        {"first_name": "Fatma",   "last_name": "Kaya",    "tc_no": "23456789012", "phone": "0541 222 3344"},
        {"first_name": "Mehmet",  "last_name": "Demir",   "tc_no": "34567890123", "phone": "0505 333 4455"},
        {"first_name": "Ayşe",    "last_name": "Çelik",   "tc_no": "45678901234", "phone": "0553 444 5566"},
        {"first_name": "Mustafa", "last_name": "Şahin",   "tc_no": "56789012345", "phone": "0542 555 6677"},
        {"first_name": "Zeynep",  "last_name": "Arslan",  "tc_no": "67890123456", "phone": "0535 666 7788"},
        {"first_name": "Ali",     "last_name": "Koç",     "tc_no": "78901234567", "phone": "0544 777 8899"},
        {"first_name": "Emine",   "last_name": "Yıldız",  "tc_no": "89012345678", "phone": "0506 888 9900"},
        {"first_name": "Hasan",   "last_name": "Öztürk",  "tc_no": "90123456789", "phone": "0551 999 0011"},
        {"first_name": "Hatice",  "last_name": "Güneş",   "tc_no": "10234567890", "phone": "0538 000 1122"},
    ]

    DOCTORS = [
        {"first_name": "Kemal",  "last_name": "Aydın",  "specialty": "Dahiliye",            "hospital": "Ankara Şehir Hastanesi",       "license_no": "DR001"},
        {"first_name": "Selin",  "last_name": "Kara",   "specialty": "Kardiyoloji",          "hospital": "Hacettepe Üniversitesi",        "license_no": "DR002"},
        {"first_name": "Burak",  "last_name": "Doğan",  "specialty": "Nöroloji",             "hospital": "Gazi Üniversitesi",             "license_no": "DR003"},
        {"first_name": "Merve",  "last_name": "Yılmaz", "specialty": "Endokrinoloji",        "hospital": "Ankara Numune Hastanesi",       "license_no": "DR004"},
        {"first_name": "Tarık",  "last_name": "Şen",    "specialty": "Göğüs Hastalıkları",   "hospital": "Atatürk Göğüs Hastalıkları",   "license_no": "DR005"},
    ]

    # Upsert products
    product_id_map = {}
    products_seeded = 0
    for p in PRODUCTS:
        existing = db.query(Product).filter(Product.name == p["name"]).first()
        if existing:
            existing.cost_price = p["cost"]
            existing.sale_price = p["sale"]
            existing.barcode = p["barcode"]
            product = existing
        else:
            product = Product(name=p["name"], barcode=p["barcode"], cost_price=p["cost"], sale_price=p["sale"])
            db.add(product)
            db.flush()
            products_seeded += 1
        inv = db.query(Inventory).filter(Inventory.product_id == product.product_id).first()
        if inv:
            inv.stock = p["stock"]
            inv.critical_stock = p["critical"]
            inv.expiry_date = p["expiry"]
        else:
            db.add(Inventory(product_id=product.product_id, stock=p["stock"], critical_stock=p["critical"], expiry_date=p["expiry"]))
        product_id_map[p["name"]] = product.product_id
    db.commit()

    # Upsert patients
    patients_seeded = 0
    for pat in PATIENTS:
        if not db.query(Patient).filter(Patient.tc_no == pat["tc_no"]).first():
            db.add(Patient(**pat))
            patients_seeded += 1
    db.commit()

    # Upsert doctors
    doctors_seeded = 0
    for doc in DOCTORS:
        if not db.query(Doctor).filter(Doctor.license_no == doc["license_no"]).first():
            db.add(Doctor(**doc))
            doctors_seeded += 1
    db.commit()

    # Seed sales
    all_product_ids = list(product_id_map.values())

    def rand_date(days_back=180):
        return today - timedelta(days=random.randint(0, days_back))

    sales_to_add = []

    # Paired baskets for cross-sell signal
    pairs = [
        ("Aspirin 100mg",     "Pantoprazol 40mg",   30),
        ("Amoksisilin 500mg", "Probiyotik Kapsül",  25),
        ("Metformin 1000mg",  "B12 Vitamini 1000mcg", 20),
        ("İbuprofen 400mg",   "Esomeprazol 40mg",   15),
    ]
    for name_a, name_b, count in pairs:
        pid_a = product_id_map.get(name_a)
        pid_b = product_id_map.get(name_b)
        if not pid_a or not pid_b:
            continue
        for _ in range(count):
            d = rand_date()
            sales_to_add.append(Sale(product_id=pid_a, date=d, quantity=random.randint(1, 3)))
            sales_to_add.append(Sale(product_id=pid_b, date=d, quantity=random.randint(1, 2)))

    # Random individual sales to reach ~200 total
    random_count = max(0, 200 - len(sales_to_add))
    for _ in range(random_count):
        sales_to_add.append(Sale(
            product_id=random.choice(all_product_ids),
            date=rand_date(),
            quantity=random.randint(1, 5)
        ))

    for s in sales_to_add:
        db.add(s)
    db.commit()

    _check_and_create_notifications(db)

    return {
        "success": True,
        "products": db.query(Product).count(),
        "patients": db.query(Patient).count(),
        "doctors": db.query(Doctor).count(),
        "sales": db.query(Sale).count(),
    }


@app.get("/seed-demo-data")
def seed_demo_data(request: Request, db: Session = Depends(get_current_db)):
    return _seed_demo_data(db)
