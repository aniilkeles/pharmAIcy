import pandas as pd
import numpy as np
from sqlalchemy.orm import Session
from backend.models import Product, Sale, Inventory
from datetime import datetime, timedelta

def analyze_sales(db: Session) -> dict:
    sales = db.query(Sale).all()
    if not sales:
        return {
            "top_products": [],
            "daily_revenue": [],
            "weekly_revenue": 0,
            "total_revenue": 0,
            "total_sales": 0
        }

    records = []
    for s in sales:
        product = db.query(Product).filter(Product.product_id == s.product_id).first()
        if product:
            records.append({
                "product_id": s.product_id,
                "product_name": product.name,
                "date": s.date,
                "quantity": s.quantity,
                "revenue": s.quantity * product.sale_price
            })

    df = pd.DataFrame(records)
    if df.empty:
        return {"top_products": [], "daily_revenue": [], "weekly_revenue": 0, "total_revenue": 0, "total_sales": 0}

    df["date"] = pd.to_datetime(df["date"])

    top = df.groupby(["product_id", "product_name"])["revenue"].sum().reset_index()
    top = top.sort_values("revenue", ascending=False).head(10)
    top_products = top.to_dict(orient="records")

    daily = df.groupby(df["date"].dt.date)["revenue"].sum().reset_index()
    daily.columns = ["date", "revenue"]
    daily = daily.sort_values("date").tail(30)
    daily["date"] = daily["date"].astype(str)
    daily_revenue = daily.to_dict(orient="records")

    cutoff = datetime.now() - timedelta(days=7)
    weekly_df = df[df["date"] >= cutoff]
    weekly_revenue = float(weekly_df["revenue"].sum())
    total_revenue = float(df["revenue"].sum())
    total_sales = int(df["quantity"].sum())

    return {
        "top_products": top_products,
        "daily_revenue": daily_revenue,
        "weekly_revenue": round(weekly_revenue, 2),
        "total_revenue": round(total_revenue, 2),
        "total_sales": total_sales
    }

def get_low_stock(db: Session) -> list:
    results = []
    inventories = db.query(Inventory).all()
    for inv in inventories:
        if inv.stock <= inv.critical_stock:
            product = db.query(Product).filter(Product.product_id == inv.product_id).first()
            if product:
                results.append({
                    "product_id": inv.product_id,
                    "name": product.name,
                    "stock": inv.stock,
                    "critical_stock": inv.critical_stock,
                    "sale_price": product.sale_price,
                    "status": "critical" if inv.stock <= inv.critical_stock // 2 else "warning"
                })
    return sorted(results, key=lambda x: x["stock"])
