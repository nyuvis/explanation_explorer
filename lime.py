#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from __future__ import print_function
from __future__ import division

from progressor import progress_map

import csv
import sys
import json

import numpy as np
from sklearn.metrics import roc_auc_score
from sklearn.linear_model import LogisticRegression


class ExplanationGenerator(object):
    def __init__(self):
        self._has_err = False

    def write_csv(self, model, filename):
        with open(filename, "w") as f_out:
            out = csv.writer(f_out)
            out.writerow(model.features() + [ "label" ])
            shape = model.shape()
            for rix in range(shape[0]):
                row = np.array(model.get_row(rix)).reshape((-1,))
                out.writerow([
                    1 if row[cix] > 0 else 0
                    for cix in range(shape[1])
                ] + [ 1 if model.get_label(rix) else 0 ])

    def write_expl(self, model, filename):
        obj = self.get_expl_obj(model)
        obj["test_auc"] = float(obj["test_auc"])
        obj["train_auc"] = float(obj["train_auc"])
        obj["total_rows"] = int(obj["total_rows"])
        obj["total_true"] = int(obj["total_true"])
        obj["threshold"] = float(obj["threshold"])
        obj["expls"] = [ {
            "ix": int(o["ix"]),
            "label": int(o["label"]),
            "pred": float(o["pred"]),
            "pred_label": int(o["pred_label"]),
            "expl": o["expl"],
            "postfixes": o["postfixes"],
        } for o in obj["expls"] ]
        with open(filename, "w") as f_out:
            json.dump(obj, f_out, indent=2, sort_keys=True)

    def get_expl_obj(self, model):
        self._has_err = False
        sampler = self.create_sampler(model)
        shape = model.shape()

        def get_expl(rix):
            row = np.array(model.get_row(rix)).reshape((1, -1))
            pred_score = model.predict_proba(row)[0]
            pred = model.predict_score(pred_score)
            label = model.get_label(rix)
            expl = self.get_explanation(sampler, model, row, label, rix)
            return {
                "ix": rix,
                "label": 1 if label else 0,
                "pred": pred_score,
                "pred_label": pred,
                "expl": expl,
                "postfixes": [ "" for _ in range(row.shape[1]) ],
            }

        expls = progress_map(list(range(shape[0])), get_expl, out=sys.stdout, prefix='expl')
        return {
            "features": model.features(),
            "test_auc": model.test_auc(),
            "train_auc": model.train_auc(),
            "total_rows": shape[0],
            "total_true": model.total_pos(),
            "threshold": model.threshold(),
            "expls": expls,
        }

    def create_sampler(self, model):
        raise NotImplementedError()

    def get_explanation(self, sampler, model, row, label, rix):
        raise NotImplementedError()


class LIME(ExplanationGenerator):
    def __init__(self, batch_size=100, start_radius=1e-2, step=1.8, weight_th=1.0):
        ExplanationGenerator.__init__(self)
        self._bs = batch_size
        self._sr = start_radius
        self._ss = step
        self._wt = weight_th
        self._warn_low_auc = None

    def get_explanation(self, sampler, model, row, label, rix):
        rng = np.random.RandomState(rix)
        s_rows, s_labels = self._sample(sampler, model, row, label, rng)
        res = self._sample_model(s_rows, s_labels, rng)
        ixs = np.argsort(-np.abs(res)).tolist()
        prefixs = [ "↓", " ", "↑" ]
        return [ [ ix, prefixs[int(np.sign(res[ix]) + 1)] ] for ix in ixs if np.abs(res[ix]) >= self._wt ]

    def create_sampler(self, model):
        features = model.features()
        f_groups = {}

        for (fix, f) in enumerate(features):
            if "=" not in f:
                if f in f_groups:
                    raise ValueError("duplicate feature name '{0}'".format(f))
                f_groups[f] = [ fix ]
                continue
            f = f[:f.index("=")]
            if f not in f_groups:
                f_groups[f] = []
            f_groups[f].append(fix)

        fixss = list(f_groups.values())

        def sample(mat, rng, r):
            for rix in range(mat.shape[0]):
                for fixs in fixss:
                    if rng.uniform() < r:
                        if len(fixs) == 1:
                            mat[rix, fixs[0]] = rng.choice([ False, True ])
                        else:
                            mat[rix, fixs] = False
                            mat[rix, rng.choice(fixs)] = True

        return sample

    def _sample(self, sampler, model, row, own_label, rng):
        bs = self._bs
        radius = self._sr
        step = self._ss
        all_rows = None
        all_labels = np.array([], dtype=np.bool)
        while min(np.sum(all_labels), all_labels.shape[0] - np.sum(all_labels)) < bs / 2:
            batch = np.repeat(row, bs, axis=0)
            sampler(batch, rng, radius)
            labels = model.predict_label(batch) == own_label
            all_rows = np.vstack((all_rows, batch)) if all_rows is not None else batch
            all_labels = np.hstack((all_labels, labels))
            radius *= step
            if radius > 1e10:
                if not self._has_err:
                    self._msg("[WARNING] no valid sample found!")
                self._has_err = True
                break
        return all_rows, all_labels

    def _sample_model(self, rows, labels, rng):
        if np.unique(labels).shape[0] < 2:
            return np.zeros((rows.shape[1],))
        lr = LogisticRegression(random_state=rng)
        lr.fit(rows, labels)

        preds = lr.predict_proba(rows)
        preds = preds[:, list(lr.classes_).index(True)]
        auc = roc_auc_score(labels, preds)
        if (self._warn_low_auc is None and auc < 0.7) or \
                (self._warn_low_auc is not None and auc < self._warn_low_auc):
            self._msg("[WARNING] low AUC for local model: {0}", auc)
            self._warn_low_auc = auc
        if auc <= 0.5:
            return np.zeros((rows.shape[1],))
        return lr.coef_.reshape((-1,))
