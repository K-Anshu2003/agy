from flask import Flask, render_template, jsonify, request
import urllib.request
import xml.etree.ElementTree as ET
import re
from datetime import datetime, timezone

app = Flask(__name__)

# Simple in-memory cache
cache = {
    'data': None,
    'last_fetched': None
}

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

def parse_release_notes():
    req = urllib.request.Request(
        FEED_URL, 
        headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
    )
    with urllib.request.urlopen(req) as response:
        xml_data = response.read()
        
    root = ET.fromstring(xml_data)
    ns = {'atom': 'http://www.w3.org/2005/Atom'}
    
    parsed_updates = []
    
    for entry in root.findall('atom:entry', ns):
        date_str = entry.find('atom:title', ns).text
        updated = entry.find('atom:updated', ns).text
        
        # Link mapping
        link_elem = entry.find('atom:link[@rel="alternate"]', ns)
        if link_elem is None:
            link_elem = entry.find('atom:link', ns)
        link = link_elem.attrib.get('href') if link_elem is not None else ''
        
        content_elem = entry.find('atom:content', ns)
        content_html = content_elem.text if content_elem is not None else ''
        
        # Split content_html by <h3> tags using regex
        pattern = re.compile(r'<h3[^>]*>(.*?)</h3>(.*?)(?=<h3|$)', re.DOTALL | re.IGNORECASE)
        matches = pattern.findall(content_html)
        
        if not matches:
            if not any(x in content_html.lower() for x in ['deprecation', 'deprecated']):
                parsed_updates.append({
                    'date': date_str,
                    'type': 'Update',
                    'content': content_html.strip(),
                    'link': link,
                    'updated': updated
                })
        else:
            for idx, (utype, ucontent) in enumerate(matches):
                utype_clean = utype.strip()
                if any(x in utype_clean.lower() for x in ['deprecation', 'deprecated']):
                    continue
                # Create anchor link if multiple
                anchor_link = f"{link}_{idx}" if idx > 0 else link
                parsed_updates.append({
                    'date': date_str,
                    'type': utype_clean,
                    'content': ucontent.strip(),
                    'link': anchor_link,
                    'updated': updated
                })
                
    return parsed_updates

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/release-notes')
def get_release_notes():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    now = datetime.now(timezone.utc)
    
    # Check cache validity (5 minutes)
    cache_valid = False
    if cache['data'] is not None and cache['last_fetched'] is not None:
        elapsed = (now - cache['last_fetched']).total_seconds()
        if elapsed < 300 and not force_refresh:
            cache_valid = True
            
    if not cache_valid:
        try:
            updates = parse_release_notes()
            cache['data'] = updates
            cache['last_fetched'] = now
        except Exception as e:
            # If fetch fails and we have cached data, return it with warning, else return error
            if cache['data'] is not None:
                return jsonify({
                    'status': 'warning',
                    'message': f'Failed to refresh feed: {str(e)}. Using cached data.',
                    'last_fetched': cache['last_fetched'].isoformat(),
                    'updates': cache['data']
                })
            return jsonify({
                'status': 'error',
                'message': f'Failed to fetch feed: {str(e)}',
                'updates': []
            }), 500
            
    return jsonify({
        'status': 'success',
        'last_fetched': cache['last_fetched'].isoformat(),
        'updates': cache['data']
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)
