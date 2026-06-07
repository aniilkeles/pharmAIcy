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


def _check_interaction_claude(name_a: str, name_b: str) -> dict:
    if not _ai_enabled:
        return {"has_interaction": False, "severity": "mild", "description": ""}
    prompt = (
        f"Are there any clinically significant drug interactions between {name_a} and {name_b}?\n"
        "Answer in JSON only:\n"
        '{"has_interaction": bool, "severity": "mild" or "moderate" or "severe", "description": "string (max 100 chars)"}\n'
        'If no known interaction return {"has_interaction": false, "severity": "mild", "description": ""}'
    )
    try:
        response = client.messages.create(
            model=MODEL, max_tokens=200,
            messages=[{"role": "user", "content": prompt}]
        )
        text = response.content[0].text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text)
    except Exception:
        return {"has_interaction": False, "severity": "mild", "description": ""}


def _name_matches(drug_name: str, product_name: str) -> bool:
    """True if drug_name is a substring of product_name or vice versa (case-insensitive)."""
    d = drug_name.lower().strip()
    p = product_name.lower().strip()
    return d in p or p in d


def check_drug_interactions(db: Session, product_ids: list) -> list:
    try:
        from backend.models import DrugInteraction, Product

        if len(product_ids) < 2:
            return []

        products = db.query(Product).filter(Product.product_id.in_(product_ids)).all()
        product_map = {p.product_id: p.name for p in products}

        print(f"[check_drug_interactions] product_ids={product_ids}")
        print(f"[check_drug_interactions] product_names={list(product_map.values())}")

        # Load all interactions once; we do matching in Python so both directions
        # and all substring combinations are covered correctly.
        all_interactions = db.query(DrugInteraction).all()
        print(f"[check_drug_interactions] {len(all_interactions)} total rows in drug_interactions table")
        for row in all_interactions:
            print(f"  -> id={row.id} drug_a='{row.drug_a}' drug_b='{row.drug_b}' severity='{row.severity}'")

        found = []
        checked_pairs = set()
        ids = list(dict.fromkeys(product_ids))

        for i in range(len(ids)):
            for j in range(i + 1, len(ids)):
                pid_a, pid_b = ids[i], ids[j]
                pair_key = (min(pid_a, pid_b), max(pid_a, pid_b))
                if pair_key in checked_pairs:
                    continue
                checked_pairs.add(pair_key)

                name_a = product_map.get(pid_a, "")
                name_b = product_map.get(pid_b, "")
                if not name_a or not name_b:
                    continue

                print(f"[check_drug_interactions] checking pair: '{name_a}' vs '{name_b}'")

                # Real matches (exclude cached "no-interaction" sentinel rows)
                local_matches = [
                    inter for inter in all_interactions
                    if inter.severity != "none" and (
                        (_name_matches(inter.drug_a, name_a) and _name_matches(inter.drug_b, name_b)) or
                        (_name_matches(inter.drug_a, name_b) and _name_matches(inter.drug_b, name_a))
                    )
                ]
                # Whether this pair was already checked and confirmed "no interaction"
                has_cached_none = any(
                    inter.severity == "none" and (
                        (_name_matches(inter.drug_a, name_a) and _name_matches(inter.drug_b, name_b)) or
                        (_name_matches(inter.drug_a, name_b) and _name_matches(inter.drug_b, name_a))
                    )
                    for inter in all_interactions
                )

                print(f"[check_drug_interactions] local_matches={len(local_matches)}, has_cached_none={has_cached_none}")

                if local_matches:
                    for inter in local_matches:
                        found.append({
                            "drug_a": inter.drug_a,
                            "drug_b": inter.drug_b,
                            "severity": inter.severity,
                            "description": inter.description,
                            "product_a_id": pid_a,
                            "product_b_id": pid_b
                        })
                elif not has_cached_none:
                    result = _check_interaction_claude(name_a, name_b)
                    if result.get("has_interaction"):
                        new_inter = DrugInteraction(
                            drug_a=name_a, drug_b=name_b,
                            severity=result.get("severity", "moderate"),
                            description=result.get("description", "")
                        )
                        db.add(new_inter)
                        db.commit()
                        found.append({
                            "drug_a": name_a,
                            "drug_b": name_b,
                            "severity": result.get("severity", "moderate"),
                            "description": result.get("description", ""),
                            "product_a_id": pid_a,
                            "product_b_id": pid_b
                        })
                    else:
                        db.add(DrugInteraction(
                            drug_a=name_a, drug_b=name_b,
                            severity="none", description=""
                        ))
                        db.commit()

        print(f"[check_drug_interactions] returning {len(found)} interactions")
        return found
    except Exception as e:
        import traceback
        print(f"[check_drug_interactions] ERROR: {e}\n{traceback.format_exc()}")
        return []
