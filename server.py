#!/usr/bin/env python
# -*- coding: utf-8 -*-
from __future__ import print_function
from __future__ import division

import os
import csv
import sys
import math
import argparse
import threading

def show_version():
    print("python is {0}".format(sys.version), file=sys.stdout)
    import numpy as np
    print("numpy is {0}".format(np.__version__), file=sys.stdout)
    import sklearn
    print("sklearn is {0}".format(sklearn.__version__), file=sys.stdout)
    import scipy
    print("scipy is {0}".format(scipy.__version__), file=sys.stdout)

try:
    from quick_server import create_server, msg, setup_restart
    from quick_cache import QuickCache

    import explainer
except ImportError:
    show_version()
    raise

def get_server(addr, port, explainer_obj, cache):
    server = create_server((addr, port))

    if heroku:
        server.no_command_loop = True
        server.bind_path('/', '.')
        prefix = '/'
    else:
        server.bind_path('/', '..')
        prefix = '/' + os.path.basename(os.path.normpath(server.base_path))

    server.directory_listing = True
    server.add_default_white_list()
    server.link_empty_favicon_fallback()

    server.suppress_noise = True
    server.report_slow_requests = True

    server.link_worker_js(prefix + '/js/worker.js')
    server.cache = cache

    def canonic_ixs(ixs):
        return sorted(frozenset(convert_ixs(ixs)))

    def convert_ixs(ixs):
        if ixs is None:
            return []
        return [ int(ix) for ix in ixs ]

    def get_thresholds(args):
        return (float(args["l"]), float(args["r"]))

    def optional_bool(key, args, default):
        res = args[key] if key in args else default
        if res is None:
            return default
        return bool(res)

    ### explainer ###

    @server.json_get(prefix + '/explainer_roc_curve', 0)
    def json_explainer_roc_curve(req, args):
        args = args["query"]
        token = args["token"] if "token" in args and args["token"] else None
        pred_ixs = optional_bool("pred_ixs", args, False)
        res = explainer_obj.get_roc_curve()
        res["token"] = server.create_token() if token is None else token
        if pred_ixs:
            res["pred_ixs"] = explainer_obj.get_pred_ixs()
        return res

    def token_obj(args):
        token = args["token"]
        obj = server.get_token_obj(token)
        if "ixss" not in obj:
            obj["ixss"] = [ canonic_ixs(explainer_obj.get_all_ixs()) ]
            obj["msgs"] = [ "all: " + str(len(obj["ixss"][-1])) ]
        return obj

    token_lock = threading.Lock()
    def get_ixs(args):
        with token_lock:
            return token_obj(args)["ixss"][-1]

    @server.json_post(prefix + '/explainer_ixs_get', 0)
    def json_explainer_ixs_get(req, args):
        with token_lock:
            args = args["post"]
            obj = token_obj(args)
            return [ msg for msg in obj["msgs"] ]

    @server.json_post(prefix + '/explainer_ixs_put', 0)
    def json_explainer_ixs_put(req, args):
        with token_lock:
            args = args["post"]
            if "ixs" in args:
                new_ixs = canonic_ixs(args["ixs"])
                pre_text = args["msg"] + ": " if "msg" in args and args["msg"] else ""
                new_text = pre_text + str(len(new_ixs))
            else:
                new_ixs = None
            if "pos" in args:
                new_pos = int(args["pos"])
            else:
                new_pos = None
            obj = token_obj(args)
            if new_pos is not None:
                obj["ixss"] = obj["ixss"][:(new_pos + 1)]
                obj["msgs"] = obj["msgs"][:(new_pos + 1)]
            if new_ixs is not None:
                ixss = obj["ixss"]
                found = None
                if len(new_ixs) == 0:
                    found = len(ixss)
                else:
                    for (pos, ixs) in enumerate(ixss):
                        if ixs == new_ixs:
                            found = pos + 1
                            break
                if found is not None:
                    obj["ixss"] = obj["ixss"][:found]
                    obj["msgs"] = obj["msgs"][:found]
                else:
                    obj["ixss"].append(new_ixs)
                    obj["msgs"].append(new_text)
            return [ msg for msg in obj["msgs"] ]

    @server.json_post(prefix + '/explainer_page_get', 0)
    def json_explainer_page_get(req, args):
        with token_lock:
            args = args["post"]
            page = args["page"]
            obj = token_obj(args)
            if page not in obj:
                obj[page] = {}
            return obj[page]

    @server.json_post(prefix + '/explainer_page_put', 0)
    def json_explainer_page_put(req, args):
        with token_lock:
            args = args["post"]
            page = args["page"]
            obj = token_obj(args)
            if page not in obj:
                obj[page] = {}
            put = args["put"]
            for (k, v) in put.items():
                obj[page][k] = v
            return obj[page]

    @server.json_post(prefix + '/explainer_page_clear', 0)
    def json_explainer_page_clear(req, args):
        with token_lock:
            args = args["post"]
            page = args["page"]
            obj = token_obj(args)
            obj[page] = {}
            return obj[page]

    @server.json_post(prefix + '/explainer_expls_stats', 0)
    def json_explainer_expls_stats(req, args):
        args = args["post"]
        ixs = get_ixs(args)
        score = get_thresholds(args)
        return {
            "expls": explainer_obj.get_expl_stats(ixs, score),
            "totals": explainer_obj.get_stats(ixs, score),
            "all": explainer_obj.get_stats(explainer_obj.get_all_ixs(), score),
        }

    @server.json_post(prefix + '/explainer_granular', 0)
    def json_explainer_granular(req, args):
        args = args["post"]
        score = get_thresholds(args)
        ixs = get_ixs(args)
        expl = args["expl"]
        partial = optional_bool("partial", args, False)
        compact = optional_bool("ignore_irrelevant_features", args, False)
        groups, features, feature_importances \
            = explainer_obj.get_granular_expl(ixs, score, expl, partial, compact)
        return {
            "groups": groups,
            "features": features,
            "importances": feature_importances,
        }

    ### commands ###

    def complete_cache_clear(args, text):
        if args:
            return []
        return [ section for section in cache.list_sections() if section.startswith(text) ]

    @server.cmd(complete=complete_cache_clear)
    def cache_clear(args):
        if len(args) > 1:
          msg("too many extra arguments! expected one got {0}", ' '.join(args))
          return
        msg("clear {0}cache{1}{2}", "" if args else "all ", " " if args else "s", args[0] if args else "")
        cache.clean_cache(args[0] if args else None)

    return server, prefix

heroku = False
if __name__ == '__main__':
    if '--heroku' not in sys.argv[1:]:
        setup_restart()

    if '-v' in sys.argv[1:]:
        show_version()
        sys.exit(1)
    parser = argparse.ArgumentParser(description='Class Signature Server')
    parser.add_argument('-v', action='store_true', help="print library versions and exit")
    parser.add_argument('--sample', type=float, default=1.0, help="samples data points for explainer")
    parser.add_argument('--heroku', action='store_true', help="start in heroku mode")
    parser.add_argument('--quota', default=10240, help="set cache quota")
    parser.add_argument('--ram-quota', default=2048, help="set RAM cache quota")
    parser.add_argument('-a', type=str, default="localhost", help="specifies the server address")
    parser.add_argument('-p', type=int, default=8080, help="specifies the server port")
    parser.add_argument('input', type=str, help="file containing a CSV table with categorical values")
    parser.add_argument('explainer', type=str, help="file with explainer info")
    args = parser.parse_args()

    addr = args.a
    port = args.p
    heroku = args.heroku
    cache_quota = args.quota
    ram_quota = args.ram_quota
    explainer_file = args.explainer
    sample = args.sample

    cache_temp = "tmp"
    if os.path.exists("cache_path.txt"):
        with open("cache_path.txt") as cp:
            cache_temp = cp.read().strip()

    cid = args.input + ":" + explainer_file
    cache = QuickCache(None, cid, quota=cache_quota, ram_quota=ram_quota, temp=cache_temp, warnings=msg)

    if heroku:
        QuickServerRequestHandler.protocol_version = "HTTP/1.0"
    explainer_obj = explainer.Explainer(explainer_file, args.input, sample, cache, msg)
    server, prefix = get_server(addr, port, explainer_obj, cache)
    msg("{0}", " ".join(sys.argv))
    msg("starting server at http://{0}:{1}{2}/", addr if addr else 'localhost', port, prefix)
    try:
        server.serve_forever()
    finally:
        msg("shutting down..")
        msg("{0}", " ".join(sys.argv))
        server.server_close()
