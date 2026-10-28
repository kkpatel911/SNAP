"""Download the reviewed product listing photos into the static website."""
import concurrent.futures
import json
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parents[1]


def download(entry):
    product_id, source = entry
    if source.get('source_type') == 'user-supplied':
        if not (ROOT / source['local']).is_file():
            raise FileNotFoundError(source['local'])
        return f'{product_id}: kept supplied photo'
    request = urllib.request.Request(source['image'], headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(request, timeout=30) as response:
        image = response.read()
        if not response.headers.get('Content-Type', '').startswith('image/'):
            raise ValueError(f'Product {product_id}: response is not an image')
    destination = ROOT / source['local']
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(image)
    return f'{product_id}: {destination.name} ({len(image):,} bytes)'


if __name__ == '__main__':
    sources = json.loads((ROOT / 'image-sources.json').read_text())
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        for result in pool.map(download, sources.items()):
            print(result)
