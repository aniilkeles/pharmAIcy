import pandas as pd
from collections import defaultdict
from mlxtend.frequent_patterns import apriori, association_rules
from mlxtend.preprocessing import TransactionEncoder
from sqlalchemy import func
from sqlalchemy.orm import Session
from backend.models import Sale, Product, Inventory
from datetime import datetime, timedelta


def find_cross_sell(db: Session) -> list:
    sales = db.query(Sale).all()
    if not sales:
        return []

    records = [{"product_id": s.product_id, "date": str(s.date)} for s in sales]
    df = pd.DataFrame(records)

    if df.empty:
        return []

    baskets = df.groupby("date")["product_id"].apply(list).tolist()
    baskets = [list(set(b)) for b in baskets if len(b) > 1]

    if len(baskets) < 5:
        return []

    te = TransactionEncoder()
    try:
        te_array = te.fit_transform(baskets)
    except Exception:
        return []

    basket_df = pd.DataFrame(te_array, columns=te.columns_)

    try:
        frequent = apriori(basket_df, min_support=0.02, use_colnames=True)
        if frequent.empty:
            return []

        rules = association_rules(frequent, metric="confidence", min_threshold=0.3)
        if rules.empty:
            return []
    except Exception:
        return []

    results = []
    products_cache = {}
    for _, row in rules.head(20).iterrows():
        antecedents = list(row["antecedents"])
        consequents = list(row["consequents"])

        for pid in antecedents + consequents:
            if pid not in products_cache:
                p = db.query(Product).filter(Product.product_id == pid).first()
                products_cache[pid] = p.name if p else f"Product {pid}"

        results.append({
            "antecedents": [products_cache.get(p, str(p)) for p in antecedents],
            "consequents": [products_cache.get(p, str(p)) for p in consequents],
            "support": round(float(row["support"]), 4),
            "confidence": round(float(row["confidence"]), 4),
            "lift": round(float(row["lift"]), 4)
        })

    return sorted(results, key=lambda x: x["lift"], reverse=True)


def get_prescription_cross_sell(db: Session, prescription_id: int) -> list:
    try:
        from backend.models import Prescription

        rx = db.query(Prescription).filter(Prescription.id == prescription_id).first()
        if not rx or not rx.items:
            return []

        product_ids = [item.product_id for item in rx.items]
        product_names = []
        for pid in product_ids:
            p = db.query(Product).filter(Product.product_id == pid).first()
            if p:
                product_names.append(p.name)

        all_rules = find_cross_sell(db)
        suggestions = []
        seen = set()

        for rule in all_rules:
            if any(ant in product_names for ant in rule["antecedents"]):
                for cons in rule["consequents"]:
                    if cons not in product_names and cons not in seen:
                        seen.add(cons)
                        suggestions.append({
                            "product": cons,
                            "confidence": rule["confidence"],
                            "reason": f"Often bought with {rule['antecedents'][0]}"
                        })

        return suggestions[:5]
    except Exception:
        return []


def suggest_for_prescription(db: Session, product_ids: list) -> list:
    if not product_ids:
        return []

    sales = db.query(Sale).all()

    baskets_dict = defaultdict(set)
    for s in sales:
        key = f"rx_{s.prescription_id}" if s.prescription_id else f"date_{s.date}"
        baskets_dict[key].add(s.product_id)

    all_baskets = [list(b) for b in baskets_dict.values() if len(b) > 1]

    if len(all_baskets) >= 5:
        try:
            te = TransactionEncoder()
            te_array = te.fit_transform(all_baskets)
            basket_df = pd.DataFrame(te_array, columns=te.columns_)
            frequent = apriori(basket_df, min_support=0.02, use_colnames=True)

            if not frequent.empty:
                rules = association_rules(frequent, metric="confidence", min_threshold=0.3)

                if not rules.empty:
                    best = {}
                    for _, row in rules.iterrows():
                        antecedents = set(row["antecedents"])
                        consequents = set(row["consequents"])
                        if antecedents & set(product_ids):
                            for pid in consequents:
                                if pid not in product_ids:
                                    conf = float(row["confidence"])
                                    if pid not in best or best[pid] < conf:
                                        best[pid] = conf

                    result = []
                    for pid, confidence in sorted(best.items(), key=lambda x: x[1], reverse=True):
                        if len(result) >= 5:
                            break
                        p = db.query(Product).filter(Product.product_id == pid).first()
                        if not p:
                            continue
                        inv = db.query(Inventory).filter(Inventory.product_id == pid).first()
                        stock = inv.stock if inv else 0
                        if stock == 0:
                            continue
                        result.append({
                            "product_id": pid,
                            "name": p.name,
                            "confidence": round(confidence * 100, 1),
                            "sale_price": p.sale_price,
                            "stock": stock
                        })

                    if result:
                        return result
        except Exception:
            pass

    # Fallback: top products by sales volume, excluding already-selected and out-of-stock
    top = (
        db.query(Sale.product_id, func.sum(Sale.quantity).label("total"))
        .filter(Sale.product_id.notin_(product_ids))
        .group_by(Sale.product_id)
        .order_by(func.sum(Sale.quantity).desc())
        .limit(20)
        .all()
    )

    result = []
    for pid, _ in top:
        if len(result) >= 5:
            break
        p = db.query(Product).filter(Product.product_id == pid).first()
        if not p:
            continue
        inv = db.query(Inventory).filter(Inventory.product_id == pid).first()
        stock = inv.stock if inv else 0
        if stock == 0:
            continue
        result.append({
            "product_id": pid,
            "name": p.name,
            "confidence": None,
            "sale_price": p.sale_price,
            "stock": stock
        })

    return result
