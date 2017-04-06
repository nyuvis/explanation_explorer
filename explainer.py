#!/usr/bin/env python
# -*- coding: utf-8 -*-
from __future__ import print_function
from __future__ import division

import os
import csv
import sys
import json
import math
import time
import random

import numpy as np
from sklearn.tree import DecisionTreeClassifier
from scipy.sparse import coo_matrix

class Explanation(object):
    def __init__(self, features, pred, obj_up, obj_down):
        self._features = features
        self._pred = pred

        def convert(obj):
            return [ (
                int(e[0]),
                float(e[1]),
                frozenset([ int(f) for f in e[2] ])
            ) for e in obj ]

        self._expl_up = convert(obj_up)
        self._expl_down = convert(obj_down)

    def get_explanation(self, score):
        l, r = score
        up = self._pred < r
        if not up and self._pred < l:
            return []
        th = l if up else r
        expl = self._expl_up if up else self._expl_down

        def get_e():
            fs = []
            for e in expl:
                fs.append(e[0])
                p = e[1]
                if up:
                    if p >= th:
                        return fs, e[2]
                else:
                    if p < th:
                        return fs, e[2]
            return [], frozenset()

        def convert(fs, minus):
            return [ self._features[f] for f in fs if f not in minus ]

        return convert(*get_e())

def _get_int_type(maxsize):
    for dt in [ np.int8, np.int16, np.int32, np.int64 ]:
        if maxsize <= np.iinfo(dt).max:
            return dt
    raise ValueError("array too large: {0}".format(maxsize))

def _optimize_lookup(lookup):
    if min(lookup.keys()) < 0:
        raise ValueError("no index lookup optimization possible")
    high = max(lookup.keys())
    high_v = max(lookup.values())
    return np.array([ lookup[ix] if ix in lookup else -1 for ix in range(high + 1) ], dtype=_get_int_type(high_v))

class DataMatrix(object):
    def __init__(self, csvfile, ixs, train_ixs, labels, features, cache, msg):
        with cache.get_hnd({
                    "function": "dm",
                    "csv": csvfile,
                    "ixs": ixs,
                    "tixs": train_ixs,
                }, "explainer") as c:
            if c.has():
                load_time = time.clock()
                msg("loading matrix from cache..")
                matrix, ix_map, train_labels, train_ix_map = c.read()
                msg("loading matrix from cache took {0}s", time.clock() - load_time)
            else:
                matrix, ix_map, train_labels, train_ix_map = c.write(self._load(csvfile, ixs, train_ixs, labels, features, msg))
        self._matrix = matrix
        self._ix_map = ix_map
        self._features = features
        self._train_labels = train_labels
        self._train_ix_map = train_ix_map

    def _load(self, csvfile, ixs, train_ixs, labels, features, msg):
        load_time = time.clock()
        msg("loading matrix..")
        temp_labels = []
        features_checked = False
        temp_rows = []
        temp_cols = []
        ix_map = _optimize_lookup(dict([ (ix, pos) for (pos, ix) in enumerate(ixs) ]))

        skip = frozenset([ "label", "pred", "meta" ])
        with open(csvfile, 'r') as f_in:
            for (rix, row) in enumerate(csv.DictReader(f_in)):
                temp_labels.append(int(row["label"]) > 0)
                if not features_checked:
                    fset = set(features)
                    tfset = set([ f for f in row.keys() if f not in skip ])
                    if not tfset.issubset(fset):
                        raise ValueError("missing features in explanations: {0}".format(tfset.difference(fset)))
                    if not fset.issubset(tfset):
                        msg("superfluous features in explanations: {0}", fset.difference(tfset))
                    features_checked = True
                for (fix, f) in enumerate(features):
                    v = row[f]
                    if int(v) and ix_map[rix] >= 0:
                        temp_rows.append(ix_map[rix])
                        temp_cols.append(fix)

        def where_not(xs, ys):
            if len(xs) != len(ys):
                return "length: {0} != {1}".format(len(xs), len(ys))
            res = []
            for (pos, x) in enumerate(xs):
                y = ys[pos]
                if x != y:
                    res.append("{0}: '{1}' != '{2}'".format(pos, x, y))
            return "at\n{0}".format("\n".join(res))

        train_labels = [ temp_labels[ix] for ix in train_ixs ]
        temp_labels = [ temp_labels[ix] for ix in ixs ]
        if labels != temp_labels:
            raise ValueError("inconsistent labels {0}".format(where_not(labels, temp_labels)))

        train_ix_map = _optimize_lookup(dict([ (ix, pos) for (pos, ix) in enumerate(train_ixs) ]))

        matrix = coo_matrix((np.repeat(1, len(temp_rows)), (temp_rows, temp_cols)), shape=(len(ixs), len(features)), dtype=np.int8)

        msg("loading matrix took {0}s", time.clock() - load_time)
        return matrix.tocsr(), ix_map, train_labels, train_ix_map

    def get_train_labels(self, train_ixs):
        return [
            "T" if self._train_labels[tix] else "F" for tix in
            self._train_ix_map[train_ixs]
        ]

    def get_vecs(self, ixs):
        return self._matrix[self._ix_map[ixs], :]

    def get_feature(self, fix):
        return self._features[fix]

    def get_vec(self, ix):
        _, nz = self._matrix[self._ix_map[ix], :].nonzero()
        return [ self._features[pos] for pos in nz ]

    def get_counts(self, ixs):
        fcounts = self._matrix[self._ix_map[ixs], :].sum(axis=0).tolist()[0]
        return dict([
            (self._features[pos], fcounts[pos])
            for pos in range(len(self._features)) if fcounts[pos] > 0
        ])

    def _process_rows(self, ixs, handle):
        rixs, fixs = self._matrix[self._ix_map[ixs], :].nonzero()

        def process(from_pos, to_pos):
            if to_pos <= from_pos:
                return
            handle(ixs[rixs[from_pos]], [ fixs[p] for p in range(from_pos, to_pos) ])

        pos = 0
        last_pos = 0
        while pos < rixs.shape[0]:
            if rixs[last_pos] != rixs[pos]:
                process(last_pos, pos)
                last_pos = pos
            pos += 1
        process(last_pos, pos)

    def get_groups(self, ixs, ignore_fixs=set()):
        groups = {}

        def hnd(ix, key):
            key = tuple([ k for k in key if k not in ignore_fixs ])
            if key not in groups:
                groups[key] = []
            groups[key].append(ix)

        self._process_rows(ixs, hnd)
        return dict([ (tuple([ self._features[k] for k in ks ]), vs) for (ks, vs) in groups.items() ])


class Explainer(object):
    def __init__(self, explfile, csvfile, sample, cache, msg):
        expl_time = time.clock()
        msg("loading explanations..")
        with open(explfile, 'rb') as f_e:
            obj = json.load(f_e)
        msg("successfully loaded {0} rows {1:6.2f}% labeled true\n{2} features AUC: {3:5.3f}",
            obj["total_rows"], obj["total_true"] / obj["total_rows"] * 100.0,
            obj["total_features"], obj["auc"])
        self._ixs = obj["ixs"]
        expls = obj["expls"]
        self._train_ixs = obj["train_ixs"]
        self._train_preds = obj["train_preds"]
        if sample < 1.0:
            random.seed(0)
            sample_count = int(math.floor(sample * len(self._ixs)))
            if sample_count < 2:
                raise ValueError("test sample size too small: {0}".format(sample_count))
            s_pos = random.sample(range(len(self._ixs)), sample_count)
            s_ixs = []
            s_expls = []
            for sp in s_pos:
                s_ixs.append(self._ixs[sp])
                s_expls.append(expls[sp])
            self._ixs = s_ixs
            expls = s_expls
            t_sample_count = int(math.floor(sample * len(self._train_ixs)))
            if t_sample_count < 2:
                raise ValueError("train sample size too small: {0}".format(t_sample_count))
            t_pos = random.sample(range(len(self._train_ixs)), t_sample_count)
            t_ixs = []
            t_preds = []
            for tp in t_pos:
                t_ixs.append(self._train_ixs[tp])
                t_preds.append(self._train_preds[tp])
            self._train_ixs = t_ixs
            self._train_preds = t_preds
            msg("sample of {0} test and {1} train rows".format(sample_count, t_sample_count))
        self._ixs_lookup = _optimize_lookup(dict([ (ix, pos) for (pos, ix) in enumerate(self._ixs) ]))
        self._features = obj["features"]
        if len(self._features) != obj["total_features"]:
            raise ValueError("inconsistent features {0} != {1}".format(
                            len(self._features), obj["total_features"]))
        self._auc = obj["auc"]
        self._train_auc = obj["train_auc"]
        if [ int(e["ix"]) for e in expls ] != self._ixs:
            raise ValueError("inconsistent indexing")
        self._expls = [ {
            "ix": int(e["ix"]),
            "file": e["file"],
            "expl": Explanation(self._features, float(e["pred"]), e["up"], e["down"]),
            "label": int(e["label"]) > 0,
            "pred": float(e["pred"]),
        } for e in expls ]
        msg("loading explanations took {0}s", time.clock() - expl_time)
        dm = DataMatrix(csvfile, self._ixs, self._train_ixs,
            self._lookup_key(self._ixs, lambda e: e["label"]), self._features, cache, msg)
        self._dm = dm
        self._cache = cache

    def _get_pred_label(self, pred, score):
        l, r = score
        return "F" if pred < r else ("T" if pred >= l else "U")

    def _get_pred_raw(self, ixs):
        return self._lookup_key(ixs, lambda e: e["pred"])

    def _get_labels(self, ixs):
        return self._lookup_key(ixs, self._get_label), [ "T", "F" ]

    def _nc_get_roc_curve(self, ixs):
        preds = self._get_pred_raw(ixs)
        labels = self._get_labels(ixs)[0]
        ths = sorted(set(preds))
        if ths[0] != 0:
            ths.insert(0, 0)
        if ths[-1] != 1:
            ths.append(1)
        ths.append(1.0 + 1e-12) # include all elements

        def get_point(t, ps, ls):
            tp, tn, fp, fn = 0, 0, 0, 0

            for (pos, p) in enumerate(ps):
                p = self._get_pred_label(p, (t, t))
                l = ls[pos]
                if p == l:
                    if p == "T":
                        tp += 1
                    else:
                        tn += 1
                else:
                    if p == "T":
                        fp += 1
                    else:
                        fn += 1
            return {
                "score": t,
                "tp": tp,
                "tn": tn,
                "fp": fp,
                "fn": fn,
            }

        roc = [ get_point(t, preds, labels) for t in ths ]

        def get_best_single(roc):
            best_t = None
            best_v = None
            for cur in roc:
                lv = cur["fp"]
                rv = cur["fn"]
                v = lv + rv
                if best_v is None or v < best_v:
                    best_v = v
                    best_t = cur["score"]
            return best_t, best_t

        train_roc = [
            get_point(t,
                self._train_preds,
                self._dm.get_train_labels(self._train_ixs)
            ) for t in ths
        ]
        best_l, best_r = get_best_single(train_roc)

        stats = self.get_stats(ixs, (best_l, best_r))
        return {
            "auc": self._auc,
            "roc": roc,
            "best_l": best_l,
            "best_r": best_r,
            "total_points": len(ixs),
            "train_auc": self._train_auc,
            "stats": stats,
        }

    def _get_expl(self, ix):
        return self._expls[self._ixs_lookup[ix]]

    def _lookup_key(self, ixs, mapping):
        return [ mapping(self._get_expl(ix)) for ix in ixs ]

    def _group_by(self, ixs, grouper):
        groups = {}
        for ix in ixs:
            grp = grouper(self._get_expl(ix))
            if grp not in groups:
                groups[grp] = []
            groups[grp].append(ix)
        return groups

    def _get_label(self, e):
        return "T" if e["label"] else "F"

    def _get_explanation(self, e, score):
        expl = e["expl"].get_explanation(score)
        return expl if expl else self._dm.get_vec(e["ix"])

    def _same_explanation(self, e, score, expl):
        return set(self._get_explanation(e, score)) == set(expl)

    def _contains_explanation(self, e, score, expl):
        eset = set(self._get_explanation(e, score))
        for e in expl:
            if e not in eset:
                return False
        return True

    def _cmp_explanation(self, e, score, expl, partial):
        if partial:
            return self._contains_explanation(e, score, expl)
        return self._same_explanation(e, score, expl)

    def _query(self, ixs, condition):
        good = []
        bad = []
        for ix in ixs:
            if condition(self._get_expl(ix)):
                good.append(ix)
            else:
                bad.append(ix)
        return good, bad

    def _query_explanation(self, ixs, score, expl, partial):
        if len(ixs) < 1000:
            return self._query(ixs, lambda e: self._cmp_explanation(e, score, expl, partial))
        with self._cache.get_hnd({
                    "function": "expl",
                    "ixs": ixs,
                    "score": score,
                    "expl": expl,
                    "partial": partial,
                }, "explainer") as c:
            if c.has():
                return c.read()
            return c.write(self._query(ixs, lambda e: self._cmp_explanation(e, score, expl, partial)))

    def _query_all_explanations(self, ixs, score):
        if len(ixs) < 1000:
            return self._group_by(ixs, lambda e: tuple(sorted(self._get_explanation(e, score))))
        with self._cache.get_hnd({
                    "function": "all_expl",
                    "ixs": ixs,
                    "score": score,
                }, "explainer") as c:
            if c.has():
                return c.read()
            return c.write(self._group_by(ixs, lambda e: tuple(sorted(self._get_explanation(e, score)))))

    def _group_conf(self, ixs, score):

        def get_conf(e):
            return self._get_confusion(e, score)

        if len(ixs) < 1000:
            return self._group_by(ixs, get_conf)
        with self._cache.get_hnd({
                    "function": "conf",
                    "ixs": ixs,
                    "score": score,
                }, "explainer") as c:
            if c.has():
                return c.read()
            return c.write(self._group_by(ixs, get_conf))

    def _get_confusion(self, e, score):
        pred = self._get_pred_label(e["pred"], score)
        label = self._get_label(e)
        if pred == "U":
            return "up" if label == "T" else "un"
        if pred == label:
            return "tp" if label == "T" else "tn"
        return "fn" if label == "T" else "fp"

    def _get_confusions(self, ixs, score):
        return self._lookup_key(ixs, lambda e: self._get_confusion(e, score))

    def _get_confusion_list(self):
        return [ "tp", "fn", "fp", "tn", "up", "un", ]

    def _group_count_by_label(self, ixs, score, simple):
        details = self._get_confusion_list()
        ixs_detail = self._group_conf(ixs, score)
        if simple:
            return dict([ (k, len(ixs_detail.get(k, []))) for k in details ])
        return dict([ (k, self._dm.get_counts(ixs_detail.get(k, []))) for k in details ])

    def _get_discriminant(self, ixs, score):
        X = self._dm.get_vecs(ixs)
        y = self._get_confusions(ixs, score)
        clf = DecisionTreeClassifier(criterion="gini", splitter="best",
            max_features=None, max_depth=None, random_state=0)
        clf.fit(X, y)

        return dict([
            (self._dm.get_feature(fix), clf.feature_importances_[fix])
            for fix in range(clf.feature_importances_.shape[0])
        ])

    def get_all_ixs(self):
        return self._ixs[:]

    def get_pred_ixs(self):
        ixs = self.get_all_ixs()
        pths = self._group_by(ixs, lambda e: e["pred"])
        return sorted([ {
            "pred": pred,
            "ixs": pixs,
        } for (pred, pixs) in pths.items() ], key=lambda v: v["pred"])

    def get_roc_curve(self):
        ixs = self.get_all_ixs()
        if len(ixs) < 1000 and len(self._train_ixs) < 1000:
            return self._nc_get_roc_curve(ixs)
        with self._cache.get_hnd({
                    "function": "roc",
                    "ixs": ixs,
                    "tixs": self._train_ixs,
                }, "explainer") as c:
            if c.has():
                return c.read()
            return c.write(self._nc_get_roc_curve(ixs))

    def get_granular_expl(self, ixs, score, expl, partial, compact):
        good, _ = self._query_explanation(ixs, score, expl, partial)

        feature_importances = self._get_discriminant(good, score)
        ignore_fixs = set()

        if compact:
            for (fix, f) in enumerate(self._features):
                if feature_importances[f] == 0 and f not in expl:
                    ignore_fixs.add(fix)

        groups = self._dm.get_groups(good, ignore_fixs)
        g_lookup = {}
        group_keys = sorted(groups.keys(), key=lambda g: (len(groups[g]), len(g)), reverse=True)
        for (kix, g) in enumerate(group_keys):
            for f in g:
                if f not in g_lookup:
                    g_lookup[f] = []
                g_lookup[f].append(kix)

        groups = [ {
            "ixs": groups[g],
            "stats": self._group_count_by_label(groups[g], score, simple=True),
        } for g in group_keys ]

        expl = frozenset(expl)
        features = sorted(self._features, key=lambda f: (0 if f in expl else 1, -len(g_lookup.get(f, [])), f))
        return groups, [ {
            "feature": f,
            "in_expl": f in expl,
            "groups": g_lookup[f],
        } for f in features if f in g_lookup ], feature_importances

    def get_stats(self, ixs, score):
        confs = self._group_conf(ixs, score)

        def num(conf):
            return float(len(confs.get(conf, [])))

        def div(a, b):
            if b == 0:
                return 0
            return a / b

        obj = {
            "count": len(ixs),
            "pos_label": num("tp") + num("fn"),
            "accuracy": div(num("tp") + num("tn"), len(ixs)),
            "precision": div(num("tp"), num("tp") + num("fp")),
            "recall": div(num("tp"), num("tp") + num("fn")),
            "specificity": div(num("tn"), num("fp") + num("tn")),
            "f1": div(2 * num("tp"), 2 * num("tp") + num("fp") + num("fn")),
        }
        for conf in self._get_confusion_list():
            obj[conf] = num(conf)
        return obj

    def get_expl_stats(self, ixs, score):
        expls = self._query_all_explanations(ixs, score)

        def get_obj(expl, ixs):
            obj = self.get_stats(ixs, score)
            obj["expl"] = expl
            obj["ixs"] = ixs
            return obj

        return [ get_obj(expl, ixs) for (expl, ixs) in expls.items() ]
