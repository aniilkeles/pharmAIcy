import json
import os
import pickle
import numpy as np
import pandas as pd
from datetime import date, timedelta
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import TimeSeriesSplit
from sqlalchemy.orm import Session
from backend.models import Inventory, Product, Sale

MODEL_PATH = os.getenv("ML_MODEL_PATH", "./ml/models/")
os.makedirs(MODEL_PATH, exist_ok=True)

FEATURES = [
    "sales_last_7_days", "sales_last_30_days", "sales_last_90_days",
    "avg_daily_sales", "day_of_week", "month",
    "current_stock", "stock_ratio", "is_low_stock", "is_expiry_pressure",
]


def train_model(db: Session):
    predict_sales(db)


def predict_sales(db: Session, days: int = 7) -> dict:
    today = date.today()
    cutoff = today - timedelta(days=180)

    # STEP 1 — Fetch last 180 days of sales
    rows = (
        db.query(Sale, Product.name)
        .join(Product, Sale.product_id == Product.product_id)
        .filter(Sale.date >= cutoff)
        .all()
    )

    if len(rows) < 10:
        return {"error": "insufficient_data", "need": 10, "current": len(rows)}

    df = pd.DataFrame([
        {"product_id": s.product_id, "product_name": name, "date": s.date, "quantity": s.quantity}
        for s, name in rows
    ])
    df["date"] = pd.to_datetime(df["date"])
    daily = df.groupby(["product_id", "product_name", "date"])["quantity"].sum().reset_index()

    inv_map = {inv.product_id: inv for inv in db.query(Inventory).all()}

    def get_inv(pid):
        inv = inv_map.get(pid)
        stock    = inv.stock          if inv else 0
        critical = inv.critical_stock if inv else 20
        ratio    = stock / critical if critical > 0 else 0.0
        is_low   = 1 if stock <= critical else 0
        is_exp   = 0
        if inv and inv.expiry_date:
            exp    = inv.expiry_date if isinstance(inv.expiry_date, date) else date.fromisoformat(str(inv.expiry_date))
            is_exp = 1 if (exp - today).days < 90 else 0
        return stock, critical, ratio, is_low, is_exp

    # STEP 2 — Build training rows
    training_rows = []
    for pid, group in daily.groupby("product_id"):
        pname = group["product_name"].iloc[0]
        group = group.sort_values("date")
        dq    = {r["date"].date(): int(r["quantity"]) for _, r in group.iterrows()}
        all_dates = sorted(dq.keys())
        stock, critical, ratio, is_low, is_exp = get_inv(pid)

        for t in all_dates:
            l7   = sum(dq.get(t - timedelta(days=d), 0) for d in range(7))
            l30  = sum(dq.get(t - timedelta(days=d), 0) for d in range(30))
            l90  = sum(dq.get(t - timedelta(days=d), 0) for d in range(90))
            seen = [d for d in all_dates if d <= t]
            avg  = sum(dq[d] for d in seen) / len(seen) if seen else 0.0
            target = sum(dq.get(t + timedelta(days=d), 0) for d in range(1, 8))
            training_rows.append([l7, l30, l90, avg, t.weekday(), t.month,
                                   stock, ratio, is_low, is_exp,
                                   target, int(pid), pname, t])

    if len(training_rows) < 5:
        return {"error": "insufficient_data", "need": 10, "current": len(rows)}

    cols = FEATURES + ["next_7_day_demand", "product_id", "product_name", "date"]
    tdf  = pd.DataFrame(training_rows, columns=cols).sort_values("date").reset_index(drop=True)

    X = tdf[FEATURES].values.astype(float)
    y = tdf["next_7_day_demand"].values.astype(float)

    # STEP 3 — TimeSeriesSplit CV + final model
    tscv = TimeSeriesSplit(n_splits=3)
    mae_list, rmse_list, r2_list = [], [], []
    for tr, val in tscv.split(X):
        if len(tr) < 2 or len(val) < 1:
            continue
        rf = RandomForestRegressor(n_estimators=100, max_depth=10, random_state=42)
        rf.fit(X[tr], y[tr])
        p = rf.predict(X[val])
        mae_list.append(mean_absolute_error(y[val], p))
        rmse_list.append(float(np.sqrt(mean_squared_error(y[val], p))))
        r2_list.append(r2_score(y[val], p))

    model = RandomForestRegressor(n_estimators=100, max_depth=10, random_state=42)
    model.fit(X, y)

    if mae_list:
        mae  = round(float(np.mean(mae_list)), 2)
        rmse = round(float(np.mean(rmse_list)), 2)
        r2   = round(float(np.mean(r2_list)), 3)
    else:
        p    = model.predict(X)
        mae  = round(float(mean_absolute_error(y, p)), 2)
        rmse = round(float(np.sqrt(mean_squared_error(y, p))), 2)
        r2   = round(float(r2_score(y, p)), 3)

    fi      = {f: round(float(v), 4) for f, v in zip(FEATURES, model.feature_importances_)}
    metrics = {"mae": mae, "rmse": rmse, "r2": r2, "feature_importance": fi}

    with open(os.path.join(MODEL_PATH, "sales_model.pkl"), "wb") as fh:
        pickle.dump(model, fh)
    with open(os.path.join(MODEL_PATH, "metrics.json"), "w") as fh:
        json.dump(metrics, fh)

    # STEP 4 — Generate predictions per product
    predictions = []
    for pid in daily["product_id"].unique():
        grp   = daily[daily["product_id"] == pid].sort_values("date")
        pname = grp["product_name"].iloc[0]
        dq    = {r["date"].date(): int(r["quantity"]) for _, r in grp.iterrows()}
        stock, critical, ratio, is_low, is_exp = get_inv(int(pid))

        l7  = sum(dq.get(today - timedelta(days=d), 0) for d in range(7))
        l30 = sum(dq.get(today - timedelta(days=d), 0) for d in range(30))
        l90 = sum(dq.get(today - timedelta(days=d), 0) for d in range(90))
        avg = sum(dq.values()) / len(dq) if dq else 0.0

        x    = np.array([[l7, l30, l90, avg, today.weekday(), today.month,
                          stock, ratio, is_low, is_exp]])
        pred = max(0, int(round(float(model.predict(x)[0]))))

        rec  = "restock" if (stock == 0 or stock < pred) else "surplus" if stock > pred * 3 else "ok"
        conf = "high" if r2 > 0.7 else "medium" if r2 > 0.4 else "low"

        predictions.append({
            "product_id":        int(pid),
            "product_name":      pname,
            "current_stock":     stock,
            "predicted_demand_7d": pred,
            "recommendation":    rec,
            "confidence":        conf,
        })

    predictions.sort(key=lambda x: x["predicted_demand_7d"], reverse=True)
    return {"predictions": predictions[:10], "metrics": metrics}
