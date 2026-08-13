import csv
import time
import requests
from dotenv import dotenv_values

ENV = dotenv_values("backend/.env")
API_KEY = ENV.get("GOOGLE_PLACES_API_KEY")

IN_FILE = "leads_senacs_idf_avec_tel.csv"
OUT_FILE = "leads_senacs_idf_final.csv"

FIND_PLACE_URL = "https://maps.googleapis.com/maps/api/place/findplacefromtext/json"
DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"


def find_phone_google(nom, adresse):
    query = f"{nom} {adresse}"
    params = {
        "input": query,
        "inputtype": "textquery",
        "fields": "place_id",
        "key": API_KEY,
    }
    try:
        r = requests.get(FIND_PLACE_URL, params=params, timeout=10)
        data = r.json()
    except requests.RequestException:
        return "", ""

    candidates = data.get("candidates", [])
    if not candidates:
        return "", ""
    place_id = candidates[0].get("place_id")
    if not place_id:
        return "", ""

    params2 = {
        "place_id": place_id,
        "fields": "formatted_phone_number,international_phone_number",
        "key": API_KEY,
    }
    try:
        r2 = requests.get(DETAILS_URL, params=params2, timeout=10)
        data2 = r2.json()
    except requests.RequestException:
        return "", ""

    result = data2.get("result", {})
    phone = result.get("formatted_phone_number", "")
    return phone, place_id


def main():
    if not API_KEY:
        print("GOOGLE_PLACES_API_KEY introuvable dans backend/.env")
        return

    rows = list(csv.DictReader(open(IN_FILE, encoding="utf-8-sig")))
    fieldnames = list(rows[0].keys())
    if "source_telephone" not in fieldnames:
        fieldnames.append("source_telephone")

    to_process = [r for r in rows if not r.get("telephone", "").strip()]
    print(f"{len(to_process)} structures sans telephone a chercher via Google Places")

    found = 0
    for i, row in enumerate(rows, 1):
        if row.get("telephone", "").strip():
            row["source_telephone"] = "site_web"
            continue
        phone, place_id = find_phone_google(row["nom"], f"{row['adresse']} {row['code_postal']} {row['ville']}")
        if phone:
            row["telephone"] = phone
            row["source_telephone"] = "google_places"
            found += 1
        else:
            row["source_telephone"] = ""
        if i % 25 == 0 or i == len(rows):
            print(f"{i}/{len(rows)} traites, {found} nouveaux telephones google")
        time.sleep(0.1)

    with open(OUT_FILE, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    total_with_phone = sum(1 for r in rows if r.get("telephone", "").strip())
    print(f"\nTermine: {found} telephones ajoutes via Google Places")
    print(f"Total avec telephone: {total_with_phone}/{len(rows)} -> {OUT_FILE}")


if __name__ == "__main__":
    main()
