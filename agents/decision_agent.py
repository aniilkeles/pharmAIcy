import os
import json
import requests
import anthropic
from sqlalchemy.orm import Session
from dotenv import load_dotenv

load_dotenv()

_api_key = os.getenv("ANTHROPIC_API_KEY", "")
_ai_enabled = bool(_api_key and not _api_key.startswith("your-"))
client = anthropic.Anthropic(api_key=_api_key) if _ai_enabled else None
MODEL = "claude-sonnet-4-6"


def aggregate_context(db: Session) -> dict:
    from agents.data_agent import analyze_sales, get_low_stock
    from agents.expiry_agent import get_expiring
    from agents.prediction_agent import predict_sales

    return {
        "sales": analyze_sales(db),
        "low_stock": get_low_stock(db),
        "expiring": get_expiring(db),
        "predictions": predict_sales(db)
    }


def get_decisions(context: dict) -> list:
    low_stock = context.get("low_stock", [])
    expiring = context.get("expiring", [])
    sales = context.get("sales", {})

    prompt = f"""You are an AI pharmacy management assistant. Based on the following pharmacy data, provide 5-8 specific, actionable recommendations.

Sales Data:
- Total revenue: {sales.get('total_revenue', 0):.2f} TL
- Weekly revenue: {sales.get('weekly_revenue', 0):.2f} TL
- Total units sold: {sales.get('total_sales', 0)}

Low Stock Products ({len(low_stock)} items):
{json.dumps(low_stock[:5], indent=2, default=str)}

Expiring Products ({len(expiring)} items):
{json.dumps(expiring[:5], indent=2, default=str)}

Provide a JSON array of recommendations. Each item must have:
- "priority": "high", "medium", or "low"
- "category": "stock", "expiry", "sales", or "finance"
- "title": short title (max 60 chars)
- "action": specific actionable step (max 150 chars)
- "impact": expected impact

Return ONLY valid JSON array, no other text."""

    if not _ai_enabled:
        return [
            {"priority": "high", "category": "stock", "title": "Review Low Stock Items",
             "action": f"Check {len(low_stock)} products below critical stock level", "impact": "Prevent stockouts"},
            {"priority": "medium", "category": "expiry", "title": "Handle Expiring Products",
             "action": f"Discount {len(expiring)} products expiring within 90 days", "impact": "Reduce waste"}
        ]
    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}]
        )
        text = response.content[0].text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text)
    except Exception:
        return [
            {"priority": "high", "category": "stock", "title": "Review Low Stock Items",
             "action": f"Check {len(low_stock)} products below critical stock level", "impact": "Prevent stockouts"},
            {"priority": "medium", "category": "expiry", "title": "Handle Expiring Products",
             "action": f"Discount {len(expiring)} products expiring within 90 days", "impact": "Reduce waste"}
        ]


def chat(message: str, context: dict, history: list = None) -> str:
    sales = context.get("sales", {})
    low_stock = context.get("low_stock", [])
    expiring = context.get("expiring", [])

    system = f"""You are PharmAIcy, an intelligent pharmacy assistant. You have access to real-time pharmacy data.

Current Data Summary:
- Total Revenue: {sales.get('total_revenue', 0):.2f} TL
- Weekly Revenue: {sales.get('weekly_revenue', 0):.2f} TL
- Products with low stock: {len(low_stock)}
- Products expiring soon: {len(expiring)}
- Top selling product: {sales.get('top_products', [{}])[0].get('product_name', 'N/A') if sales.get('top_products') else 'N/A'}

Answer pharmacy management questions clearly and specifically. Use TL for currency. Be concise. Format responses with line breaks for readability."""

    if not _ai_enabled:
        return "AI chat is not available — add your ANTHROPIC_API_KEY to .env to enable it."

    messages = []
    if history:
        for h in history[-10:]:
            messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": message})

    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=1024,
            system=system,
            messages=messages
        )
        return response.content[0].text
    except Exception as e:
        return f"I'm having trouble connecting to the AI service. Error: {str(e)}"


def identify_barcode(barcode: str) -> dict:
    try:
        url = f"https://world.openfoodfacts.org/api/v2/product/{barcode}.json"
        resp = requests.get(url, headers={"User-Agent": "PharmAIcy/1.0"}, timeout=5)
        if resp.status_code != 200:
            return {"found": False, "source": "not_found"}

        data = resp.json()
        if data.get("status") != 1:
            return {"found": False, "source": "not_found"}

        product = data.get("product", {})
        name = (
            product.get("product_name") or
            product.get("product_name_en") or
            product.get("product_name_tr") or
            ""
        ).strip()

        if not name:
            return {"found": False, "source": "not_found"}

        categories = product.get("categories_tags", [])
        category = categories[0].replace("en:", "").replace("-", " ").title() if categories else None

        return {
            "found": True,
            "product_name": name,
            "manufacturer": product.get("brands", ""),
            "category": category,
            "confidence": "high",
            "source": "openfoodfacts"
        }
    except Exception:
        return {"found": False, "source": "error"}


def check_drug_interactions(db: Session, product_ids: list) -> list:
    try:
        from backend.models import DrugInteraction, Product

        products = db.query(Product).filter(Product.product_id.in_(product_ids)).all()
        product_names = [p.name.lower() for p in products]

        all_interactions = db.query(DrugInteraction).all()
        found = []

        for inter in all_interactions:
            drug_a = inter.drug_a.lower()
            drug_b = inter.drug_b.lower()

            a_match = any(drug_a in name or name in drug_a for name in product_names)
            b_match = any(drug_b in name or name in drug_b for name in product_names)

            if a_match and b_match:
                found.append({
                    "drug_a": inter.drug_a,
                    "drug_b": inter.drug_b,
                    "severity": inter.severity,
                    "description": inter.description
                })

        return found
    except Exception:
        return []
