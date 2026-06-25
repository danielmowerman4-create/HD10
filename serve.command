#!/bin/bash
cd "$(dirname "$0")"
echo "HD10 dashboard → http://localhost:8010/"
python3 -m http.server 8010
