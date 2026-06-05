import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import random
import os

random.seed(42)
np.random.seed(42)

PRODUCTS = [
    {"name": "Parol 500mg Tablet", "barcode": "8699514010016", "cost": 8.50, "sale": 14.90},
    {"name": "Augmentin 1000mg Tablet", "barcode": "8699522090054", "cost": 45.00, "sale": 78.50},
    {"name": "Nurofen 400mg Tablet", "barcode": "8699514090015", "cost": 12.00, "sale": 21.90},
    {"name": "Aspirin 500mg Tablet", "barcode": "8699546090012", "cost": 5.00, "sale": 9.90},
    {"name": "Amoxicillin 500mg Kapsül", "barcode": "8699514020011", "cost": 28.00, "sale": 48.90},
    {"name": "Cipro 500mg Tablet", "barcode": "8699514030010", "cost": 35.00, "sale": 61.50},
    {"name": "Metformin 850mg Tablet", "barcode": "8699514040019", "cost": 18.00, "sale": 32.00},
    {"name": "Lisinopril 10mg Tablet", "barcode": "8699514050018", "cost": 22.00, "sale": 39.90},
    {"name": "Atorvastatin 20mg Tablet", "barcode": "8699514060017", "cost": 30.00, "sale": 54.90},
    {"name": "Omeprazol 20mg Kapsül", "barcode": "8699514070016", "cost": 15.00, "sale": 27.50},
    {"name": "Ventolin 100mcg İnhaler", "barcode": "8699546020015", "cost": 55.00, "sale": 95.00},
    {"name": "Vitamin D3 1000IU Kapsül", "barcode": "8699522010016", "cost": 20.00, "sale": 36.90},
    {"name": "Omega-3 1000mg Kapsül", "barcode": "8699522020015", "cost": 35.00, "sale": 62.90},
    {"name": "Magnesium 400mg Tablet", "barcode": "8699522030014", "cost": 18.00, "sale": 33.50},
    {"name": "Zinc 15mg Tablet", "barcode": "8699522040013", "cost": 12.00, "sale": 22.90},
    {"name": "Vitamin C 1000mg Efervesan", "barcode": "8699522050012", "cost": 16.00, "sale": 29.90},
    {"name": "Multivitamin Tablet", "barcode": "8699522060011", "cost": 25.00, "sale": 45.90},
    {"name": "Probiyotik Kapsül", "barcode": "8699522070010", "cost": 40.00, "sale": 72.90},
    {"name": "Ibuprofen 400mg Tablet", "barcode": "8699546030014", "cost": 10.00, "sale": 18.90},
    {"name": "Diklofenak Jel 50g", "barcode": "8699546040013", "cost": 25.00, "sale": 44.90},
    {"name": "Betadin Solüsyon 100ml", "barcode": "8699546050012", "cost": 30.00, "sale": 52.90},
    {"name": "Panthenol Krem 100g", "barcode": "8699546060011", "cost": 22.00, "sale": 39.90},
    {"name": "Hirudoid Krem 40g", "barcode": "8699546070010", "cost": 35.00, "sale": 62.90},
    {"name": "Fucidin Krem 15g", "barcode": "8699546080019", "cost": 28.00, "sale": 49.90},
    {"name": "Hydrocortison Krem 15g", "barcode": "8699546090018", "cost": 18.00, "sale": 33.90},
    {"name": "Ranitidin 150mg Tablet", "barcode": "8699546100013", "cost": 12.00, "sale": 22.90},
    {"name": "Lansoprazol 30mg Kapsül", "barcode": "8699546110012", "cost": 20.00, "sale": 36.90},
    {"name": "Domperidon 10mg Tablet", "barcode": "8699546120011", "cost": 15.00, "sale": 27.90},
    {"name": "Loperamid 2mg Kapsül", "barcode": "8699546130010", "cost": 10.00, "sale": 19.90},
    {"name": "Cetirizin 10mg Tablet", "barcode": "8699546140019", "cost": 14.00, "sale": 25.90},
    {"name": "Loratadin 10mg Tablet", "barcode": "8699546150018", "cost": 12.00, "sale": 22.90},
    {"name": "Desloratadin 5mg Tablet", "barcode": "8699546160017", "cost": 22.00, "sale": 39.90},
    {"name": "Montelukast 10mg Tablet", "barcode": "8699546170016", "cost": 35.00, "sale": 62.90},
    {"name": "Budesonid Inhaler 200mcg", "barcode": "8699546180015", "cost": 65.00, "sale": 115.00},
    {"name": "Sertralin 50mg Tablet", "barcode": "8699546190014", "cost": 28.00, "sale": 49.90},
    {"name": "Escitalopram 10mg Tablet", "barcode": "8699546200019", "cost": 35.00, "sale": 62.90},
    {"name": "Alprazolam 0.25mg Tablet", "barcode": "8699546210018", "cost": 18.00, "sale": 32.90},
    {"name": "Melatonin 3mg Tablet", "barcode": "8699546220017", "cost": 22.00, "sale": 39.90},
    {"name": "Biotin 5mg Tablet", "barcode": "8699546230016", "cost": 20.00, "sale": 36.90},
    {"name": "Collagen Kapsül 500mg", "barcode": "8699546240015", "cost": 45.00, "sale": 79.90},
    {"name": "B12 Vitamini 1000mcg", "barcode": "8699546250014", "cost": 15.00, "sale": 27.90},
    {"name": "Demir Tablet 100mg", "barcode": "8699546260013", "cost": 12.00, "sale": 22.90},
    {"name": "Kalsiyum 600mg Tablet", "barcode": "8699546270012", "cost": 18.00, "sale": 32.90},
    {"name": "Coenzyme Q10 100mg", "barcode": "8699546280011", "cost": 55.00, "sale": 97.90},
    {"name": "Resveratrol 100mg Kapsül", "barcode": "8699546290010", "cost": 60.00, "sale": 105.90},
    {"name": "Turmeric 500mg Kapsül", "barcode": "8699546300015", "cost": 30.00, "sale": 54.90},
    {"name": "Echinacea Kapsül 400mg", "barcode": "8699546310014", "cost": 25.00, "sale": 44.90},
    {"name": "Elderberry Şurup 150ml", "barcode": "8699546320013", "cost": 35.00, "sale": 62.90},
    {"name": "Melatonin Efervesan 5mg", "barcode": "8699546330012", "cost": 28.00, "sale": 49.90},
    {"name": "Magnesium Glikonat 500mg", "barcode": "8699546340011", "cost": 22.00, "sale": 39.90},
]

today = datetime.now().date()

def generate_stock(i):
    base = random.randint(0, 200)
    if i % 8 == 0:
        return random.randint(0, 10)
    if i % 5 == 0:
        return random.randint(10, 25)
    return base

def generate_expiry(i):
    if i % 7 == 0:
        days = random.randint(5, 25)
    elif i % 4 == 0:
        days = random.randint(31, 89)
    else:
        days = random.randint(90, 730)
    return (today + timedelta(days=days)).isoformat()

rows = []
for i, p in enumerate(PRODUCTS):
    stock = generate_stock(i)
    critical_stock = 20
    rows.append({
        "name": p["name"],
        "barcode": p["barcode"],
        "cost_price": p["cost"],
        "sale_price": p["sale"],
        "stock": stock,
        "critical_stock": critical_stock,
        "expiry_date": generate_expiry(i)
    })

df = pd.DataFrame(rows)
os.makedirs("data", exist_ok=True)
df.to_csv("data/pharmacy_dataset.csv", index=False)
print(f"Generated pharmacy_dataset.csv with {len(df)} products")

# Generate synthetic sales data
sales_rows = []
product_ids = list(range(1, len(PRODUCTS) + 1))
for _ in range(1000):
    pid = random.choice(product_ids)
    days_ago = random.randint(0, 180)
    sale_date = (today - timedelta(days=days_ago)).isoformat()
    qty = random.randint(1, 10)
    sales_rows.append({"product_id": pid, "date": sale_date, "quantity": qty})

sales_df = pd.DataFrame(sales_rows)
sales_df.to_csv("data/synthetic_sales.csv", index=False)
print(f"Generated synthetic_sales.csv with {len(sales_df)} sales records")

template_df = pd.DataFrame(columns=["name", "barcode", "cost_price", "sale_price", "stock", "critical_stock", "expiry_date"])
template_df.to_csv("data/sample_template.csv", index=False)
print("Generated sample_template.csv")
