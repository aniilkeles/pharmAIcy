import pandas as pd
from mlxtend.frequent_patterns import apriori, association_rules
from mlxtend.preprocessing import TransactionEncoder
from sqlalchemy.orm import Session
from backend.models import Sale, Product
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
