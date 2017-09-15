#!/bin/env sh
cd /projects/explanation_explorer/
source venv/bin/activate
python server.py --heroku -a 0 -p 15202 output/examplemodel.csv output/examplemodel.lime.json
