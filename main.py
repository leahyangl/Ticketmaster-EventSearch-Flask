import os
import requests
from flask import Flask, request, jsonify, send_from_directory
from geolib import geohash
from dotenv import load_dotenv

load_dotenv()

TM_API_KEY = os.getenv("TM_API_KEY", "")
GOOGLE_MAPS_KEY = os.getenv("GOOGLE_MAPS_KEY", "")
IPINFO_TOKEN = os.getenv("IPINFO_TOKEN", "")


app = Flask(__name__, static_folder="static")

CATEGORY_TO_SEGMENT = {
    "music": "KZFzniwnSyZfZ7v7nJ",
    "sports": "KZFzniwnSyZfZ7v7nE",
    "arts": "KZFzniwnSyZfZ7v7na",
    "film": "KZFzniwnSyZfZ7v7nn",
    "miscellaneous": "KZFzniwnSyZfZ7v7n1",
}


def geocode_address(address):
    
    if not address:
        return None, None
    if not GOOGLE_MAPS_KEY:
        return None, None

    url = "https://maps.googleapis.com/maps/api/geocode/json"
    params = {"address": address, "key": GOOGLE_MAPS_KEY}
    resp = requests.get(url, params=params, timeout=10)
    resp.raise_for_status()
    data = resp.json()

    if data.get("status") == "OK" and data["results"]:
        loc = data["results"][0]["geometry"]["location"]
        return loc["lat"], loc["lng"]
    return None, None


def build_tm_params(args, lat, lng):
    
    params = {
        "apikey": TM_API_KEY,
        "keyword": args.get("keyword", "").strip(),
        "radius": args.get("distance", "").strip() or "10",
        "unit": "miles",
        "size": "20",
        "sort": "date,asc",
    }

    cat = args.get("category", "default").strip().lower()
    if cat in CATEGORY_TO_SEGMENT:
        params["segmentId"] = CATEGORY_TO_SEGMENT[cat]

    if lat is not None and lng is not None:
        params["geoPoint"] = geohash.encode(float(lat), float(lng), 7)
    return params


@app.route('/')
def index():
    return send_from_directory(".", "events.html")


@app.get("/search")
def search_events():

    keyword = request.args.get("keyword", "").strip()
    distance = request.args.get("distance", "").strip()
    category = request.args.get("category", "default").strip().lower()
    location_txt = request.args.get("location", "").strip()
    lat = request.args.get("lat", type=float)
    lng = request.args.get("lng", type=float)

    if not keyword:
        return jsonify({"error": "Missing required field: keyword"}), 400
    
    if lat is None or lng is None:
        if location_txt:
            lat, lng = geocode_address(location_txt)
        if lat is None or lng is None:
            return jsonify({"error": "Missing location: provide either (lat,lng) or a valid address"}), 400
    
    tm_params = build_tm_params(request.args, lat, lng)
    tm_url = "https://app.ticketmaster.com/discovery/v2/events.json"

    try:
        resp = requests.get(tm_url, params=tm_params, timeout=10)
        resp.raise_for_status()
    except requests.RequestException as e:
        return jsonify({"error": f"Ticketmaster request failed: {e}"}), 502
    
    data = resp.json()
    return jsonify(data)


@app.get("/event")
def event_details():
    event_id = request.args.get("id", "").strip()
    if not event_id:
        return jsonify({"error": "missing id"}), 400

    url = f"https://app.ticketmaster.com/discovery/v2/events/{event_id}.json"
    params = {"apikey": TM_API_KEY}

    try:
        r = requests.get(url, params=params, timeout=10)
        r.raise_for_status()
        return jsonify(r.json())
    except requests.RequestException as e:
        code = getattr(e.response, "status_code", 502)
        body = getattr(e.response, "text", str(e))[:500]
        return jsonify({"error": "TM event failed", "status": code, "body": body}), 502


@app.get("/venue")
def venue_details():
    keyword = request.args.get("keyword", "").strip()
    if not keyword:
        return jsonify({"error": "missing keyword"}), 400

    url = "https://app.ticketmaster.com/discovery/v2/venues.json"
    params = {"apikey": TM_API_KEY, "keyword": keyword}

    try:
        r = requests.get(url, params=params, timeout=10)
        r.raise_for_status()
        return jsonify(r.json())
    except requests.RequestException as e:
        code = getattr(e.response, "status_code", 502)
        body = getattr(e.response, "text", str(e))[:500]
        return jsonify({"error": "TM venue failed", "status": code, "body": body}), 502


@app.get("/ipinfo")
def ipinfo():
    """Proxy endpoint for ipinfo.io to keep token server-side"""
    if not IPINFO_TOKEN:
        return jsonify({"error": "IPINFO_TOKEN not configured"}), 500
    
    url = "https://ipinfo.io/json"
    params = {"token": IPINFO_TOKEN}
    
    try:
        r = requests.get(url, params=params, timeout=10)
        r.raise_for_status()
        return jsonify(r.json())
    except requests.RequestException as e:
        code = getattr(e.response, "status_code", 502)
        body = getattr(e.response, "text", str(e))[:500]
        return jsonify({"error": "ipinfo request failed", "status": code, "body": body}), 502



if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080, debug=True)