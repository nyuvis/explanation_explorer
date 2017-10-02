#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from __future__ import print_function
from __future__ import division

import os
import csv
import zipfile
import numpy as np
from sklearn.neural_network import MLPClassifier
from sklearn.metrics import roc_auc_score
from scipy.sparse import csr_matrix

from defs import Model
from lime import LIME


class AirbnbModel(Model):
    def __init__(self):
        rng = np.random.RandomState(0)
        train_ratio = 0.9
        labels = []
        features = None

        if not os.path.exists("example/airbnb/airbnb.csr"):
            with zipfile.ZipFile("example/airbnb/airbnb.zip", 'r') as zf:
                print("extracting airbnb.csr")
                zf.extractall("example/airbnb/")

        data = []
        indices = []
        indptr = [ 0 ]
        print("loading airbnb.csr")
        with open("example/airbnb/airbnb.csr", "r") as f_in:
            for row in csv.reader(f_in):
                if features is None:
                    features = row[1:]
                    continue
                labels.append(int(row[0]) > 0)
                for fix in row[1:]:
                    data.append(True)
                    indices.append(fix)
                indptr.append(len(data))
        features = [ "\"{0}\"".format(f) for f in features ]
        labels = np.array(labels, dtype=np.bool)
        rows = csr_matrix((data, indices, indptr),
            shape=(len(indptr) - 1, len(features)), dtype=np.bool).todense()
        print("loading done")
        ixs = list(range(rows.shape[0]))
        rng.shuffle(ixs)
        split = int(np.floor(train_ratio * rows.shape[0]))
        train_ixs = ixs[:split]
        test_ixs = ixs[split:]
        print("training model")
        model = MLPClassifier(activation='relu', random_state=rng, shuffle=True,
            hidden_layer_sizes=tuple([ 1000 for _ in range(4) ]),
            max_iter=1000, early_stopping=True, learning_rate='adaptive')
        model.fit(rows[train_ixs, :], labels[train_ixs])
        print("training done")
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

    def use_csr(self):
        """Whether to use CSR instead of CSV to store the matrix."""
        return True

    def create_explainer(self):
        return LIME(batch_size=1000, step=3, weight_th=1.2, max_radius=0.5, max_length=10)
