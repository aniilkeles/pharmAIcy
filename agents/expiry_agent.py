from sqlalchemy.orm import Session
from backend.models import Product, Inventory
from datetime import datetime, timedelta, date


def get_expiring(db: Session, days: int = 90) -> list:
    today = date.today()
    cutoff = today + timedelta(days=days)
    results = []

    inventories = db.query(Inventory).all()
    for inv in inventories:
        if inv.expiry_date is None:
            continue
        expiry = inv.expiry_date
        if isinstance(expiry, str):
            expiry = date.fromisoformat(expiry)

        if expiry <= cutoff:
            product = db.query(Product).filter(Product.product_id == inv.product_id).first()
            if not product:
                continue

            days_until = (expiry - today).days
            if days_until < 0:
                category = "expired"
            elif days_until <= 30:
                category = "urgent"
            else:
                category = "warning"

            results.append({
                "product_id": inv.product_id,
                "name": product.name,
                "expiry_date": str(expiry),
                "days_until_expiry": days_until,
                "stock": inv.stock,
                "category": category,
                "sale_price": product.sale_price
            })

    return sorted(results, key=lambda x: x["days_until_expiry"])


def get_fefo_suggestion(db: Session, product_id: int) -> dict:
    inv = db.query(Inventory).filter(Inventory.product_id == product_id).first()
    if not inv:
        return {"available": False, "stock": 0, "expiry_date": None, "category": None}

    today = date.today()
    expiry = inv.expiry_date

    result = {
        "available": inv.stock > 0,
        "stock": inv.stock,
        "expiry_date": str(expiry) if expiry else None,
        "lot_number": inv.lot_number,
        "category": None,
        "days_until_expiry": None
    }

    if expiry:
        if isinstance(expiry, str):
            expiry = date.fromisoformat(expiry)
        days_left = (expiry - today).days
        result["days_until_expiry"] = days_left
        if days_left < 0:
            result["category"] = "expired"
        elif days_left <= 30:
            result["category"] = "urgent"
        elif days_left <= 90:
            result["category"] = "warning"
        else:
            result["category"] = "ok"

    return result
