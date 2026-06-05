import os
import io
import csv
import json
import base64
import pandas as pd
from datetime import datetime, date, timedelta
from typing import Optional
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from dotenv import load_dotenv

load_dotenv()

from backend.database import engine, get_db, Base
from backend.models import Product, Inventory, Sale, Notification

Base.metadata.create_all(bind=engine)

from agents.data_agent import analyze_sales, get_low_stock
from agents.prediction_agent import predict_sales, train_model
from agents.interaction_agent import find_cross_sell
from agents.expiry_agent import get_expiring
from agents.decision_agent import aggregate_context, get_decisions, chat

app = FastAPI(title="PharmAIcy API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# ─── Pydantic Models ───────────────────────────────────────────────────────────

class UploadDataRequest(BaseModel):
    csv_bytes: str  # base64-encoded raw file bytes

class ChatRequest(BaseModel):
    message: str
    context: Optional[dict] = None

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

# ─── Notification helpers ──────────────────────────────────────────────────────

def _check_and_create_notifications(db: Session):
    today = date.today()
    inventories = db.query(Inventory).all()

    for inv in inventories:
        product = db.query(Product).filter(Product.product_id == inv.product_id).first()
        if not product:
            continue

        # Stock notifications
        if inv.stock <= inv.critical_stock // 2:
            existing = db.query(Notification).filter(
                Notification.type == "stock_critical",
                Notification.product_id == inv.product_id,
                Notification.is_read == False
            ).first()
            if not existing:
                notif = Notification(
                    type="stock_critical",
                    product_id=inv.product_id,
                    product_name=product.name,
                    message=f"CRITICAL: {product.name} has only {inv.stock} units left (threshold: {inv.critical_stock})",
                    is_read=False
                )
                db.add(notif)
        elif inv.stock <= inv.critical_stock:
            existing = db.query(Notification).filter(
                Notification.type == "stock_warning",
                Notification.product_id == inv.product_id,
                Notification.is_read == False
            ).first()
            if not existing:
                notif = Notification(
                    type="stock_warning",
                    product_id=inv.product_id,
                    product_name=product.name,
                    message=f"Low stock: {product.name} has {inv.stock} units (threshold: {inv.critical_stock})",
                    is_read=False
                )
                db.add(notif)

        # Expiry notifications
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
                    notif = Notification(
                        type="expiry_urgent",
                        product_id=inv.product_id,
                        product_name=product.name,
                        message=f"URGENT: {product.name} expires in {days_left} days ({expiry})",
                        is_read=False
                    )
                    db.add(notif)
            elif days_left <= 90:
                existing = db.query(Notification).filter(
                    Notification.type == "expiry_warning",
                    Notification.product_id == inv.product_id,
                    Notification.is_read == False
                ).first()
                if not existing:
                    notif = Notification(
                        type="expiry_warning",
                        product_id=inv.product_id,
                        product_name=product.name,
                        message=f"Expiry warning: {product.name} expires in {days_left} days ({expiry})",
                        is_read=False
                    )
                    db.add(notif)

    db.commit()

# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/agent-status")
def agent_status():
    return {
        "status": "ok",
        "agents": {
            "data_agent": "ready",
            "prediction_agent": "ready",
            "interaction_agent": "ready",
            "expiry_agent": "ready",
            "decision_agent": "ready"
        },
        "timestamp": datetime.now().isoformat()
    }

@app.post("/upload-data")
def upload_data(request: UploadDataRequest, db: Session = Depends(get_db)):
    try:
        raw_bytes = base64.b64decode(request.csv_bytes)

        # Try encodings in order until one parses cleanly
        df = None
        encoding_used = None
        for enc in ['utf-8', 'utf-8-sig', 'latin-1', 'cp1252', 'iso-8859-1']:
            try:
                df = pd.read_csv(io.BytesIO(raw_bytes), encoding=enc, dtype=str)
                encoding_used = enc
                break
            except Exception:
                continue

        if df is None or df.empty:
            raise HTTPException(status_code=400, detail="File is empty or could not be read")

        df.columns = df.columns.str.strip().str.lstrip('﻿')
        print(f"Encoding used: {encoding_used}")
        print(f"CSV columns received: {df.columns.tolist()}")

        cols = set(df.columns)
        if 'name' not in cols:
            raise HTTPException(status_code=400, detail=f"Required column 'name' not found. Got: {sorted(cols)}")

        def safe_float(val, default=0.0):
            try:
                return float(str(val).strip().replace(',', '.'))
            except (ValueError, TypeError):
                return default

        def safe_int(val, default=0):
            try:
                return int(float(str(val).strip().replace(',', '.')))
            except (ValueError, TypeError):
                return default

        def safe_date(val):
            if pd.isna(val) or str(val).strip() in ('', 'None', 'nan'):
                return None
            s = str(val).strip()
            for fmt in ['%Y-%m-%d', '%d/%m/%Y', '%d.%m.%Y', '%m/%d/%Y', '%d-%m-%Y']:
                try:
                    return datetime.strptime(s, fmt).date()
                except ValueError:
                    continue
            return None

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
def export_data(db: Session = Depends(get_db)):
    products = db.query(Product).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["product_id", "name", "barcode", "cost_price", "sale_price", "stock", "critical_stock", "expiry_date"])

    for p in products:
        inv = db.query(Inventory).filter(Inventory.product_id == p.product_id).first()
        writer.writerow([
            p.product_id,
            p.name,
            p.barcode or "",
            p.cost_price,
            p.sale_price,
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

@app.post("/analyze-sales")
def analyze_sales_endpoint(db: Session = Depends(get_db)):
    return analyze_sales(db)

@app.post("/predict-sales")
def predict_sales_endpoint(db: Session = Depends(get_db)):
    return predict_sales(db)

@app.get("/low-stock")
def low_stock_endpoint(db: Session = Depends(get_db)):
    return get_low_stock(db)

@app.get("/expiry-products")
def expiry_products_endpoint(db: Session = Depends(get_db)):
    return get_expiring(db)

@app.get("/cross-sell")
def cross_sell_endpoint(db: Session = Depends(get_db)):
    return find_cross_sell(db)

@app.get("/decisions")
def decisions_endpoint(db: Session = Depends(get_db)):
    context = aggregate_context(db)
    decisions = get_decisions(context)
    return {"decisions": decisions}

@app.post("/chat")
def chat_endpoint(request: ChatRequest, db: Session = Depends(get_db)):
    context = request.context or {}
    if not context:
        context = aggregate_context(db)
    response = chat(request.message, context)
    return {"response": response}

@app.get("/dashboard-summary")
def dashboard_summary(db: Session = Depends(get_db)):
    product_count = db.query(Product).count()
    if product_count == 0:
        return {
            "has_data": False,
            "product_count": 0,
            "sales": None,
            "low_stock_count": 0,
            "expiry_count": 0,
            "unread_notifications": 0
        }

    sales = analyze_sales(db)
    low_stock = get_low_stock(db)
    expiring = get_expiring(db)
    unread = db.query(Notification).filter(Notification.is_read == False).count()

    return {
        "has_data": True,
        "product_count": product_count,
        "sales": sales,
        "low_stock_count": len(low_stock),
        "low_stock": low_stock[:5],
        "expiry_count": len(expiring),
        "expiring": expiring[:5],
        "unread_notifications": unread
    }

@app.get("/notifications")
def get_notifications(db: Session = Depends(get_db)):
    notifs = db.query(Notification).order_by(
        Notification.is_read.asc(),
        Notification.created_at.desc()
    ).all()
    return [{
        "id": n.id,
        "type": n.type,
        "product_id": n.product_id,
        "product_name": n.product_name,
        "message": n.message,
        "is_read": n.is_read,
        "created_at": n.created_at.isoformat() if n.created_at else None
    } for n in notifs]

@app.post("/notifications/read")
def mark_notification_read(request: NotificationReadRequest, db: Session = Depends(get_db)):
    notif = db.query(Notification).filter(Notification.id == request.id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.is_read = True
    db.commit()
    return {"success": True}

@app.post("/notifications/read-all")
def mark_all_read(db: Session = Depends(get_db)):
    db.query(Notification).filter(Notification.is_read == False).update({"is_read": True})
    db.commit()
    return {"success": True}

@app.get("/notifications/unread-count")
def unread_count(db: Session = Depends(get_db)):
    count = db.query(Notification).filter(Notification.is_read == False).count()
    return {"count": count}

@app.post("/notifications/check")
def check_notifications(db: Session = Depends(get_db)):
    _check_and_create_notifications(db)
    count = db.query(Notification).filter(Notification.is_read == False).count()
    return {"message": "Notification check complete", "unread_count": count}

@app.post("/barcode-lookup")
def barcode_lookup(request: BarcodeRequest, db: Session = Depends(get_db)):
    barcode = request.barcode.strip()
    product = db.query(Product).filter(Product.barcode == barcode).first()

    if not product:
        return {"found": False, "barcode": barcode, "message": "Product not found in inventory"}

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
        "found": True,
        "product_name": product.name,
        "barcode": product.barcode,
        "stock": stock,
        "critical_stock": critical_stock,
        "sale_price": product.sale_price,
        "cost_price": product.cost_price,
        "expiry_date": str(inv.expiry_date) if inv and inv.expiry_date else None,
        "stock_status": stock_status
    }

@app.post("/products/add")
def add_product(request: AddProductRequest, db: Session = Depends(get_db)):
    product = Product(
        name=request.name,
        barcode=request.barcode,
        cost_price=request.cost_price,
        sale_price=request.sale_price
    )
    db.add(product)
    db.flush()

    expiry_date = None
    if request.expiry_date:
        try:
            expiry_date = date.fromisoformat(request.expiry_date)
        except ValueError:
            pass

    inv = Inventory(
        product_id=product.product_id,
        stock=request.stock,
        critical_stock=request.critical_stock,
        expiry_date=expiry_date
    )
    db.add(inv)
    db.commit()

    return {
        "success": True,
        "product_id": product.product_id,
        "message": f"Product '{request.name}' added successfully"
    }
