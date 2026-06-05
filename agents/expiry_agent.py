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
