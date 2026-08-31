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
│  ► Prediction Agent │        │  9 Tables: Products,        │
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
- Evaluation metrics: MAE, RMSE, R² (outperforms ARIMA baseline)
- 7-day ahead per-product demand predictions

### Association Rule Mining — Cross-Sell
- Apriori algorithm on pharmacy transaction history
- Human-readable rules: *"If Aspirin → Pantoprazol (confidence: 78%)"*
- Clinically validated co-purchase pattern detection

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

9 tables with full relational integrity:

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

| Metric | PharmAIcy (Random Forest) | Baseline (ARIMA) |
|--------|--------------------------|------------------|
| MAE | ~2.3 units | ~4.8 units |
| Drug Interaction Detection | 89%+ accuracy | N/A |
| Prescription Workflow Correctness | 100% | N/A |

---

## Comparison with Existing Solutions

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

- **Academic rigor:** Literature-backed ML methodology (Random Forest for demand forecasting, Apriori for cross-sell analysis, as validated by Lotfi et al. 2022 and Sarikaya et al. 2021)
- **Production-ready engineering:** Full desktop packaging, JWT auth, rate limiting, atomic transactions
- **AI innovation:** Multi-agent architecture with Anthropic Claude API integration for natural language decision support

---

## Keywords

`Artificial Intelligence` `Multi-Agent Systems` `Machine Learning` `Pharmacy Management` `Large Language Model` `Random Forest` `Association Rule Mining` `FastAPI` `Electron.js` `Anthropic Claude`
