#!/usr/bin/env python3
"""
Seed demo data for a given user.
Usage: python scripts/seed_mock_data.py <user_id>
Requires the FastAPI backend to be running at http://127.0.0.1:8000
"""
import sys
import requests


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/seed_mock_data.py <user_id>")
        sys.exit(1)

    user_id = sys.argv[1]
    print(f"Seeding demo data for user: {user_id}")

    try:
        resp = requests.get(
            "http://127.0.0.1:8000/seed-demo-data",
            headers={"X-User-ID": user_id},
            timeout=60
        )
        resp.raise_for_status()
        data = resp.json()
        print(
            f"Done! Seeded: {data['products']} products, "
            f"{data['patients']} patients, "
            f"{data['doctors']} doctors, "
            f"{data['sales']} sales"
        )
    except requests.exceptions.ConnectionError:
        print("Error: Could not connect to FastAPI server at http://127.0.0.1:8000")
        print("Make sure the backend is running first.")
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
