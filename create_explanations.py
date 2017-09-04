#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from __future__ import print_function
from __future__ import division

import os
import sys
import argparse

from defs import load

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Create explanations')
    parser.add_argument('module', type=str, help="module containing the Model derived class")
    parser.add_argument('name', type=str, help="the Model derived class name")
    parser.add_argument('output', type=str, help="the output folder")
    args = parser.parse_args()

    output = args.output
    if not os.path.exists(output):
        os.makedirs(output)

    name = args.name
    model = load(args.module, name)
    name = name.lower()
    expl = model.create_explainer()
    expl_name = expl.__class__.__name__.lower()
    csv_fname = os.path.join(output, "{0}.csv".format(name))
    print("writing CSV to {0}".format(csv_fname))
    expl.write_csv(model, csv_fname)
    print("writing CSV done")
    expl_fname = os.path.join(output, "{0}.{1}.json".format(name, expl_name))
    print("writing explanations to {0}".format(expl_fname))
    expl.write_expl(model, expl_fname)
    print("writing explanations done")
