#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from __future__ import print_function
from __future__ import division

import csv
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import roc_auc_score

from defs import Model
from lime import LIME


CLASSES = {
    "p": False,
    "e": True,
}
VALUES = [
    {
        "b": "bell",
        "c": "conical",
        "x": "convex",
        "f": "flat",
        "k": "knobbed",
        "s": "sunken",
    }, {
        "f": "fibrous",
        "g": "grooves",
        "y": "scaly",
        "s": "smooth",
    }, {
        "n": "brown",
        "b": "buff",
        "c": "cinnamon",
        "g": "gray",
        "r": "green",
        "p": "pink",
        "u": "purple",
        "e": "red",
        "w": "white",
        "y": "yellow",
    }, {
        "t": "yes",
        "f": "no",
    }, {
        "a": "almond",
        "l": "anise",
        "c": "creosote",
        "y": "fishy",
        "f": "foul",
        "m": "musty",
        "n": "none",
        "p": "pungent",
        "s": "spicy",
    }, {
        "a": "attached",
        "d": "descending",
        "f": "free",
        "n": "notched",
    }, {
        "c": "close",
        "w": "crowded",
        "d": "distant",
    }, {
        "b": "broad",
        "n": "narrow",
    }, {
        "k": "black",
        "n": "brown",
        "b": "buff",
        "h": "chocolate",
        "g": "gray",
        "r": "green",
        "o": "orange",
        "p": "pink",
        "u": "purple",
        "e": "red",
        "w": "white",
        "y": "yellow",
    }, {
        "e": "enlarging",
        "t": "tapering",
    }, {
        "b": "bulbous",
        "c": "club",
        "u": "cup",
        "e": "equal",
        "z": "rhizomorphs",
        "r": "rooted",
    }, {
        "f": "fibrous",
        "y": "scaly",
        "k": "silky",
        "s": "smooth",
    }, {
        "f": "fibrous",
        "y": "scaly",
        "k": "silky",
        "s": "smooth",
    }, {
        "n": "brown",
        "b": "buff",
        "c": "cinnamon",
        "g": "gray",
        "o": "orange",
        "p": "pink",
        "e": "red",
        "w": "white",
        "y": "yellow",
    }, {
        "n": "brown",
        "b": "buff",
        "c": "cinnamon",
        "g": "gray",
        "o": "orange",
        "p": "pink",
        "e": "red",
        "w": "white",
        "y": "yellow",
    }, {
        "p": "partial",
        "u": "universal",
    }, {
        "n": "brown",
        "o": "orange",
        "w": "white",
        "y": "yellow",
    }, {
        "n": "none",
        "o": "one",
        "t": "two",
    }, {
        "c": "cobwebby",
        "e": "evanescent",
        "f": "flaring",
        "l": "large",
        "n": "none",
        "p": "pendant",
        "s": "sheathing",
        "z": "zone",
    }, {
        "k": "black",
        "n": "brown",
        "b": "buff",
        "h": "chocolate",
        "r": "green",
        "o": "orange",
        "u": "purple",
        "w": "white",
        "y": "yellow",
    }, {
        "a": "abundant",
        "c": "clustered",
        "n": "numerous",
        "s": "scattered",
        "v": "several",
        "y": "solitary",
    }, {
        "g": "grasses",
        "l": "leaves",
        "m": "meadows",
        "p": "paths",
        "u": "urban",
        "w": "waste",
        "d": "woods",
    },
]
FEATURES = [
    "cap-shape",
    "cap-surface",
    "cap-color",
    "bruises",
    "odor",
    "gill-attachment",
    "gill-spacing",
    "gill-size",
    "gill-color",
    "stalk-shape",
    "stalk-root",
    "stalk-surface",
    "stalk-surface",
    "stalk-color",
    "stalk-color",
    "veil-type",
    "veil-color",
    "ring-number",
    "ring-type",
    "spore-print",
    "population",
    "habitat",
]
class ExampleModel(Model):
    def __init__(self):
        rng = np.random.RandomState(0)
        train_ratio = 0.1
        labels = []
        rows = []
        features = []
        fix_lookup = {}
        for (fix, f) in enumerate(FEATURES):
            for (k, v) in VALUES[fix].items():
                fix_lookup[(fix, k)] = len(features)
                features.append("{0}={1}".format(f, v))
        with open("example/agaricus-lepiota.data", "r") as f_in:
            for row in csv.reader(f_in):
                labels.append(CLASSES[row[0].strip()])
                cur = [ False for _ in features ]
                for (fix, r) in enumerate(row[1:]):
                    if r.strip() == "?":
                        r = rng.choice(list(VALUES[fix].keys()))
                    cur[fix_lookup[(fix, r.strip())]] = True
                rows.append(cur)
        labels = np.array(labels, dtype=np.bool)
        rows = np.array(rows, dtype=np.bool)
        ixs = list(range(rows.shape[0]))
        rng.shuffle(ixs)
        split = int(np.floor(train_ratio * rows.shape[0]))
        train_ixs = ixs[:split]
        test_ixs = ixs[split:]
        model = RandomForestClassifier(random_state=rng)
        model.fit(rows[train_ixs, :], labels[train_ixs])
        self._cix = model.classes_.tolist().index(True)
        train_pred = model.predict_proba(rows[train_ixs, :])[:, self._cix]
        self._train_auc = roc_auc_score(labels[train_ixs], train_pred)
        test_pred = model.predict_proba(rows[test_ixs, :])[:, self._cix]
        self._test_auc = roc_auc_score(labels[test_ixs], test_pred)
        self._x = rows[test_ixs, :]
        self._y = labels[test_ixs]
        self._features = features
        self._threshold = self._get_threshold(labels[train_ixs], train_pred)
        self._model = model

    def _get_threshold(self, labels, preds):
        th_pos = {}
        th_neg = {}
        total_neg = 0
        # count labels
        for (ix, p) in enumerate(preds.tolist()):
            p = np.float64(p)
            if p not in th_pos:
                th_pos[p] = 0
            if p not in th_neg:
                th_neg[p] = 0
            if labels[ix]:
                th_pos[p] += 1
            else:
                total_neg += 1
                th_neg[p] += 1
        ths = sorted(th_pos.keys())
        # first threshold == 0
        fp = total_neg
        fn = 0
        best_t = None
        best_v = None
        for (ix, th) in enumerate(ths):
            v = fp + fn
            if best_v is None or v < best_v:
                best_v = v
                best_t = th
            fp -= th_neg[th]
            fn += th_pos[th]
        return best_t

    def test_auc(self):
        """Returns the area under ROC curve for the test data."""
        return self._test_auc

    def train_auc(self):
        """Returns the area under ROC curve for the training data."""
        return self._train_auc

    def shape(self):
        """Returns the shape of the test data."""
        return self._x.shape

    def features(self):
        """Returns the feature names as list."""
        return self._features

    def threshold(self):
        """The threshold for prediction scores."""
        return self._threshold

    def get_label(self, rix):
        """Returns the binary (True or False) label of the test data row with the given index."""
        return self._y[rix]

    def get_row(self, rix):
        """Returns the given row of the test data."""
        return self._x[rix, :]

    def predict_proba(self, X):
        """Returns the prediction scores for X. For each row one prediction
           score must be returned (output shape is (X.shape[0],)).

        Parameters:
        -----------
        X : np.matrix or np.array
            The data to predict.
        """
        return self._model.predict_proba(X)[:, self._cix]

    def create_explainer(self):
        return LIME(step=1.1, weight_th=2.1)
