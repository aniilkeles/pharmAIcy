"""
LSTM tabanli talep tahmin modulu.

Bu modul, prediction_agent.py'deki Random Forest modeliyle AYNI veri
pipeline'ini (gunluk satis -> 7 gunluk ileri talep) kullanir, boylece
iki modelin performansi dogrudan ve adil sekilde kiyaslanabilir.

RF modelinden farki: RF her gunu bagimsiz bir "satir" olarak gorur
(sales_last_7/30/90_days gibi elle cikarilmis ozelliklerle). LSTM ise
gunluk satis dizisini oldugu gibi (ham sekilde) bir "sequence" olarak
alir ve zamansal bagimliligi kendisi ogrenir.

Kullanim (mevcut predict_sales() ile ayni imza):
    from agents.prediction_agent_lstm import predict_sales_lstm
    result = predict_sales_lstm(db)
"""
import json
import os
from datetime import date, timedelta

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.preprocessing import StandardScaler
from sqlalchemy.orm import Session

from backend.models import Inventory, Product, Sale

MODEL_PATH = os.getenv("ML_MODEL_PATH", "./ml/models/")
os.makedirs(MODEL_PATH, exist_ok=True)

SEQ_LEN = 30          # Girdi olarak kullanilan gecmis gun sayisi
HORIZON = 7           # Tahmin edilen ileri gun sayisi (RF ile ayni)
HIDDEN_SIZE = 32
EPOCHS = 60
LR = 0.01
SEED = 42

torch.manual_seed(SEED)
np.random.seed(SEED)


class LSTMForecaster(nn.Module):
    """Tek katmanli, tek degiskenli (univariate) LSTM regresor.

    Girdi: (batch, SEQ_LEN, 1) -- son SEQ_LEN gunun gunluk satis miktari
    Cikti: (batch, 1)          -- sonraki HORIZON gunun toplam talebi
    """

    def __init__(self, hidden_size: int = HIDDEN_SIZE):
        super().__init__()
        self.lstm = nn.LSTM(input_size=1, hidden_size=hidden_size, num_layers=1, batch_first=True)
        self.fc = nn.Linear(hidden_size, 1)

    def forward(self, x):
        _, (h_n, _) = self.lstm(x)
        return self.fc(h_n[-1])


def _build_daily_series(db: Session, cutoff_days: int = 180):
    """prediction_agent.predict_sales() ile ayni sekilde gunluk satis
    serisini cikarir, ama ozellik muhendisligi yerine ham gunluk seriyi
    dondurur (LSTM kendi ogrensin diye)."""
    today = date.today()
    cutoff = today - timedelta(days=cutoff_days)

    rows = (
        db.query(Sale, Product.name)
        .join(Product, Sale.product_id == Product.product_id)
        .filter(Sale.date >= cutoff)
        .all()
    )
    if not rows:
        return {}

    df = pd.DataFrame([
        {"product_id": s.product_id, "product_name": name, "date": s.date, "quantity": s.quantity}
        for s, name in rows
    ])
    df["date"] = pd.to_datetime(df["date"]).dt.date
    daily = df.groupby(["product_id", "product_name", "date"])["quantity"].sum().reset_index()

    series_by_product = {}
    for pid, group in daily.groupby("product_id"):
        pname = group["product_name"].iloc[0]
        group = group.sort_values("date")
        dq = {r["date"]: int(r["quantity"]) for _, r in group.iterrows()}
        all_days = [cutoff + timedelta(days=i) for i in range((today - cutoff).days + 1)]
        values = [dq.get(d, 0) for d in all_days]
        series_by_product[int(pid)] = {"name": pname, "values": np.array(values, dtype=float)}
    return series_by_product


def _make_windows(values: np.ndarray, seq_len: int = SEQ_LEN, horizon: int = HORIZON):
    """Bir urunun gunluk serisinden (X=gecmis seq_len gun, y=sonraki
    horizon gunun toplami) kayan pencere ornekleri uretir."""
    X, y = [], []
    n = len(values)
    for t in range(seq_len, n - horizon + 1):
        X.append(values[t - seq_len:t])
        y.append(values[t:t + horizon].sum())
    return X, y


def train_lstm_model(db: Session):
    predict_sales_lstm(db)


def predict_sales_lstm(db: Session, days: int = HORIZON) -> dict:
    """prediction_agent.predict_sales() ile ayni sozlesmeye (aynen ayni
    donus formatina) sahip, ama LSTM kullanan versiyon. Ikisi de
    {"predictions": [...], "metrics": {...}} dondurur, boylece
    Decision Agent veya karsilastirma scripti ikisini de ayni sekilde
    tuketebilir."""
    series_by_product = _build_daily_series(db)
    if not series_by_product:
        return {"error": "insufficient_data", "need": 10, "current": 0}

    # STEP 1 -- Tum urunlerden pencere ornekleri topla (havuzlanmis egitim)
    all_X, all_y, meta = [], [], []
    for pid, info in series_by_product.items():
        Xp, yp = _make_windows(info["values"])
        for xi, yi in zip(Xp, yp):
            all_X.append(xi)
            all_y.append(yi)
            meta.append(pid)

    if len(all_X) < 10:
        return {"error": "insufficient_data", "need": 10, "current": len(all_X)}

    X = np.array(all_X)          # (N, SEQ_LEN)
    y = np.array(all_y)          # (N,)

    # STEP 2 -- Olcekleme (LSTM egitimi icin sart)
    x_scaler = StandardScaler().fit(X.reshape(-1, 1))
    X_scaled = x_scaler.transform(X.reshape(-1, 1)).reshape(X.shape)
    y_scaler = StandardScaler().fit(y.reshape(-1, 1))
    y_scaled = y_scaler.transform(y.reshape(-1, 1)).flatten()

    # STEP 3 -- Kronolojik train/validation ayrimi (TimeSeriesSplit mantigiyla
    # tutarli olsun diye rastgele degil, zaman sirali bolunuyor)
    order = np.argsort(meta)  # urun bazinda grupla, sonra her urunun kendi icinde zaten kronolojik
    split_idx = int(len(X_scaled) * 0.8)
    Xtr, Xval = X_scaled[:split_idx], X_scaled[split_idx:]
    ytr, yval = y_scaled[:split_idx], y_scaled[split_idx:]

    Xtr_t = torch.tensor(Xtr, dtype=torch.float32).unsqueeze(-1)
    ytr_t = torch.tensor(ytr, dtype=torch.float32).unsqueeze(-1)
    Xval_t = torch.tensor(Xval, dtype=torch.float32).unsqueeze(-1)

    model = LSTMForecaster()
    optimizer = torch.optim.Adam(model.parameters(), lr=LR)
    loss_fn = nn.MSELoss()

    n = Xtr_t.shape[0]
    batch_size = min(64, max(1, n // 4))
    for _ in range(EPOCHS):
        perm = torch.randperm(n)
        for i in range(0, n, batch_size):
            idx = perm[i:i + batch_size]
            optimizer.zero_grad()
            pred = model(Xtr_t[idx])
            loss = loss_fn(pred, ytr_t[idx])
            loss.backward()
            optimizer.step()

    # STEP 4 -- Validasyon metrikleri (RF ile ayni ucu: MAE, RMSE, R2)
    model.eval()
    with torch.no_grad():
        val_pred_scaled = model(Xval_t).squeeze(-1).numpy() if len(Xval_t) else np.array([])
    if len(val_pred_scaled):
        val_pred = y_scaler.inverse_transform(val_pred_scaled.reshape(-1, 1)).flatten()
        val_pred = np.clip(val_pred, 0, None)
        val_actual = y_scaler.inverse_transform(yval.reshape(-1, 1)).flatten()
        mae = round(float(mean_absolute_error(val_actual, val_pred)), 2)
        rmse = round(float(np.sqrt(mean_squared_error(val_actual, val_pred))), 2)
        r2 = round(float(r2_score(val_actual, val_pred)), 3) if len(val_actual) > 1 else 0.0
    else:
        mae = rmse = r2 = None

    metrics = {"model": "lstm", "mae": mae, "rmse": rmse, "r2": r2, "seq_len": SEQ_LEN}

    torch.save(model.state_dict(), os.path.join(MODEL_PATH, "sales_model_lstm.pt"))
    with open(os.path.join(MODEL_PATH, "metrics_lstm.json"), "w") as fh:
        json.dump(metrics, fh)

    # STEP 5 -- Her urun icin guncel tahmin (son SEQ_LEN gunu kullanarak)
    inv_map = {inv.product_id: inv for inv in db.query(Inventory).all()}
    predictions = []
    with torch.no_grad():
        for pid, info in series_by_product.items():
            vals = info["values"]
            if len(vals) < SEQ_LEN:
                continue
            window = vals[-SEQ_LEN:]
            xw = x_scaler.transform(window.reshape(-1, 1)).reshape(1, SEQ_LEN, 1)
            xw_t = torch.tensor(xw, dtype=torch.float32)
            pred_scaled = model(xw_t).item()
            pred = float(y_scaler.inverse_transform([[pred_scaled]])[0][0])
            pred = max(0, int(round(pred)))

            inv = inv_map.get(pid)
            stock = inv.stock if inv else 0
            rec = "restock" if (stock == 0 or stock < pred) else "surplus" if stock > pred * 3 else "ok"
            conf = "high" if (r2 or 0) > 0.7 else "medium" if (r2 or 0) > 0.4 else "low"

            predictions.append({
                "product_id": pid,
                "product_name": info["name"],
                "current_stock": stock,
                "predicted_demand_7d": pred,
                "recommendation": rec,
                "confidence": conf,
            })

    predictions.sort(key=lambda x: x["predicted_demand_7d"], reverse=True)
    return {"predictions": predictions[:10], "metrics": metrics}
