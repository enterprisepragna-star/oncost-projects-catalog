import re

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
    # Split raw string
    raw_str = raw_items.replace(" & ", ", ").replace(" and ", ", ").replace("&", ", ")
    # Fix comma splits like 'Key, Chain', 'Card, Holder', 'Power, Bank', '10, 000, MAH'
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
        # Check against ITEM_MAP
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

# Test with various products
samples = [
    "Temperature Flask, Metal pen, Note Book",
    "Temperature Flask, Metal pen, Note Book, Key Chain, Insulated Mug",
    "Note Book , Pen",
    "Note Book , Pen & Key Chain",
    "Note Book, Desktop Matt, Pen, Pen Holder, Calendar,Key, Chain",
    "Note Book, Key Chain, 3 in 1 Data Cable, Power Bank 10,000 MAH, Wireless Charger, Gadget Pouch",
    "Insulated Flask 500ml, 2 steel Mug, Auto Open Auto Close, Umbrella",
    "Note Book,Mug,Pen,Flask, Speaker, Key Chain"
]
for s in samples:
    print(s)
    print(" ->", parse_items(s))
    print()
