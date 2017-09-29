#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from __future__ import print_function
from __future__ import division

import importlib

from lime import LIME
import numpy as np


class Model(object):
    def test_auc(self):
        """Returns the area under ROC curve for the test data."""
        raise NotImplementedError()

    def train_auc(self):
        """Returns the area under ROC curve for the training data."""
        raise NotImplementedError()

    def shape(self):
        """Returns the shape of the test data."""
        raise NotImplementedError()

    def features(self):
        """Returns the feature names as list.
           Features that contain a '=' are interpreted as categorical
           features where the left side is the name and the right side is
           the value of the feature.
        """
        raise NotImplementedError()

    def threshold(self):
        """The threshold for prediction scores."""
        raise NotImplementedError()

    def get_label(self, rix):
        """Returns the binary (True or False) label of the test data row with the given index."""
        raise NotImplementedError()

    def get_row(self, rix):
        """Returns the given row of the test data."""
        raise NotImplementedError()

    def predict_proba(self, X):
        """Returns the prediction scores for X. For each row one prediction
           score must be returned (output shape is (X.shape[0],)).

        Parameters:
        -----------
        X : np.matrix or np.array
            The data to predict.
        """
        raise NotImplementedError()

    def predict_label(self, X):
        return self.predict_score(self.predict_proba(X))

    def predict_score(self, scores):
        return scores >= self.threshold()

    def total_pos(self):
        total = 0
        for rix in range(self.shape()[0]):
            if self.get_label(rix):
                total += 1
        return total

    def use_csr(self):
        """Whether to use CSR instead of CSV to store the matrix."""
        return True

    def create_explainer(self):
        return LIME()


def load(module, name):
    """Loads the given module and expects a class name derived from Model.
       The class is created with the standard constructor.
    """
    mod = importlib.import_module(module, __name__)
    return getattr(mod, name)()
