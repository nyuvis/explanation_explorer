/**
 * Created by krause on 2016-06-09.
 */
function CountLine(sel, sizeW, sizeH, border, onROCThreshold, scoreTmp, fmt, colors, nonInteractive) {
  var that = this;
  var interactive = !nonInteractive;
  var COLOR_LEFT = colors[0];
  var COLOR_RIGHT = colors[1];
  var COLOR_EMPTY = "white";
  var COLOR_TMP = colors[2];
  var COLOR_LEFT_DARK = colors[3];
  var COLOR_RIGHT_DARK = colors[4];

  var pattern = new PatternGenerator(COLOR_LEFT, COLOR_RIGHT);
  pattern.setDarkColors(COLOR_LEFT_DARK, COLOR_RIGHT_DARK);

  var points = [];
  this.points = function(_) {
    if(!arguments.length) return points;
    points = _.slice();
    points.sort(function(a, b) {
        return d3.ascending(+a["score"], +b["score"]);
    });
    columnInfo = null;
    drawInfo = null;
    maxHeight = 1.0;
  };

  var ixsLookup = [];
  this.ixsLookup = function(_) {
    if(!arguments.length) return ixsLookup;
    ixsLookup = _;
  };

  var onClick = (l, r, pixs) => {};
  this.onClick = function(_) {
    if(!arguments.length) return onClick;
    onClick = _;
  };

  var tLeft = 1.0;
  var tRight = 0.0;
  var columnInfo = null;
  var drawInfo = null;
  var maxHeight = 1.0;
  this.roct = function(left) {
    return left ? tLeft : tRight;
  };

  this.setROCThreshold = function(score, left) {
    var val = findScore(score);
    if(Number.isNaN(val)) return;
    if(left) {
      tLeft = val;
    } else {
      tRight = val;
    }
    columnInfo = null;
    drawInfo = null;
    maxHeight = 1.0;
    onROCThreshold(val, left);
  };

  function findScore(score) {
    if(Number.isNaN(score)) return Number.NaN;

    var p = Number.NaN;
    points.forEach(function(cp) {
      var cur = +cp["score"];
      if(Number.isNaN(p) || Math.abs(cur - score) < Math.abs(p - score)) {
        p = cur;
      }
    });
    return p;
  }

  function scoreFromPos(pos, tIndicator) {
    // tIndicator:
    // -1: left
    // 0: tmp
    // 1: right
    if(!drawInfo) {
      that.update();
    }
    var x = pos[0];
    if(x < border || x > border * sizeW) return Number.NaN;
    return drawInfo.reduce(function(res, cur) {
      if(x >= cur["x"] && x < cur["x"] + cur["width"]) {
        var left = columnInfo[cur["left_ix"]]["left"];
        var right = columnInfo[cur["right_ix"]]["right"];
        return tIndicator > 0 ? left : tIndicator < 0 ? left : right;
      }
      return res;
    }, Number.NaN);
  }

  this.setROCTemp = function(score) {
    setTmp(findScore(score));
  };

  var onROCTemp = function(score) {};
  this.onROCTemp = function(_) {
    if(!arguments.length) return _;
    onROCTemp = _;
  };

  var tTmp = Number.NaN;
  var oldTemp = Number.NaN;
  function setTmp(score) {
    if(oldTemp === score || (Number.isNaN(oldTemp) && Number.isNaN(score))) return;
    oldTemp = score;
    onROCTemp(score);
    tTmp = score;
    that.update();
  }

  var lastRightPoint = [ Number.NaN, Number.NaN ];
  var svg = sel.append("svg").attr({
    "width": sizeW + 2*border,
    "height": sizeH + 2*border,
  }).style({
    "width": sizeW + 2*border + "px",
    "height": sizeH + 2*border + "px",
    "cursor": "crosshair",
  }).on("mousemove", function() {
    setTmp(scoreFromPos(mousePos(), 0));
  }).on("mouseout", function() {
    setTmp(Number.NaN);
  });
  if(interactive) {
    svg.on("click", function() {
      that.setROCThreshold(scoreFromPos(mousePos(), -1), true);
    }).on("contextmenu", function() {
      var p = mousePos();
      if(!p || (p[0] === lastRightPoint[0] && p[1] === lastRightPoint[1])) {
        return;
      }
      that.setROCThreshold(scoreFromPos(mousePos(), 1), false);
      lastRightPoint = p;
      d3.event.preventDefault();
    });
  } // interactive
  pattern.addPatterns(svg);

  function mousePos() {
    return d3.mouse(svg.node());
  }

  var head = svg.append("text");
  var label = svg.append("text");
  var labelP = svg.append("text");
  var labelN = svg.append("text");
  var posLine = svg.append("line");
  var negLine = svg.append("line");
  var posTag = svg.append("text");
  var negTag = svg.append("text");

  var gsel = svg.append("g");
  svg.append("rect").attr({
    "x": border,
    "y": border,
    "width": sizeW,
    "height": sizeH,
    "stroke": "black",
    "fill": "none",
  });

  this.update = function() {
    if(!columnInfo || !drawInfo) {
      var prev = null;
      var vals = points.reduce(function(res, p) {
        if(prev) {
          res.push({
            "left": +prev["score"],
            "right": +p["score"],
            "pos": +prev["tp"] - +p["tp"],
            "neg": +prev["fp"] - +p["fp"],
          });
        }
        prev = p;
        return res;
      }, []);

      var barCount = 100;
      var bpr;
      if(vals.length < barCount) {
        bpr = 1;
      } else {
        bpr = Math.ceil(vals.length / barCount);
      }
      var rectW = sizeW / Math.ceil(vals.length / bpr);
      columnInfo = vals;

      drawInfo = [];
      var posX = 0;
      var columns = [];
      var max = 1;
      for(var lix = 0;lix < vals.length;lix += bpr) {
        var leftIx = lix;
        var rightIx = Math.min(vals.length, lix + bpr);
        var posPos = 0;
        var midPos = 0;
        var negPos = 0;
        var posNeg = 0;
        var midNeg = 0;
        var negNeg = 0;
        for(var curIx = leftIx;curIx < rightIx;curIx += 1) {
          var cur = vals[curIx];
          var isPos = cur["left"] >= tLeft;
          var isNeg = cur["left"] < tRight;
          if(isPos) {
            posPos += cur["pos"];
            posNeg += cur["neg"];
          } else if(isNeg) {
            negPos += cur["pos"];
            negNeg += cur["neg"];
          } else {
            midPos += cur["pos"];
            midNeg += cur["neg"];
          }
        }
        max = Math.max(Math.max(max, posPos + midPos + negPos), posNeg + midNeg + negNeg);
        drawInfo.push({
          "left_ix": leftIx,
          "right_ix": rightIx - 1,
          "x": sizeW - posX - rectW + border,
          "width": rectW,
          "columns": [ posPos, midPos, negPos, posNeg, midNeg, negNeg ],
        });
        posX += rectW;
      }
      maxHeight = max;
    } // !columnInfo || !drawInfo
    var ixs = drawInfo.map((_, ix) => ix);

    ixs.forEach((ix) => {
      var tl = columnInfo[drawInfo[ix]["left_ix"]]["left"];
      var tr = columnInfo[drawInfo[ix]["right_ix"]]["right"];
      var x = drawInfo[ix]["x"] + drawInfo[ix]["width"] * (tr - tLeft) / (tr - tl);
      if(tl < tLeft && tr >= tLeft) {
        posLine.attr({
          "x1": x,
          "x2": x,
          "y1": border,
          "y2": border + sizeH * 0.5,
          "stroke": COLOR_LEFT,
        });
        posTag.attr({
          "x": 0,
          "y": 0,
          "font-weight": "lighter",
          "transform": "translate(" + [ x - 4, border + sizeH * 0.25 ] + ")",
          "fill": "black",
          "stroke": "none",
          "alignment-baseline": "central",
          "text-anchor": "end",
        }).style({
          "user-select": "none",
        }).text(fmt(tLeft));
      }
      if(tr >= tRight && tl < tRight) {
        negLine.attr({
          "x1": x,
          "x2": x,
          "y1": border + sizeH * 0.5,
          "y2": border + sizeH,
          "stroke": COLOR_RIGHT,
        });
        negTag.attr({
          "x": 0,
          "y": 0,
          "font-weight": "lighter",
          "transform": "translate(" + [ x + 4, border + sizeH * 0.75 ] + ")",
          "fill": "black",
          "stroke": "none",
          "alignment-baseline": "central",
          "text-anchor": "start",
        }).style({
          "user-select": "none",
        }).text(tLeft !== tRight ? fmt(tRight) : "");
      }
    });

    var tixs = ixs.filter((ix) => ix % 10 === 0);
    if(tixs[tixs.length - 1] !== ixs[ixs.length - 1]) {
      tixs.push(ixs[ixs.length - 1]);
    }
    var gtsel = gsel.selectAll("g.ticks").data(tixs, (ix) => ix);
    gtsel.exit().remove();
    var gtselE = gtsel.enter().append("g").classed("ticks", true);
    gtselE.append("line").classed("ticks", true);
    gtselE.append("text").classed("ticks", true);

    gtsel.attr({
      "transform": (ix) => "translate(" + [
          drawInfo[ix]["x"] + drawInfo[ix]["width"] * 0.5,
          border + sizeH,
        ] + ")",
    });
    gtsel.selectAll("line.ticks").attr({
      "x1": 0,
      "x2": 0,
      "y1": 0,
      "y2": border * 0.25,
      "stroke": "black",
    });
    gtsel.selectAll("text.ticks").attr({
      "x": 0,
      "y": border * 0.5,
      "font-weight": "lighter",
      "fill": "black",
      "stroke": "none",
      "alignment-baseline": "central",
      "text-anchor": "middle",
    }).style({
      "user-select": "none",
    }).text((ix) => {
      var tl = columnInfo[drawInfo[ix]["left_ix"]]["left"];
      var tr = columnInfo[drawInfo[ix]["right_ix"]]["right"];
      return fmt((tl + tr) * 0.5);
    });

    head.attr({
      "x": 0,
      "y": 0,
      "fill": "black",
      "stroke": "none",
      "alignment-baseline": "central",
      "text-anchor": "middle",
      "transform": "translate(" + [
        border + sizeW * 0.5,
        border * 0.5,
      ] + ")",
    }).style({
      "user-select": "none",
    }).text("prediction score");

    label.attr({
      "x": 0,
      "y": 0,
      "fill": "black",
      "stroke": "none",
      "alignment-baseline": "central",
      "text-anchor": "middle",
      "transform": "translate(" + [
        border * 0.5,
        border + sizeH * 0.5,
      ] + ") rotate(-90)",
    }).style({
      "user-select": "none",
    }).text("ground truth");

    labelP.attr({
      "x": 0,
      "y": 0,
      "font-weight": "lighter",
      "fill": "black",
      "stroke": "none",
      "alignment-baseline": "central",
      "text-anchor": "middle",
      "transform": "translate(" + [
        border * 1.5 + sizeW,
        border + sizeH * 0.25,
      ] + ")",
    }).style({
      "user-select": "none",
    }).text("P");

    labelN.attr({
      "x": 0,
      "y": 0,
      "font-weight": "lighter",
      "fill": "black",
      "stroke": "none",
      "alignment-baseline": "central",
      "text-anchor": "middle",
      "transform": "translate(" + [
        border * 1.5 + sizeW,
        border + sizeH * 0.75,
      ] + ")",
    }).style({
      "user-select": "none",
    }).text("N");

    function createRects(clazz, dataIx, stack, color, colorTmp, up) {
      if(up) {
        stack.push(dataIx);
      }
      var rsel = gsel.selectAll("rect." + clazz).data(ixs, function(ix) {
        return ix;
      });
      rsel.exit().remove();
      rsel.enter().append("rect").classed(clazz, true);
      rsel.attr({
        "stroke": "black",
        "stroke-width": 0.5,
        "fill": function(ix) {
          var tl = columnInfo[drawInfo[ix]["left_ix"]]["left"];
          var tr = columnInfo[drawInfo[ix]["right_ix"]]["right"];
          return tl < tTmp && tr >= tTmp ? colorTmp : color;
        },
        "width": function(ix) {
          return drawInfo[ix]["width"];
        },
        "x": function(ix) {
          return drawInfo[ix]["x"];
        },
        "height": function(ix) {
          return Math.max(drawInfo[ix]["columns"][dataIx] / maxHeight * sizeH * 0.5, 0.1);
        },
        "y": function(ix) {
          return stack.reduce(function(sum, six) {
            return sum + (up ? -1 : 1) * drawInfo[ix]["columns"][six] / maxHeight * sizeH * 0.5;
          }, border + sizeH * 0.5);
        },
      });
      if(!interactive) {
        rsel.style({
          "cursor": "pointer",
        }).on("click", function(ix) {
          var tl = columnInfo[drawInfo[ix]["left_ix"]]["left"];
          var tr = columnInfo[drawInfo[ix]["right_ix"]]["right"];
          var pixs = jkjs.util.flatMap(ixsLookup, (il) => {
            var t = +il["pred"];
            if(tl <= t && tr > t) {
              return il["ixs"];
            }
            return [];
          });
          if(pixs.length !== drawInfo[ix]["columns"].reduce((p, v) => p + v, 0)) {
            console.warn("inconsistent numbers", pixs, drawInfo[ix]["columns"]);
            return;
          }
          onClick(tl, tr, pixs);
        });
      } // !interactive
    } // createRects

    createRects("posPos", 0, [ 1, 2 ], COLOR_LEFT, COLOR_LEFT_DARK, true);
    createRects("midPos", 1, [ 2 ], COLOR_EMPTY, COLOR_TMP, true);
    createRects("negPos", 2, [ ], "url(#hedge_pattern_right)", "url(#hedge_pattern_right_dark)", true);
    createRects("posNeg", 3, [ ], "url(#hedge_pattern_left)", "url(#hedge_pattern_left_dark)", false);
    createRects("midNeg", 4, [ 3 ], COLOR_EMPTY, COLOR_TMP, false);
    createRects("negNeg", 5, [ 3, 4 ], COLOR_RIGHT, COLOR_RIGHT_DARK, false);
  };
} // CountLine
