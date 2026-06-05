import pandas as pd
import numpy as np
import pickle
import os
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import LabelEncoder
from sqlalchemy.orm import Session
from backend.models import Product, Sale
from datetime import datetime, timedelta

MODEL_PATH = os.getenv("ML_MODEL_PATH", "./ml/models/")
os.makedirs(MODEL_PATH, exist_ok=True)

def _build_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["date"] = pd.to_datetime(df["date"])
    df["dayofweek"] = df["date"].dt.dayofweek
    df["month"] = df["date"].dt.month
    df["day"] = df["date"].dt.day
    df["dayofyear"] = df["date"].dt.dayofyear
    return df

def train_model(db: Session):
    sales = db.query(Sale).all()
    if len(sales) < 30:
        return None

    records = [{"product_id": s.product_id, "date": str(s.date), "quantity": s.quantity} for s in sales]
    df = pd.DataFrame(records)
    df = _build_features(df)

    le = LabelEncoder()
    df["product_enc"] = le.fit_transform(df["product_id"])

    X = df[["product_enc", "dayofweek", "month", "day", "dayofyear"]]
    y = df["quantity"]

    model = RandomForestRegressor(n_estimators=100, random_state=42)
    model.fit(X, y)

    model_file = os.path.join(MODEL_PATH, "sales_model.pkl")
    le_file = os.path.join(MODEL_PATH, "label_encoder.pkl")
    with open(model_file, "wb") as f:
        pickle.dump(model, f)
    with open(le_file, "wb") as f:
        pickle.dump(le, f)

    return model, le

def load_model():
    model_file = os.path.join(MODEL_PATH, "sales_model.pkl")
    le_file = os.path.join(MODEL_PATH, "label_encoder.pkl")
    if not os.path.exists(model_file):
        return None, None
    with open(model_file, "rb") as f:
        model = pickle.load(f)
    with open(le_file, "rb") as f:
        le = pickle.load(f)
    return model, le

def predict_sales(db: Session, days: int = 7) -> dict:
    model, le = load_model()
    if model is None:
        result = train_model(db)
        if result is None:
            return {"predictions": [], "message": "Not enough data to train model"}
        model, le = result

    products = db.query(Product).all()
    today = datetime.now().date()
    predictions = []

    for product in products[:10]:
        try:
            enc_id = le.transform([product.product_id])[0]
        except ValueError:
            continue

        daily_preds = []
        for d in range(1, days + 1):
            future_date = today + timedelta(days=d)
            features = np.array([[
                enc_id,
                future_date.weekday(),
                future_date.month,
                future_date.day,
                future_date.timetuple().tm_yday
            ]])
            pred = max(0, float(model.predict(features)[0]))
            daily_preds.append({"date": str(future_date), "quantity": round(pred, 1)})

        predictions.append({
            "product_id": product.product_id,
            "product_name": product.name,
            "forecast": daily_preds,
            "total_forecast": round(sum(p["quantity"] for p in daily_preds), 1)
        })

    predictions.sort(key=lambda x: x["total_forecast"], reverse=True)
    return {"predictions": predictions, "days": days}
