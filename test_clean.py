import re

def normalize_product(code, set_type, raw_items, price):
    t = raw_items or ""
    # Standard replacements
    t = re.sub(r'Power[,\s]+Bank\s*(?:\(?\s*10[,\s]*000\s*m?ah\s*\)?)?', 'Power Bank 10000mAh', t, flags=re.I)
    t = re.sub(r'Power[,\s]+Bank\s*(?:\(?\s*8[,\s]*000\s*m?ah\s*\)?)?', 'Power Bank 8000mAh', t, flags=re.I)
    t = re.sub(r'Power[,\s]+Bank\s*(?:\(?\s*5[,\s]*000\s*m?ah\s*\)?)?', 'Power Bank 5000mAh', t, flags=re.I)
    t = re.sub(r'Key[,\s]+Chain', 'Metal Keychain', t, flags=re.I)
    t = re.sub(r'Card[,\s]+Holder', 'Visiting Card Case', t, flags=re.I)
    t = re.sub(r'Desktop\s*Matt', 'Vegan Leather Desk Mat', t, flags=re.I)
    t = re.sub(r'Desk\s*Cube', 'Desk Calendar Cube', t, flags=re.I)
    t = re.sub(r'Pen[,\s]+Holder', 'Desk Pen Stand', t, flags=re.I)
    t = re.sub(r'3\s*in\s*1\s*Data\s*Cable', '3-in-1 Fast Braided Cable', t, flags=re.I)
    t = re.sub(r'Wireless[,\s]+Mouse', 'Wireless Ergonomic Mouse', t, flags=re.I)
    t = re.sub(r'32\s*Pen\s*Drive|Pen\s*Drive', '32GB Metal USB Drive', t, flags=re.I)
    t = re.sub(r'Insulated\s*Temp\s*Mug', 'LED Temp Display Smart Mug', t, flags=re.I)
    t = re.sub(r'Temperature\s*Flask', 'LED Temperature Flask (500ml)', t, flags=re.I)
    t = re.sub(r'Temperature\s*Bottle', 'LED Temperature Bottle (500ml)', t, flags=re.I)
    t = re.sub(r'Insulated\s*Flask\s*500ml', 'Double-Walled Insulated Flask 500ml', t, flags=re.I)
    t = re.sub(r'Insulated\s*Flask', 'Double-Walled Insulated Flask', t, flags=re.I)
    t = re.sub(r'Insulated\s*Bottle', 'Insulated Stainless Steel Bottle', t, flags=re.I)
    t = re.sub(r'Insulated\s*Mug', 'Stainless Steel Insulated Mug', t, flags=re.I)
    t = re.sub(r'Ss\s*Mug', 'Stainless Steel Travel Mug', t, flags=re.I)
    t = re.sub(r'SS\s*Bottle', 'Stainless Steel Water Bottle', t, flags=re.I)
    t = re.sub(r'Beer\s*Mug', 'Stainless Steel Tankard Mug', t, flags=re.I)
    t = re.sub(r'750\s*ml\s*Flask', 'Insulated Flask (750ml)', t, flags=re.I)
    t = re.sub(r'2\s*steel\s*Mug|2\s*Tea\s*Mug|2\s*Insulated\s*Mug', 'Pair of Stainless Steel Mugs', t, flags=re.I)
    t = re.sub(r'Auto\s*Open\s*Auto\s*Close[,\s]*Umbrella|Umbrella', 'Auto Open/Close Compact Umbrella', t, flags=re.I)
    t = re.sub(r'Mobile\s*Holder\s*Note\s*Book', 'Executive Notebook with Phone Slot', t, flags=re.I)
    t = re.sub(r'Mobile\s*Stand', 'Foldable Metallic Mobile Stand', t, flags=re.I)
    t = re.sub(r'Power\s*Bank\s*Note\s*Book\s*8000\s*MAH', 'Powerbank Diary (8000mAh Built-in)', t, flags=re.I)
    t = re.sub(r'Note\s*Book', 'Premium Hardbound Journal', t, flags=re.I)
    t = re.sub(r'Metal\s*pen', 'Executive Metal Rollerball Pen', t, flags=re.I)
    t = re.sub(r'\bPen\b', 'Executive Metal Pen', t, flags=re.I)
    t = re.sub(r'Plant\s*Tube', 'Eco Desk Planter Hydroponic Tube', t, flags=re.I)
    t = re.sub(r'Desk\s*Organiser', 'Multi-Compartment Desk Organizer', t, flags=re.I)
    t = re.sub(r'Glass\s*Mug', 'Borosilicate Glass Coffee Mug', t, flags=re.I)
    t = re.sub(r'Wireless\s*Charger', 'Fast Wireless Charging Pad', t, flags=re.I)
    t = re.sub(r'Gadget\s*Pouch', 'Shockproof Travel Tech Pouch', t, flags=re.I)
    t = re.sub(r'Digital\s*Clock', 'Digital Desk Clock & Temperature Display', t, flags=re.I)
    t = re.sub(r'\bClock\b', 'Minimalist Desk Clock', t, flags=re.I)
    t = re.sub(r'Tumbler', 'Vacuum Insulated Coffee Tumbler', t, flags=re.I)
    t = re.sub(r'Wallet', 'RFID-Blocking Leather Wallet', t, flags=re.I)
    t = re.sub(r'Calendar', 'Perpetual Metal Desk Calendar', t, flags=re.I)
    t = re.sub(r'\bMug\b', 'Stainless Steel Insulated Mug', t, flags=re.I)
    t = re.sub(r'\bBottle\b', 'Stainless Steel Thermal Bottle', t, flags=re.I)
    t = re.sub(r'\bFlask\b', 'Stainless Steel Insulated Flask', t, flags=re.I)

    raw_tokens = [x.strip() for x in re.split(r'[,&]+', t) if x.strip()]
    items = []
    for tok in raw_tokens:
        tok = re.sub(r'\s+', ' ', tok).strip()
        # filter junk tokens
        if tok and len(tok) > 2 and tok not in items and tok.lower() not in ['mah', 'drive', '000', '000mah', 'key', 'chain', 'card', 'holder']:
            items.append(tok)
            
    # Fix set type if empty
    st = set_type or (f"{len(items)}in1" if len(items) > 1 else "Executive")
    st_clean = st.lower().replace("in", "-in-")
    
    # Determine category
    item_str_lower = " ".join(items).lower()
    if any(k in item_str_lower for k in ['power bank', 'wireless', 'usb', 'charger', 'mouse', 'clock', 'pouch']):
        category = "Tech & Gadgets"
    elif any(k in item_str_lower for k in ['flask', 'bottle', 'mug', 'tumbler']):
        category = "Drinkware & Executive Sets"
    elif any(k in item_str_lower for k in ['desk mat', 'desk organizer', 'planter', 'calendar', 'pen stand']):
        category = "Desk & Workspace Essentials"
    else:
        category = "Stationery & Journal Combos"
        
    # Occasions
    occasions = ["Employee Onboarding", "Corporate Gifting"]
    if price >= 1000 or len(items) >= 4:
        occasions.append("Executive & VIP")
    if any(k in item_str_lower for k in ['flask', 'mug', 'umbrella', 'wallet']):
        occasions.append("Festive & Celebrations")
    if any(k in item_str_lower for k in ['journal', 'pen', 'card case']):
        occasions.append("Conferences & Seminars")
        
    # Name generation
    hero_items = items[:3]
    if len(hero_items) >= 2:
        hero_phrase = f"{hero_items[0]} & {hero_items[1]}"
    elif len(hero_items) == 1:
        hero_phrase = hero_items[0]
    else:
        hero_phrase = "Corporate Gift Collection"
        
    name = f"{st_clean.upper()} {hero_phrase} Set"
    name = name.replace("Set Set", "Set")
    
    return {
        "name": name,
        "clean_items": items,
        "set_type_display": st_clean.upper(),
        "category": category,
        "occasions": occasions,
        "standardized_description": f"Curated {st_clean.upper()} corporate gift box featuring {', '.join(items)}. Custom company logo engraving/printing available with premium presentation box."
    }

print(normalize_product("SG 547", "3in1", "Temperature Flask, Metal pen, Note Book", 390))
print(normalize_product("SG 536", "6in1", "Note Book, Key, Chain,Pen, Power Bank 10,000, MAH,Wireless, Mouse", 1950))
