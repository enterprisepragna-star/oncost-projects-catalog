import asyncio, json, re
from motor.motor_asyncio import AsyncIOMotorClient

ITEM_MAP = [
    (r'power\s*bank.*8000.*note\s*book', 'Power Bank Diary (8000mAh Built-in)'),
    (r'power\s*bank.*10\s*000', '10,000mAh Fast Power Bank'),
    (r'power\s*bank.*5\s*000', '5,000mAh Slim Power Bank'),
    (r'power\s*bank', 'Fast-Charging Power Bank'),
    (r'mobile\s*holder\s*note\s*book', 'Executive Notebook with Phone Pocket'),
    (r'note\s*book', 'Executive Hardcover Journal'),
    (r'metal\s*pen', 'Executive Metal Rollerball Pen'),
    (r'\bpen\b', 'Signature Metal Pen'),
    (r'key\s*chain', 'Branded Metal Keychain'),
    (r'card\s*holder', 'Metal Visiting Card Case'),
    (r'desktop\s*matt|desk\s*mat', 'Vegan Leather Desk Mat'),
    (r'desk\s*cube', 'Perpetual Calendar Desk Cube'),
    (r'pen\s*holder|pen\s*stand', 'Desk Pen Stand & Organizer'),
    (r'desk\s*organis?er', 'Multi-Compartment Desk Organizer'),
    (r'plant\s*tube', 'Eco Desk Hydroponic Planter'),
    (r'wireless\s*mouse', 'Wireless Optical Mouse'),
    (r'wireless\s*charger', 'Fast Wireless Charging Pad'),
    (r'data\s*cable|charging\s*cable', '3-in-1 Fast Braided Cable'),
    (r'gadget\s*pouch', 'Protective Travel Tech Pouch'),
    (r'pen\s*drive|usb', '32GB Metal USB Flash Drive'),
    (r'temp.*mug', 'Smart LED Temperature Mug'),
    (r'temp.*flask', 'Smart LED Temperature Flask (500ml)'),
    (r'temp.*bottle', 'Smart LED Temperature Bottle (500ml)'),
    (r'insulated\s*flask', 'Vacuum Insulated Flask'),
    (r'insulated\s*bottle', 'Insulated Stainless Steel Bottle'),
    (r'insulated\s*mug', 'Stainless Steel Thermal Mug'),
    (r'ss\s*mug|steel\s*mug', 'Stainless Steel Mug'),
    (r'glass\s*mug', 'Borosilicate Glass Mug'),
    (r'beer\s*mug', 'Stainless Steel Tankard Mug'),
    (r'tumbler', 'Vacuum Insulated Coffee Tumbler'),
    (r'ss\s*bottle|steel\s*bottle', 'Stainless Steel Bottle'),
    (r'bottle', 'Stainless Steel Water Bottle'),
    (r'flask', 'Stainless Steel Insulated Flask'),
    (r'mug', 'Stainless Steel Coffee Mug'),
    (r'umbrella', 'Auto Open/Close Travel Umbrella'),
    (r'mobile\s*stand', 'Foldable Metallic Mobile Stand'),
    (r'wallet', 'RFID-Protected Leather Wallet'),
    (r'digital\s*clock', 'Digital Desk Clock & Thermometer'),
    (r'clock', 'Minimalist Desk Clock'),
    (r'calendar', 'Perpetual Metal Desk Calendar'),
    (r'speaker', 'Portable Wireless Bluetooth Speaker'),
]

def parse_items(raw_items):
    raw_str = (raw_items or "").replace(" & ", ", ").replace(" and ", ", ").replace("&", ", ")
    raw_str = re.sub(r'Key[,\s]+Chain', 'Key Chain', raw_str, flags=re.I)
    raw_str = re.sub(r'Card[,\s]+Holder', 'Card Holder', raw_str, flags=re.I)
    raw_str = re.sub(r'Power[,\s]+Bank', 'Power Bank', raw_str, flags=re.I)
    raw_str = re.sub(r'Desk[,\s]+Cube', 'Desk Cube', raw_str, flags=re.I)
    raw_str = re.sub(r'Pen[,\s]+Holder', 'Pen Holder', raw_str, flags=re.I)
    raw_str = re.sub(r'Desk[,\s]+Organis?er', 'Desk Organizer', raw_str, flags=re.I)
    raw_str = re.sub(r'Plant[,\s]+Tube', 'Plant Tube', raw_str, flags=re.I)
    raw_str = re.sub(r'Desktop[,\s]+Matt', 'Desktop Matt', raw_str, flags=re.I)
    raw_str = re.sub(r'3\s*in\s*1\s*Data\s*Cable', '3-in-1 Data Cable', raw_str, flags=re.I)
    raw_str = re.sub(r'Auto\s*Open[,\s]*Auto\s*Close[,\s]*Umbrella', 'Umbrella', raw_str, flags=re.I)
    raw_str = re.sub(r'10[,\s]*000[,\s]*MAH', '10000 MAH', raw_str, flags=re.I)
    raw_str = re.sub(r'5[,\s]*000[,\s]*MAH', '5000 MAH', raw_str, flags=re.I)
    raw_str = re.sub(r'8[,\s]*000[,\s]*MAH', '8000 MAH', raw_str, flags=re.I)

    chunks = [c.strip() for c in raw_str.split(',') if c.strip()]
    matched = []
    for c in chunks:
        found = False
        for pat, standard_name in ITEM_MAP:
            if re.search(pat, c, flags=re.I):
                if standard_name not in matched:
                    matched.append(standard_name)
                found = True
                break
        if not found and len(c) > 2 and c.lower() not in ['mah', 'drive', '000', '10000', 'key', 'chain', 'card', 'holder']:
            matched.append(c.title())
    return matched

def generate_product_meta(p):
    code = p['code']
    raw_items = p.get('items', '')
    raw_set_type = p.get('set_type', '').strip()
    sg_price = int(p.get('sg_price', 0))
    # oncost price estimate with rule
    oncost_price = sg_price + 50 if sg_price < 1000 else sg_price + 100
    
    clean_items = parse_items(raw_items)
    
    # Calculate set count
    num_items = len(clean_items)
    if not raw_set_type:
        set_type = f"{num_items}in1" if num_items > 1 else "Single"
    else:
        set_type = raw_set_type
        
    set_type_display = set_type.lower().replace("in", "-in-").upper()
    if set_type_display == "SINGLE":
        set_type_display = "Signature Item"
        
    # Categorization
    items_text = " ".join(clean_items).lower()
    if any(k in items_text for k in ['power bank', 'wireless', 'usb', 'charger', 'mouse', 'clock', 'speaker', 'tech pouch']):
        category = "Tech & Gadgets"
        cat_slug = "tech-gadgets"
    elif any(k in items_text for k in ['flask', 'bottle', 'mug', 'tumbler']):
        if num_items >= 4:
            category = "Executive Gift Hampers"
            cat_slug = "executive-hampers"
        else:
            category = "Drinkware & Travel"
            cat_slug = "drinkware-travel"
    elif any(k in items_text for k in ['desk mat', 'desk organizer', 'planter', 'calendar', 'pen stand']):
        category = "Desk & Workspace"
        cat_slug = "desk-workspace"
    else:
        category = "Journals & Stationery"
        cat_slug = "stationery"
        
    # Budget Tier
    if oncost_price < 500:
        budget_tier = "Under ₹500"
    elif oncost_price <= 1000:
        budget_tier = "₹500 - ₹1,000"
    elif oncost_price <= 2000:
        budget_tier = "₹1,000 - ₹2,000"
    else:
        budget_tier = "Above ₹2,000"
        
    # Occasions
    occasions = ["Employee Onboarding", "Corporate Gifting"]
    if oncost_price >= 800 or num_items >= 4:
        occasions.append("Executive & Leadership")
    if any(k in items_text for k in ['flask', 'mug', 'speaker', 'wallet', 'umbrella']):
        occasions.append("Diwali & Festive")
    if any(k in items_text for k in ['journal', 'pen', 'card case', 'mobile stand']):
        occasions.append("Conferences & Events")
        
    # Craft unique, elegant product name
    if "Power Bank Diary" in clean_items:
        name = f"Smart Powerbank Diary & Executive Suite ({set_type_display})"
    elif "10,000mAh Fast Power Bank" in clean_items and "Wireless Optical Mouse" in clean_items:
        name = f"Apex Executive Tech Suite ({set_type_display})"
    elif "Vegan Leather Desk Mat" in clean_items:
        name = f"Artisan Desk Organizer & Journal Hamper ({set_type_display})"
    elif "Eco Desk Hydroponic Planter" in clean_items:
        name = f"Green Workspace Desk Planter & Journal Set ({set_type_display})"
    elif "Smart LED Temperature Flask (500ml)" in clean_items and "Stainless Steel Thermal Mug" in clean_items:
        name = f"Regal Thermal Drinkware & Executive Journal Combo ({set_type_display})"
    elif "Smart LED Temperature Flask (500ml)" in clean_items:
        name = f"Smart LED Flask & Hardcover Journal Set ({set_type_display})"
    elif "Smart LED Temperature Mug" in clean_items:
        name = f"Smart Temp Mug & Executive Journal Set ({set_type_display})"
    elif "Vacuum Insulated Flask" in clean_items and "Auto Open/Close Travel Umbrella" in clean_items:
        name = f"All-Weather Travel & Executive Drinkware Combo ({set_type_display})"
    elif "Portable Wireless Bluetooth Speaker" in clean_items:
        name = f"Prestige Audio & Executive Desk Hamper ({set_type_display})"
    elif "Digital Desk Clock & Thermometer" in clean_items:
        name = f"Digital Chrono & Wireless Office Suite ({set_type_display})"
    elif num_items == 2 and "Executive Hardcover Journal" in clean_items and ("Signature Metal Pen" in clean_items or "Executive Metal Rollerball Pen" in clean_items):
        name = f"Classic Executive Journal & Pen Duo ({code})"
    elif num_items == 3 and "Executive Hardcover Journal" in clean_items and "Branded Metal Keychain" in clean_items:
        name = f"Essential Corporate Journal, Pen & Keychain Trio ({code})"
    elif num_items == 4 and "Metal Visiting Card Case" in clean_items:
        name = f"Executive 4-in-1 Desk & Card Case Collection ({code})"
    elif "Stainless Steel Coffee Mug" in clean_items or "Stainless Steel Thermal Mug" in clean_items:
        name = f"Corporate Drinkware & Journal Ensemble ({set_type_display})"
    else:
        # Fallback to smart descriptor
        top_2 = " & ".join(clean_items[:2]) if len(clean_items) >= 2 else (clean_items[0] if clean_items else "Corporate Gift Box")
        name = f"{set_type_display} {top_2} Set ({code})"
        
    desc = (
        f"A meticulously curated {set_type_display} corporate gift package combining {', '.join(clean_items)}. "
        f"Crafted specifically for professional gifting, each piece is housed in a bespoke matte presentation box "
        f"with high-density precision foam lining. Custom corporate logo branding available on all items."
    )
    
    return {
        "name": name,
        "clean_items": clean_items,
        "set_type_display": set_type_display,
        "category": category,
        "category_slug": cat_slug,
        "budget_tier": budget_tier,
        "occasions": occasions,
        "description": desc,
        "inclusions": clean_items,
        "branding_options": "Laser Engraving, UV Screen Printing, Custom Foil Debossing",
        "packaging_type": "Premium Matte Gift Box with Precision Protective Foam Cutouts",
        "indicative_delivery": "7-12 business days following artwork and sample approval",
        "price_disclaimer": "Prices are exclusive of 18% GST and standard shipping. Custom logo branding included on minimum order quantity (MOQ)."
    }

async def run():
    client = AsyncIOMotorClient('mongodb://127.0.0.1:27017')
    db = client['oncost']
    prods = await db.products.find({}).to_list(length=None)
    print(f"Enriching {len(prods)} products...")
    
    enriched_list = []
    for p in prods:
        meta = generate_product_meta(p)
        await db.products.update_one(
            {"_id": p["_id"]},
            {"$set": meta}
        )
        enriched_list.append({**p, **meta, "_id": str(p["_id"])})
        
    print(f"Successfully enriched {len(prods)} products in MongoDB!")
    
    # Also save to products_enriched.json
    with open('backend/data/products_enriched.json', 'w') as f:
        json.dump(enriched_list, f, indent=2)
    print("Saved enriched dataset to backend/data/products_enriched.json")
    
    # Print sample
    for it in enriched_list[:5]:
        print(f"[{it['code']}] {it['name']} | {it['category']} | {it['budget_tier']}")

asyncio.run(run())
