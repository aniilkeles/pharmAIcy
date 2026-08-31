# PharmAIcy — AI-Powered Pharmacy Management System

> **Graduation Project** | Toros University, Software Engineering Department | June 2026  
> **Advisor:** Dr. Rıdvan Söyü | **Authors:** Anıl Keleş, Mesut Deniz Zeka

---

## Overview

PharmAIcy is an AI-powered pharmacy management desktop application that integrates **five specialist AI agents** into a unified platform. Unlike traditional pharmacy software that merely records transactions, PharmAIcy actively predicts, recommends, and decides — transforming a passive record-keeping tool into a proactive decision-support system.

The system was designed to address the fundamental limitation of existing pharmacy management software (RxMediaPharm, Pharmakon, QS/1): they are **reactive, not proactive**. PharmAIcy fills this gap with a multi-agent AI architecture powered by machine learning, association rule mining, and large language model integration.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron.js Frontend                      │
│              (React 18 + Tailwind CSS + Vite)               │
└──────────────────────────┬──────────────────────────────────┘
                           │ IPC (contextBridge)
┌──────────────────────────▼──────────────────────────────────┐
│                   Python FastAPI Backend                     │
│                    (SQLAlchemy ORM)                          │
└──────────┬────────────────────────────────┬─────────────────┘
           │                                │
┌──────────▼──────────┐        ┌────────────▼────────────────┐
│   Five AI Agents    │        │  Per-Tenant SQLite Database  │
│                     │        │  pharmacy_{user_id}.db       │
│  ► Data Agent       │        │                             │
│  ► Prediction Agent │        │  10 Tables: Products,       │
│  ► Interaction Agent│        │  Inventory, Sales,          │
│  ► Expiry Agent     │        │  Prescriptions, Patients,   │
│  ► Decision Agent   │        │  Doctors, DrugInteractions  │
└──────────┬──────────┘        └─────────────────────────────┘
           │
┌──────────▼──────────┐
│  Anthropic Claude   │
│  API (claude-sonnet)│
└─────────────────────┘
```

---

## Five-Agent System

| Agent | Function | Algorithm / Library | Output |
|-------|----------|---------------------|--------|
| **Data Agent** | Sales & stock analysis | pandas, numpy | Top products, revenue, low-stock alerts |
| **Prediction Agent** | 7-day demand forecast | Random Forest (scikit-learn) | Per-product demand, MAE, RMSE, R² |
| **Interaction Agent** | Cross-sell recommendations | Apriori (mlxtend) | Product pairs with confidence, support, lift |
| **Expiry Agent** | Expiry monitoring & FEFO | datetime, pandas | Urgent/warning lists, lot ordering |
| **Decision Agent** | Strategic synthesis & chatbot | **Anthropic Claude API** | Action recommendations, Q&A responses |

---

## Key Features

### Prescription Management
- 4-step creation workflow: patient → doctor → items → confirmation
- **Live drug interaction warnings** (30+ pre-seeded interactions + Claude API fallback)
- Real-time cross-sell suggestions during prescription creation
- Atomic stock deduction with full transaction rollback on failure
- Partial fulfillment support with automatic critical stock notifications

### Machine Learning — Demand Forecasting
- Random Forest regressor trained on historical sales data
- Feature set: 7 variables including rolling sales windows, calendar features, stock ratios
- Evaluation metrics: MAE, RMSE, R² — see [Model Comparison](#model-comparison-rf-vs-lstm-vs-arima) below for honest results across models
- 7-day ahead per-product demand predictions

### Association Rule Mining — Cross-Sell
- Apriori algorithm on pharmacy transaction history
- Human-readable rules: *"If Aspirin → Pantoprazol (confidence: 78%)"*
- Transaction-based co-purchase pattern detection (not clinically validated — see limitations)

### AI Decision Agent
- Anthropic Claude API (claude-sonnet-4-20250514)
- Multi-turn conversation with 5-turn history
- Pharmacy-specific system prompt
- Hybrid approach: local DB check first → Claude API for unknown interactions

### Security
- Supabase Auth (JWT Bearer tokens)
- AES-256 encrypted session storage via Electron safeStorage
- Rate limiting: 100 req/min standard, 10 req/min AI endpoints
- Per-tenant database isolation (physically separate .db files)
- nodeIntegration disabled, contextIsolation enabled

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Desktop Shell | Electron.js | 28+ |
| Frontend Framework | React | 18 |
| Build Tool | Vite | 5 |
| Styling | Tailwind CSS + Framer Motion | 3 / 11 |
| State Management | Zustand | 4 |
| HTTP Client | Axios | 1.6 |
| Backend Framework | **FastAPI** | 0.111 |
| Backend Runtime | **Python** | 3.10+ |
| ORM | SQLAlchemy | 2.0 |
| Database | SQLite (per-tenant) | — |
| ML Library | scikit-learn | — |
| Data Processing | pandas, numpy | — |
| Association Rules | mlxtend | — |
| LLM | **Anthropic Claude API** | claude-sonnet-4 |
| Auth | Supabase Auth | — |
| Packaging | electron-builder | — |

---

## Database Schema

10 tables with full relational integrity:

```
Products → Inventory → Sales
       ↘              ↗
        Prescriptions → PrescriptionItems
              ↓
         Patients / Doctors
              ↓
     DrugInteractions / AuditLog / Notifications
```

- **Multi-tenant isolation:** Each pharmacy gets `pharmacy_{user_id}.db`
- **DrugInteractions:** Pre-seeded with 30 clinically significant Turkish pharmacy interactions
- **AuditLog:** Full audit trail for all prescription and stock operations

---

## ML Performance Results

### Drug Interaction Detection & Workflow Correctness

| Metric | Result |
|--------|--------|
| Drug Interaction Detection — seeded pairs (local DB) | 15/15 (100%) |
| Drug Interaction Detection — novel pairs (Claude API fallback) | 8/10 (80%) |
| Prescription Workflow Correctness (4 test scenarios) | 100% |

### Model Comparison: RF vs. LSTM vs. ARIMA

We tested more than one forecasting approach rather than assuming Random Forest was the best choice, and report the results honestly — including where simpler models won.

**On the app's own synthetic dataset** (50 products, 1000 sales records — reproducible via `python scripts/compare_rf_lstm.py`):

| Model | MAE | RMSE | R² |
|-------|-----|------|-----|
| Random Forest | 4.32 | 5.27 | -0.076 |
| LSTM | 2.45 | 4.77 | -0.443 |

**On a real 12-month sales history from a community pharmacy in Turkey** (8,684 SKUs, held-out month evaluation — see the [accompanying paper](paper/pharmAIcy_arxiv_paper_v3.pdf) for full methodology):

| Model | MAE | RMSE | R² |
|-------|-----|------|-----|
| ARIMA(1,0,0) | 0.82 | 1.64 | 0.861 |
| LSTM | 0.92 | 1.91 | 0.810 |
| Naive (last month) | 1.04 | 2.30 | 0.725 |
| Random Forest | 1.12 | 3.30 | 0.437 |

**Takeaway:** on real pharmacy data, simpler sequence-aware models (ARIMA, LSTM) outperformed Random Forest, which underperformed even a naive baseline. We view this as a useful, honest finding rather than something to hide — it shaped our understanding of why tree ensembles struggle with sparse, intermittent-demand SKU-level data, and is discussed in more depth in the [accompanying paper](paper/pharmAIcy_arxiv_paper_v3.pdf).

---

## Comparison with Existing Solutions

*Based on publicly documented product features as of 2026, not a hands-on audit of each system.*

| System | Country | Predictive Analytics | AI Decision Support | Cross-Sell | LLM Integration |
|--------|---------|---------------------|---------------------|------------|-----------------|
| RxMediaPharm | Turkey | ❌ | ❌ | ❌ | ❌ |
| Pharmakon | Germany | ❌ | ❌ | ❌ | ❌ |
| QS/1 NRx | USA | ❌ | ❌ | ❌ | ❌ |
| MedEye | Netherlands | ❌ | ❌ | ❌ | ❌ |
| **PharmAIcy** | **Turkey** | ✅ | ✅ | ✅ | ✅ |

---

## Project Context

This project was developed as a **Software Engineering graduation project** at Toros University, Faculty of Engineering, Software Engineering Department. The system addresses a real gap in Turkish pharmacy management software by combining:

- **Honest experimentation:** demand forecasting was tested across Random Forest, LSTM, and ARIMA — including a real-world pilot where the initial Random Forest approach underperformed simpler baselines, a result we report rather than hide (see [Model Comparison](#model-comparison-rf-vs-lstm-vs-arima))
- **Solid engineering fundamentals:** full desktop packaging, JWT auth, rate limiting, atomic transactions — described as a research prototype, not a production-ready system (role-based access control is not yet implemented)
- **AI innovation:** Multi-agent architecture with Anthropic Claude API integration for natural language decision support

---

## Keywords

`Artificial Intelligence` `Multi-Agent Systems` `Machine Learning` `Pharmacy Management` `Large Language Model` `Random Forest` `Association Rule Mining` `FastAPI` `Electron.js` `Anthropic Claude`
