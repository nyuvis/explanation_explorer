/**
 * Created by krause on 2017-01-09.
 */

function Bars(sel, selHead, size, leftColor, rightColor, selectColor, fmt) {
  var that = this;
  var svg = sel.append("svg");
  var svgHead = selHead.append("svg");

  var pattern = new PatternGenerator(leftColor, rightColor);
  pattern.setPosColors("darkgray", "lightgray");
  pattern.addPatterns(svg);
  pattern.addPatterns(svgHead);

  var textShadow = pattern.getShadow("white", 10, 2);

  pattern.addLegend(sel);

  var rows = [];
  this.rows = function(_) {
    if(!arguments.length) return rows;
    rows = _;
    if(rows.some((e, ix) => e["ix"] !== ix)) {
      throw {
        "err": "incorrect indexing",
        "rows": rows,
      };
    }
  };

  var total = null;
  this.total = function(_) {
    if(!arguments.length) return total;
    total = _;
  };

  var colors = {
    "tp": "black",
    "fp": "black",
    "fn": "black",
    "tn": "black",
    "pos": "black",
    "neg": "black",
  };
  this.colors = function(_) {
    if(!arguments.length) return colors;
    colors = _;
  };

  var sorts = [];
  this.sorts = function(_) {
    if(!arguments.length) return sorts;
    sorts = _;
  };

  var selectIx = -1;
  this.selectIx = function(_) {
    if(!arguments.length) return selectIx;
    selectIx = _;
  };

  this.toggleCurrent = () => {
    if(selectIx < 0) return;
    if(selectIx in multiSelect) {
      var s = {};
      Object.keys(multiSelect).forEach((ix) => {
        if(+ix === selectIx) return;
        s[ix] = true;
      });
      multiSelect = s;
    } else {
      multiSelect[selectIx] = true;
    }
    selectIx = -1;
  };

  var multiSelect = {};
  this.selectMulti = function(_) {
    if(!arguments.length) return Object.keys(multiSelect).map((ix) => +ix);
    var s = {};
    _.forEach((ix) => {
      s[ix] = true;
    });
    multiSelect = s;
  };

  function isSelected(ix) {
    return ix >= 0 && (ix === selectIx || ix in multiSelect);
  } // isSelected

  var onClick = (ix) => {};
  this.onClick = function(_) {
    if(!arguments.length) return onClick;
    onClick = _;
  };

  function click(ix) {
    onClick(ix);
  }; // click

  var onInspect = (expl) => {};
  this.onInspect = function(_) {
    if(!arguments.length) return onInspect;
    onInspect = _;
  };

  var textBlocks = 3;
  this.textBlocks = function(_) {
    if(!arguments.length) return textBlocks;
    textBlocks = _;
  };

  var margin = 5;
  var wsize = size * 2;
  var barHeight = size;
  var pBarSize = size * 5;
  var sBarSize = size * 5;
  var hsize = size;
  var headH = hsize * 2;
  var central = hsize * 0.7;
  var fontSize = hsize * 0.6;
  var textGap = fontSize * 3;
  var orBarSize = size * 5;
  var itSize = fontSize * 3;
  var textBlockSize = fontSize * 11;
  this.textBlockSize = function(_) {
    if(!arguments.length) return textBlockSize;
    textBlockSize = _;
  };
  this.calculateTextBlockSize = function(characters) {
    return fontSize * 11.0 * characters / 15.0;
  };
  this.getTextSize = function(textBlockSize, textBlocks) {
    return textBlockSize * textBlocks + textGap;
  };
  this.getRealWidth = function(textSize) {
    return textSize + pBarSize + sBarSize + 4 * margin + orBarSize + itSize;
  };

  this.update = () => {
    var ixs = rows.map((_, ix) => ix);
    ixs.sort((aix, bix) => {
      var sa = isSelected(aix) ? 0 : 1;
      var sb = isSelected(bix) ? 0 : 1;
      var cmpS = d3.ascending(sa, sb);
      if(cmpS !== 0) {
        return cmpS;
      }
      return sorts.reduce((cmp, s) => {
        if(cmp !== 0) {
          return cmp;
        }
        var a = rows[aix][s[0]];
        var b = rows[bix][s[0]];
        return s[2] ? d3.ascending(a, b) : d3.descending(a, b);
      }, 0);
    });
    var pos = ixs.map((_, p) => p);

    var textSize = that.getTextSize(textBlockSize, textBlocks);
    var rw = that.getRealWidth(textSize);
    var rh = hsize * ixs.length + 2;
    svg.style({
      "width": (rw + 2) + "px",
      "height": (rh + 2) + "px",
    }).attr({
      "width": rw + 2,
      "height": rh + 2,
    });

    function gEnter(selE) {
      selE.append("rect").classed("sel", true).attr({
        "transform": "translate(" + [ -textSize, 0 ] + ")",
      });
      selE.append("g").classed("fname", true).attr({
        "transform": "translate(" + [ 0, 0 ] + ")",
      });
      var pbE = selE.append("g").classed("pbar", true).attr({
        "transform": "translate(" + [ 0, 0 ] + ")",
      });
      pbE.append("g").classed("prects", true);
      pbE.append("g").classed("ptext", true);
      var sbE = selE.append("g").classed("sbar", true).attr({
        "transform": "translate(" + [ pBarSize + margin, 0 ] + ")",
      });
      sbE.append("rect").classed("boundary", true);
      sbE.append("g").classed("srects", true);
      var stE = sbE.append("text").classed("stext", true);
      stE.append("tspan").classed("stext", true);
      var orE = selE.append("g").classed("or", true).attr({
        "transform": "translate(" + [ pBarSize + sBarSize + 2 * margin, 0 ] + ")",
      });
      orE.append("rect").classed("orboundary", true);
      orE.append("g").classed("orticks", true);
      orE.append("path").classed("orline", true);
      orE.append("circle").classed("ordot", true);
      orE.append("title").classed("ortitle", true);
      var igE = selE.append("g").classed("inspect", true).attr({
        "transform": "translate(" + [ pBarSize + sBarSize + 3 * margin + orBarSize, 0 ] + ")",
      });
      var itE = igE.append("text").classed("inspect", true);
      itE.append("tspan").classed("inspect", true);
    } // gEnter

    var maxs = {};
    var mins = {};
    var maxKeys = [
      "count",
      "or_lim_up",
    ];
    var minNZKeys = [
      "or_lim_down",
    ];
    pos.forEach((pv, p) => {
      maxKeys.forEach((key) => {
        if(!(key in maxs)) {
          maxs[key] = 1;
        }
        maxs[key] = Math.max(maxs[key], rows[ixs[p]][key]);
      });
      minNZKeys.forEach((key) => {
        var v = rows[ixs[p]][key];
        if(v > 0.0) {
          if(!(key in mins)) {
            mins[key] = v;
          } else {
            mins[key] = Math.min(mins[key], v);
          }
        }
      });
    });
    var gSel = svg.selectAll("g.row").data(pos, (p) => p);
    gSel.exit().remove();
    var gSelE = gSel.enter().append("g").classed("row", true);
    gEnter(gSelE);

    gSel.attr({
      "transform": (p) => "translate(" + [ 1 + textSize, hsize * p + 1 ] + ")",
      "pointer-events": "all",
    }).on("click", function(p) {
      click(ixs[p]);
    }).on("mouseenter", function(p) {
      highlight(ixs[p]);
    }).on("mouseleave", function(p) {
      highlight(-1);
    }).style({
      "cursor": "pointer",
    });

    var prevIx = -1;
    var highlightColor = "#e7e7e7";
    var normalBackColor = "none";
    function highlight(six) {
      if(prevIx >= 0) {
        var prev = gSel.select("rect#bars_sel_" + prevIx);
        if(!prev.empty() && prev.attr("fill") === highlightColor) {
          prev.attr({
            "fill": normalBackColor,
          });
        }
      }
      var cur = gSel.select("rect#bars_sel_" + six);
      if(!cur.empty() && cur.attr("fill") === normalBackColor) {
        cur.attr({
          "fill": highlightColor,
        });
      }
      prevIx = six;
    } // highlight

    var hSel = svgHead.style({
      "width": (rw + 2) + "px",
      "height": (headH + 2) + "px",
    }).attr({
      "width": rw + 2,
      "height": headH + 2,
    }).selectAll("g.row").data(total ? [ -1, -2 ] : [], (p) => p);
    hSel.exit().remove();
    var hSelE = hSel.enter().append("g").classed("row", true);
    gEnter(hSelE);
    hSel.attr({
      "transform": (p) => "translate(" + [ 1 + textSize, headH + hsize * p + 1 ] + ")",
    });
    draw(hSel, true, (p) => total, (p) => p, (k) => total[k]);

    var done = {};
    function drawAll() {
      var scrollTop = sel.node().scrollTop;
      var success = false;
      var rowSel = gSel.filter((p) => {
        if(p in done) {
          return false;
        }
        success = true;
        if(!jkjs.util.rectInViewport({
          "x": 0,
          "y": hsize * p - scrollTop,
          "width": rw,
          "height": hsize + 2,
        }, 2)) {
          return false;
        }
        done[p] = true;
        return true;
      });
      if(success) {
        draw(rowSel, false, (p) => rows[ixs[p]], (p) => ixs[p], (k) => maxs[k]);
      }
      return success;
    } // drawAll

    drawAll();
    sel.on("scroll", () => {
      if(!drawAll()) {
        sel.on("scroll", null);
      }
    });

    function draw(rowSel, head, get, getIx, getMax) {
      var seSel = rowSel.selectAll("rect.sel").attr({
        "x": 0,
        "y": 0,
        "width": rw - 2,
        "height": hsize,
        "fill": (p) => isSelected(getIx(p)) ? selectColor : normalBackColor,
        "id": (p) => "bars_sel_" + getIx(p),
      });

      var pRects = [
        "tp",
        "fp",
        "fn",
        "tn",
      ];
      var prSel = rowSel.selectAll("g.prects").selectAll("rect.prects").data((p) => {
        return pRects.map((pr) => [ p, pr ]);
      }, (id) => id[0] + "_" + id[1]);
      prSel.exit().remove();
      var prE = prSel.enter().append("rect").classed("prects", true);
      prE.append("title").classed("prects", true);

      function getPWidth(id) {
        if(getIx(id[0]) <= -2) {
          return pBarSize / pRects.length;
        }
        return pBarSize * get(id[0])[id[1]] / get(id[0])["count"];
      } // getPWidth

      function getPX(id) {
        return pRects.reduce((v, pr) => {
          if(pr === id[1]) {
            v[1] = true;
          }
          if(v[1]) {
            return v;
          }
          return [ v[0] + getPWidth([ id[0], pr ]), v[1] ];
        }, [ 0, false ])[0]
      } // getPX

      prSel.attr({
        "x": (id) => getPX(id),
        "y": 0,
        "width": (id) => getPWidth(id),
        "height": barHeight,
        "fill": (id) => colors[id[1]],
        "stroke": "black",
        "stroke-width": (id) => getIx(id[0]) <= -2 ? 0.2 : 0.5,
      });

      var pTitles = [
        [ "title", "" ],
        [ "tp", "tp" ],
        [ "fp", "fp" ],
        [ "fn", "fn" ],
        [ "tn", "tn" ],
        [ "", "" ],
        [ "accuracy", "acc" ],
        [ "precision", "prec" ],
      ];
      function pTitle(id) {
        var row = get(id[0]);
        return pTitles.map((title) => {
          if(!title[0].length) {
            return title[1];
          }
          return (title[1].length ? title[1] + ": " : title[1]) + fmt(row[title[0]]);
        }).join("\n");
      }; // pTitle
      prSel.selectAll("title.prects").text((id) => pTitle(id));

      var ptSel = rowSel.selectAll("g.ptext").selectAll("text.ptext").data((p) => {
        return pRects.map((pr) => [ p, pr ]);
      }, (id) => id[0] + "_" + id[1]);
      ptSel.exit().remove();
      ptSel.enter().append("text").classed("ptext", true);
      ptSel.attr({
        "font-size": fontSize,
        "font-family": "courier",
        "font-weight": "lighter",
        "stroke": "none",
      }).style({
        "user-select": "none",
        "text-shadow": textShadow,
      }).each(function(id) {
        var curSel = d3.select(this);
        var isHead = head && getIx(id[0]) <= -2;
        var text = isHead ? id[1] : fmt(get(id[0])[id[1]]);
        jkjs.text.display(curSel, text, {
          "x": getPX(id),
          "y": 0,
          "width": getPWidth(id),
          "height": barHeight,
        }, false, jkjs.text.align.middle, jkjs.text.position.center, pTitle(id), false, true);
      });

      var sRects = [
        "pos_label",
        "neg_label",
      ];
      var srSel = rowSel.selectAll("g.srects").selectAll("rect.srects").data((p) => {
        return sRects.map((ps) => [ p, ps ]);
      }, (id) => id[0] + "_" + id[1]);
      srSel.exit().remove();
      srSel.enter().append("rect").classed("srects", true);

      function getSWidth(id) {
        return sBarSize * get(id[0])[id[1]] / getMax("count");
      } // getSWidth

      function getSX(id) {
        return sRects.reduce((v, sr) => {
          if(sr === id[1]) {
            v[1] = true;
          }
          if(v[1]) {
            return v;
          }
          return [ v[0] + getSWidth([ id[0], sr ]), v[1] ];
        }, [ 0, false ])[0];
      } // getSX

      srSel.attr({
        "x": (id) => getSX(id),
        "y": 0,
        "width": (id) => getSWidth(id),
        "height": barHeight,
        "fill": head ? "none" : (id) => colors[id[1]],
        "stroke": head ? "none" : "black",
        "stroke-width": 0.5,
      });

      rowSel.selectAll("rect.boundary").attr({
        "x": 0,
        "y": 0,
        "width": sBarSize,
        "height": barHeight,
        "fill": (p) => getIx(p) <= -2 ? "none" : "white",
        "stroke": "black",
        "stroke-width": (p) => getIx(p) <= -2 ? 0.2 : 0.5,
      });

      rowSel.selectAll("text.stext").attr({
        "font-size": fontSize,
        "font-family": "courier",
        "font-weight": "lighter",
        "stroke": "none",
        "text-anchor": "end",
        "alignment-baseline": "central",
        "transform": "translate(" + [ sBarSize - margin, 0 ] + ")",
        "x": 0,
        "y": central,
      }).style({
        "user-select": "none",
        "text-shadow": textShadow,
      });
      rowSel.selectAll("tspan.stext").text((p) => {
        var pos_label = fmt(get(p)["pos_label"]);
        var count = fmt(get(p)["count"]);
        var left;
        var right;
        if(getIx(p) <= -2) {
          left = "pos";
          left = " ".repeat(Math.max(0, pos_label.length - left.length)) + left;
          right = "total";
          right = " ".repeat(Math.max(0, count.length - right.length)) + right;
        } else {
          left = pos_label;
          right = count;
        }
        return left + " / " + right;
      });

      var ts = [...Array(textBlocks + 1)].map((_, t) => t);
      var tsSel = rowSel.selectAll("g.fname").selectAll("text.fname").data((p) => {
        return ts.map((t) => [ p, t ]);
      }, (id) => id[0] + "_" + id[1]);
      tsSel.exit().remove();
      var tsSelE = tsSel.enter().append("text").classed("fname", true);
      tsSelE.append("tspan");
      tsSelE.append("title");

      function getMidTextX(id) {
        return -(id[1] > 0 ? textBlockSize * (id[1] - 1) + textGap : 0) - margin;
      } // getMidTextX

      tsSel.attr({
        "font-size": fontSize,
        "font-family": "courier",
        "font-weight": "lighter",
        "stroke": "none",
        "text-anchor": "end",
        "alignment-baseline": "central",
        "transform": (id) => "translate(" + [ getMidTextX(id), 0 ] + ")",
        "x": 0,
        "y": central,
      }).style({
        "user-select": "none",
      });

      function getFName(id) {
        var names = get(id[0])["names"]();
        if(id[1] === 0) {
          var diff = names.length - textBlocks;
          if(diff > 0) {
            return fmt(diff) + (diff > 1 ? ">>" : ">\u00a0");
          }
          return "";
        }
        var p = id[1] - 1;
        return p < names.length ? names[p] : "";
      } // getFName

      tsSel.selectAll("tspan").text((id) => getFName(id));

      tsSel.selectAll("title").text((id) => {
        var expl = get(id[0])["expl"];
        if(id[1] === 0) {
          return expl.length > textBlocks ? expl.join("\n") : "";
        }
        var p = id[1] - 1;
        return p < expl.length ? expl[p] : "";
      });

      var rsSel = rowSel.selectAll("g.fname").selectAll("line.fname").data((p) => {
        return ts.map((t) => [ p, t ]);
      }, (id) => id[0] + "_" + id[1]);
      rsSel.exit().remove();
      rsSel.enter().append("line").classed("fname", true);

      rsSel.attr({
        "x1": (id) => getMidTextX(id) - (id[1] === 0 ? textGap : textBlockSize) + margin * 4,
        "x2": (id) => getMidTextX(id) + (id[1] === 0 ? 0 : margin * 4),
        "y1": barHeight,
        "y2": barHeight,
        "stroke": (id) => !head && (id[1] === 0 || getFName(id).length > 0) ? "darkgray" : "none",
        "stroke-width": 0.25,
      });

      rowSel.selectAll("rect.orboundary").attr({
        "x": 0,
        "y": 0,
        "width": orBarSize,
        "height": barHeight,
        "fill": "white",
        "stroke": "black",
        "stroke-width": (p) => p <= -2 ? 0.2 : 0.5,
      });

      var nhSel = head ? rowSel.filter((p) => p > -2) : rowSel;
      nhSel.selectAll("title.ortitle").text((p) => {
        if(head) return null;
        var expl = get(p);
        if(expl["or"] === 0) return null;
        return fmt(expl["or"])
          + " [" + fmt(expl["or_lim_down"])
          + "; " + fmt(expl["or_lim_up"]) + "]";
      });

      function crossesOR(expl) {
        return expl["or_lim_down"] <= 1.0
          ? expl["or_lim_up"] >= 1.0
          : expl["or_lim_up"] <= 1.0;
      } // crossesOR

      function orColor(expl) {
        if(!head && expl["or"] > 0) {
          return crossesOR(expl) ? "crimson" : "black";
        }
        return "none";
      } // orColor

      function getTicks(min, max) {
        if(!(min > 0.0) || !(max > 0.0)) {
          return [ 1.0 ];
        }
        var res = [];
        var curTick = Math.ceil(Math.log10(min));
        var maxL = Math.floor(Math.log10(max));
        while(curTick <= maxL) {
          res.push(Math.pow(10.0, curTick));
          curTick += 1;
        }
        return res;
      } // getTicks

      function safeMin(a, b) {
        return !a ? b : Math.min(a, b);
      } // safeMin

      function safeMax(a, b) {
        return !a ? b : Math.max(a, b);
      } // safeMax

      var ticks = getTicks(
        Math.min(mins["or_lim_down"], 1.0),
        Math.max(maxs["or_lim_up"], 1.0)
      );
      var orScale = d3.scale.log().domain([
        safeMin(mins["or_lim_down"], 0.9),
        safeMax(maxs["or_lim_up"], 1.0 / 0.9)
      ]).range([
        4, orBarSize - 4
      ]);

      var nhT = nhSel.selectAll("g.orticks").selectAll("line.orticks").data(
        ticks.map((tick) => tick), (tick) => tick
      );
      nhT.exit().remove();
      nhT.enter().append("line").classed("orticks", true);
      nhT.attr({
        "stroke": "gray",
        "stroke-width": (tick) => tick !== 1.0 ? 0.2 : 1,
        "stroke-dasharray": head ? null : [ barHeight * 0.1, barHeight * 0.1 ],
        "x1": (tick) => orScale(tick),
        "x2": (tick) => orScale(tick),
        "y1": head ? 0.8 * barHeight : 0,
        "y2": barHeight,
      });

      if(head) {
        var showTicks;
        if(ticks.length > 3) {
          showTicks = [ ticks[1], 1.0, ticks[ticks.length - 2] ];
        } else if(ticks.length > 1) {
          showTicks = ticks.slice();
        } else {
          showTicks = [ 1.0 ];
        }
        var nhTT = nhSel.selectAll("g.orticks").selectAll("text.orticks").data(
          showTicks, (tick) => tick
        );
        nhTT.exit().remove();
        nhTT.enter().append("text").classed("orticks", true);
        nhTT.attr({
          "x": (tick) => orScale(tick),
          "y": barHeight * 0.5,
          "font-family": "courier",
          "font-weight": "lighter",
          "stroke": "none",
          "alignment-baseline": "central",
          "font-size": fontSize,
          "text-anchor": "middle",
          "textLength": (tick) => (("" + tick).length * 0.75) + "ch",
          "lengthAdjust": "spacing",
        }).style({
          "user-select": "none",
        }).text((tick) => "" + tick);
      } // head

      nhSel.selectAll("path.orline").attr({
        "d": (p) => {
          var expl = get(p);
          var left = expl["or_lim_down"] > 0 ? orScale(expl["or_lim_down"]) : 0;
          var right = expl["or_lim_up"] > 0 ? orScale(expl["or_lim_up"]) : 0;
          return new jkjs.Path()
            .move(left, barHeight * 0.5)
            .line(right, barHeight * 0.5)
            .move(left, barHeight * 0.25)
            .line(left, barHeight * 0.75)
            .move(right, barHeight * 0.25)
            .line(right, barHeight * 0.75);
        },
        "stroke": (p) => orColor(get(p)),
        "stroke-width": 1,
      });
      nhSel.selectAll("circle.ordot").attr({
        "cx": (p) => get(p)["or"] > 0 ? orScale(get(p)["or"]) : 0,
        "cy": barHeight * 0.5,
        "r": barHeight * 0.125,
        "fill": (p) => orColor(get(p)),
      });

      var thSel = head ? rowSel.filter((p) => p <= -2) : d3.select();
      var thT = thSel.selectAll("g.orticks").selectAll("text.or").data(
        [ 0 ], (ix) => ix
      );
      thT.exit().remove();
      var thTE = thT.enter().append("text").classed("or", true);
      thTE.append("tspan").classed("or", true);
      thT.attr({
        "font-size": fontSize,
        "font-family": "courier",
        "font-weight": "lighter",
        "stroke": "none",
        "alignment-baseline": "central",
        "transform": "translate(" + [ orBarSize * 0.5, 0 ] + ")",
      }).style({
        "user-select": "none",
      });
      thT.selectAll("tspan.or").attr({
        "text-anchor": "middle",
        "x": 0,
        "y": central,
      }).text("odds ratio");

      if(!head) {
        rowSel.selectAll("text.inspect").attr({
          "x": 0,
          "y": central,
          "text-anchor": "middle",
          "font-size": fontSize,
          "font-family": "courier",
          "font-weight": "lighter",
          "stroke": "none",
          "fill": "black",
          "alignment-baseline": "central",
          "transform": "translate(" + [ fontSize * 1.5, 0 ] + ")",
        }).style({
          "user-select": "none",
          "cursor": "pointer",
        });
        rowSel.selectAll("tspan.inspect").attr({
          "pointer-events": "all",
        }).text("=>").on("click", (p) => {
          onInspect(get(p));
          d3.event.preventDefault();
          d3.event.stopPropagation();
        }).on("mouseenter", function() {
          d3.select(this).attr({
            "fill": "darkgray",
          });
        }).on("mouseleave", function() {
          d3.select(this).attr({
            "fill": "black",
          });
        });
      }
    } // draw
  }; // update
} // Bars
