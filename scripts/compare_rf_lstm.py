#!/usr/bin/env python3
"""
Random Forest ile LSTM talep tahmin modellerini AYNI veri uzerinde
kosturup yan yana kiyaslayan script.

Kullanim:
    python scripts/compare_rf_lstm.py

Not: Bu script gecici, tek seferlik bir SQLite veritabani olusturur
(data/_compare_tmp.db), data/synthetic_sales.csv ve
data/pharmacy_dataset.csv dosyalarindan urun + satis verisini yukler,
prediction_agent.predict_sales() (Random Forest) ve
prediction_agent_lstm.predict_sales_lstm() (LSTM) fonksiyonlarini
CALISTIGI HALIYLE (kod degistirilmeden) cagirir ve metrics ciktilarini
tek bir tabloda gosterir.
"""
import os
import sys
from datetime import date, timedelta

import pandas as pd
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.database import Base
import backend.models as models  # noqa: F401 (Base.metadata icin gerekli)
from backend.models import Product, Sale, Inventory

TMP_DB_PATH = "data/_compare_tmp.db"


def build_temp_db():
    if os.path.exists(TMP_DB_PATH):
        os.remove(TMP_DB_PATH)
    engine = create_engine(f"sqlite:///{TMP_DB_PATH}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    db = Session()
    db._tmp_engine = engine  # Windows'ta dosyayi silebilmek icin engine referansini saklıyoruz

    # Urunleri yukle (pharmacy_dataset.csv)
    products_df = pd.read_csv("data/pharmacy_dataset.csv")
    name_to_id = {}
    for _, row in products_df.iterrows():
        p = Product(
            name=row["name"],
            barcode=str(row.get("barcode", "")),
            cost_price=float(row.get("cost_price", 0)),
            sale_price=float(row.get("sale_price", 0)),
        )
        db.add(p)
        db.flush()
        name_to_id[row["name"]] = p.product_id
        db.add(Inventory(
            product_id=p.product_id,
            stock=int(row.get("stock", 0)),
            critical_stock=int(row.get("critical_stock", 20)),
        ))
    db.commit()

    # Satislari yukle (synthetic_sales.csv) -- product_id dogrudan bu dosyada var
    sales_df = pd.read_csv("data/synthetic_sales.csv")
    # Eger synthetic_sales.csv'deki product_id'ler pharmacy_dataset ile hizali degilse
    # (farkli id semasi), yine de bire bir index eslemesi olarak kullaniyoruz --
    # amac gercek urun eslesmesi degil, RF/LSTM icin ayni gunluk seriyi uretmek.
    max_pid = products_df.shape[0]
    for _, row in sales_df.iterrows():
        pid = int(row["product_id"])
        if pid < 1 or pid > max_pid:
            continue
        db.add(Sale(
            product_id=pid,
            date=pd.to_datetime(row["date"]).date(),
            quantity=int(row["quantity"]),
        ))
    db.commit()
    print(f"Gecici veritabani hazir: {len(products_df)} urun, {len(sales_df)} satis kaydi.")
    return db


def main():
    db = build_temp_db()

    print("\n--- Random Forest calisiyor ---")
    from agents.prediction_agent import predict_sales
    rf_result = predict_sales(db)

    print("--- LSTM calisiyor (biraz surebilir) ---")
    from agents.prediction_agent_lstm import predict_sales_lstm
    lstm_result = predict_sales_lstm(db)

    print("\n" + "=" * 50)
    print("KIYAS SONUCU")
    print("=" * 50)

    for label, result in [("Random Forest", rf_result), ("LSTM", lstm_result)]:
        if "error" in result:
            print(f"{label:15s} -> HATA: {result['error']} (need={result.get('need')}, current={result.get('current')})")
            continue
        m = result["metrics"]
        print(f"{label:15s} -> MAE: {m.get('mae'):>6}   RMSE: {m.get('rmse'):>6}   R2: {m.get('r2'):>6}")

    engine = getattr(db, "_tmp_engine", None)
    db.close()
    if engine is not None:
        engine.dispose()  # Windows'ta dosya kilidini birakmasi icin baglantiyi tamamen kapatiyoruz

    try:
        if os.path.exists(TMP_DB_PATH):
            os.remove(TMP_DB_PATH)
    except PermissionError:
        print(f"\n(Not: gecici veritabani dosyasi ({TMP_DB_PATH}) silinemedi, "
              f"onemli degil -- elle silebilirsin. Karsilastirma sonucu yukarida gecerli.)")


if __name__ == "__main__":
    main()
