#!/usr/bin/env python3
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
from scipy.sparse import coo_matrix, csr_matrix

class _Explanation_v0(object):
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


class _Explanation_v1(object):
    def __init__(self, expl, features, postfixes, th, msg):
        self._th = th

        def get_feature(fix):
            if fix < 0:
                return ""
            return features[fix]

        self._expl = [ "{0}{1}{2}".format(e[1], get_feature(e[0]), postfixes[e[0]]) for e in expl["expl"] ]
        if len(self._expl) == 0:
            self._expl = [ "{0}{1}".format(f, postfixes[ix]) for (ix, f) in enumerate(features) if postfixes[ix] is not None ]


    def get_explanation(self, score):
        l, r = score
        th = self._th
        if l != th or r != th:
            raise ValueError("expected threshold {0} got {1}".format((th, th), score))
        return self._expl


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


class _DataMatrix_v0(object):
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


class _DataMatrix_v1(object):
    def __init__(self, csvfile, features, expls, cache, msg):
        with cache.get_hnd({
                    "function": "dmv1",
                    "csv": csvfile,
                    "features": features,
                }, "explainer") as c:
            if c.has():
                load_time = time.clock()
                msg("loading matrix from cache..")
                matrix, mins, diffs = c.read()
                msg("loading matrix from cache took {0}s", time.clock() - load_time)
            else:
                matrix, mins, diffs = c.write(self._load(csvfile, features, expls, msg))
        self._features = features
        self._matrix = matrix
        self._mins = mins
        self._diffs = diffs


    def _load(self, data_file, features, expls, msg):
        if data_file.endswith(".csr"):
            return self._load_csr(data_file, features, expls, msg)
        load_time = time.clock()
        msg("loading CSV data..")
        skip = frozenset([ "label" ])
        labels = []
        values = []
        features_lookup = dict([ (f, ix) for (ix, f) in enumerate(features) ])
        maxs = np.zeros((len(features),), dtype=np.float64)
        mins = np.zeros((len(features),), dtype=np.float64)

        def set_value(cur_row, f, val):
            fix = features_lookup[f]
            if val > maxs[fix]:
                maxs[fix] = val
            mm = mins[fix]
            if val < mm:
                if val < 0.0 and mm == 0.0:
                    msg("WARNING: negative value found -- slow mode for feature {0}!", features[fix])
                    # we have to fix all missing values in previous rows now :(
                    for cr in values:
                        if fix not in cr:
                            cr[fix] = mm
                mins[fix] = val
                mm = mins[fix]
            if mm != 0.0 or val > 0.0:
                cur_row[fix] = val

        with open(data_file, 'r') as data_in:
            for row in csv.DictReader(data_in):
                labels.append(int(row["label"]) != 0)
                cur_row = {}
                for (k, v) in row.items():
                    if k in skip:
                        continue
                    v = np.float64(v.strip())
                    set_value(cur_row, k, v)
                values.append(cur_row)

        diffs = maxs - mins
        diffs[np.isclose(0, diffs)] = 1.0

        def prepare(val, fix):
            return (val - mins[fix]) / diffs[fix]

        coords = [
            (prepare(val, fix), rix, fix)
            for (rix, cur_row) in enumerate(values)
            for (fix, val) in cur_row.items()
        ]
        vals, rows, cols = zip(*coords)
        matrix = coo_matrix((vals, (rows, cols)),
                            shape=(len(values), len(features)),
                            dtype=np.float64)
        matrix = matrix.tocsr()
        matrix.sort_indices()

        for (pos, l) in enumerate(labels):
            if expls[pos]["label"] != l:
                raise ValueError("inconsistent label at index {0}".format(pos))

        msg("loading data took {0}s", time.clock() - load_time)
        return matrix, mins, diffs


    def _load_csr(self, data_file, features, expls, msg):
        load_time = time.clock()
        msg("loading CSR data..")

        labels = []
        data = []
        indices = []
        indptr = [ 0 ]
        feature_map = None
        with open(data_file, "r") as f_in:
            for row in csv.reader(f_in):
                if feature_map is None:
                    own_features = row[1:]
                    features_lookup = dict((f, ix) for (ix, f) in enumerate(features))
                    feature_map = dict((fix, features_lookup[f]) for (fix, f) in enumerate(own_features))
                    continue
                labels.append(int(row[0]) > 0)
                for fix in row[1:]:
                    data.append(True)
                    indices.append(feature_map[int(fix)])
                indptr.append(len(data))
        labels = np.array(labels, dtype=np.bool)
        matrix = csr_matrix((data, indices, indptr),
            shape=(len(indptr) - 1, len(features)), dtype=np.bool)
        matrix.sort_indices()

        for (pos, l) in enumerate(labels):
            if expls[pos]["label"] != l:
                raise ValueError("inconsistent label at index {0}".format(pos))

        mins = np.zeros((len(features),), dtype=np.float64)
        diffs = np.ones((len(features),), dtype=np.float64)
        msg("loading data took {0}s", time.clock() - load_time)
        return matrix, mins, diffs


    def _unprepare(self, X):
        return X * self._diffs + self._mins


    def get_train_labels(self, train_ixs):
        raise NotImplementedError("protocol 1 does not support training inspection")


    def get_vecs(self, ixs):
        return self._matrix[ixs, :]


    def get_vec(self, ix):
        # in case of empty explanations
        # TODO think about better solution
        _, nz = self._matrix[ix, :].nonzero()
        print(len([ self._features[pos] for pos in nz ]))
        return [ self._features[pos] for pos in nz ]


    def get_counts(self, ixs):
        # TODO think about better solution
        fcounts = self._matrix[ixs, :].sum(axis=0).tolist()[0]
        return dict([
            (self._features[pos], fcounts[pos])
            for pos in range(len(self._features)) if fcounts[pos] > 0
        ])


    def _process_rows(self, ixs, handle):
        # TODO think about better solution
        rixs, fixs = self._matrix[ixs, :].nonzero()

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
        # TODO think about better solution
        groups = {}

        def hnd(ix, key):
            key = tuple([ k for k in key if k not in ignore_fixs ])
            if key not in groups:
                groups[key] = []
            groups[key].append(ix)

        self._process_rows(ixs, hnd)
        return dict([ (tuple([ self._features[k] for k in ks ]), vs) for (ks, vs) in groups.items() ])


class Explainer(object):
    def __init__(self, explfile, csvfile, sample, cache, msg, protocol):
        if protocol < 1:
            self._load_protocol_0(explfile, csvfile, sample, cache, msg)
        elif protocol < 2:
            self._load_protocol_1(explfile, csvfile, sample, cache, msg)
        else:
            raise ValueError("unsupported protocol {0}".format(protocol))
        self._expl_time = os.path.getmtime(explfile)
        self._csv_time = os.path.getmtime(csvfile)
        self._cache = cache


    def _load_protocol_0(self, explfile, csvfile, sample, cache, msg):
        expl_time = time.clock()
        msg("loading explanations.. (protocol 0)")
        with open(explfile, 'r') as f_e:
            obj = json.load(f_e)
        if "total_features" not in obj:
            raise ValueError("missing key 'total_features' -- are you sure you want protocol 0?")
        msg("successfully loaded {0} rows {1:6.2f}% labeled true\n{2} features AUC: {3:5.3f}",
            obj["total_rows"], obj["total_true"] / obj["total_rows"] * 100.0,
            obj["total_features"], obj["auc"])
        self._best_th = None
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
            "expl": _Explanation_v0(self._features, float(e["pred"]), e["up"], e["down"]),
            "label": int(e["label"]) > 0,
            "pred": float(e["pred"]),
        } for e in expls ]
        msg("loading explanations took {0}s", time.clock() - expl_time)
        dm = _DataMatrix_v0(csvfile, self._ixs, self._train_ixs,
            self._lookup_key(self._ixs, lambda e: e["label"]), self._features, cache, msg)
        self._dm = dm

    def _load_protocol_1(self, explfile, csvfile, sample, cache, msg):
        expl_time = time.clock()
        msg("loading explanations.. (protocol 1)")
        with open(explfile, 'r') as f_e:
            obj = json.load(f_e)
        msg("successfully loaded {0} rows {1:6.2f}% labeled true\n{2} features AUC: {3:5.3f}",
            obj["total_rows"], np.float64(obj["total_true"]) / np.float64(obj["total_rows"]) * 100.0,
            len(obj["features"]), obj["test_auc"])
        features = [ f for f in obj["features"] ]
        features_lookup = dict([ (f, ix) for (ix, f) in enumerate(features) ])
        self._ixs = list(range(int(obj["total_rows"])))
        expls = sorted(obj["expls"], key=lambda e: int(e["ix"]))

        self._train_ixs = None
        self._train_preds = None
        th = np.float64(obj["threshold"])
        self._best_th = th

        if sample < 1.0:
            raise NotImplementedError("subsampling not available for protocol 1 (yet)")

        self._ixs_lookup = _optimize_lookup(dict([ (ix, pos) for (pos, ix) in enumerate(self._ixs) ]))
        self._features = features
        self._auc = np.float64(obj["test_auc"])
        self._train_auc = np.float64(obj["train_auc"])

        if [ int(e["ix"]) for e in expls ] != self._ixs:
            raise ValueError("inconsistent indexing")
        if any([ (np.float64(e["pred"]) >= th) != (int(e["pred_label"]) > 0) for e in expls ]):
            raise ValueError("inconsistent prediction")

        self._expls = [ {
            "ix": int(e["ix"]),
            "expl": _Explanation_v1(e, features, e["postfixes"], th, msg),
            "label": int(e["label"]) > 0,
            "pred": np.float64(e["pred"]),
        } for e in expls ]

        actual_pos = sum( 1 for l in self._get_labels(self._ixs)[0] if l == "T" )
        if actual_pos != int(obj["total_true"]):
            raise ValueError("inconsistent positive labels {0} != {1}".format(actual_pos, obj["total_true"]))

        msg("loading explanations took {0}s", time.clock() - expl_time)
        dm = _DataMatrix_v1(csvfile, features, self._expls, cache, msg)
        self._dm = dm


    def _get_pred_label(self, pred, score):
        l, r = score
        return "F" if pred < r else ("T" if pred >= l else "U")


    def _get_pred_raw(self, ixs):
        return self._lookup_key(ixs, lambda e: e["pred"])


    def _get_labels(self, ixs):
        return self._lookup_key(ixs, self._get_label), [ "T", "F" ]


    def _nc_get_roc_curve(self, ixs):

        def get_roc(preds, labels, best_th):
            total_pos = 0
            total_neg = 0
            th_pos = {}
            th_neg = {}
            # edge cases
            th_pos[np.float64(0.0)] = 0
            th_neg[np.float64(0.0)] = 0
            th_pos[np.float64(1.0)] = 0
            th_neg[np.float64(1.0)] = 0
            th_pos[np.float64(1.0 + 1e-12)] = 0 # includes all elements
            th_neg[np.float64(1.0 + 1e-12)] = 0
            # count labels
            for (ix, p) in enumerate(preds):
                l = labels[ix] == "T"
                p = np.float64(p)
                if p not in th_pos:
                    th_pos[p] = 0
                if p not in th_neg:
                    th_neg[p] = 0
                if l:
                    total_pos += 1
                    th_pos[p] += 1
                else:
                    total_neg += 1
                    th_neg[p] += 1
            ths = sorted(th_pos.keys())
            # first threshold == 0
            tp = total_pos
            tn = 0
            fp = total_neg
            fn = 0
            roc = []
            for (ix, th) in enumerate(ths):
                roc.append({
                    "score": th,
                    "tp": tp,
                    "tn": tn,
                    "fp": fp,
                    "fn": fn,
                })
                tp -= th_pos[th]
                fn += th_pos[th]
                fp -= th_neg[th]
                tn += th_neg[th]
            best_t = None
            if best_th is None:
                best_v = None
                for cur in roc:
                    lv = cur["fp"]
                    rv = cur["fn"]
                    v = lv + rv
                    if best_v is None or v < best_v:
                        best_v = v
                        best_t = cur["score"]
            else:
                best_t = best_th
            return roc, best_t

        preds = self._get_pred_raw(ixs)
        labels = self._get_labels(ixs)[0]
        best_t = self._best_th
        if best_t is None:
            if self._train_preds is None or self._train_ixs is None:
                raise ValueError("missing threshold in protocol 1")
            train_roc, best_t = get_roc(
                self._train_preds, self._dm.get_train_labels(self._train_ixs), None)
        roc, best_t = get_roc(preds, labels, best_t)

        stats = self.get_stats(ixs, (best_t, best_t))
        return {
            "auc": self._auc,
            "roc": roc,
            "best_l": best_t,
            "best_r": best_t,
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
                    "csv_time": self._csv_time,
                    "expl_time": self._expl_time,
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
                    "csv_time": self._csv_time,
                    "expl_time": self._expl_time,
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
                    "csv_time": self._csv_time,
                    "expl_time": self._expl_time,
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
            (self._features[fix], clf.feature_importances_[fix])
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
        if len(ixs) < 1000 and (self._train_ixs is None or len(self._train_ixs) < 1000):
            return self._nc_get_roc_curve(ixs)
        with self._cache.get_hnd({
                    "function": "roc",
                    "ixs": ixs,
                    "tixs": self._train_ixs,
                    "csv_time": self._csv_time,
                    "expl_time": self._expl_time,
                }, "explainer") as c:
            if c.has():
                return c.read()
            return c.write(self._nc_get_roc_curve(ixs))


    def get_granular_expl(self, ixs, score, expl, partial, compact):
        good, _ = self._query_explanation(ixs, score, expl, partial)

        feature_importances = self._get_discriminant(good, score)
        ignore_fixs = set()
        force_fs = set()

        def in_expl(f, expl):
            for e in expl:
                if f in e:
                    return True
            return False

        if compact:
            for (fix, f) in enumerate(self._features):
                if feature_importances[f] == 0 and not in_expl(f, expl):
                    ignore_fixs.add(fix)
                elif in_expl(f, expl):
                    force_fs.add(f)

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

        features = sorted(self._features, key=lambda f: (0 if in_expl(f, expl) else 1, -len(g_lookup.get(f, [])), f))
        return groups, [ {
            "feature": f,
            "in_expl": in_expl(f, expl),
            "groups": g_lookup.get(f, []),
        } for f in features if f in g_lookup or f in force_fs ], feature_importances


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
