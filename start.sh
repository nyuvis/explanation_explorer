#!/bin/env sh
cd /projects/explanation_explorer/
source venv/bin/activate
python server.py output/examplemodel.csv output/examplemodel.lime.json
