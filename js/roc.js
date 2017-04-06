/**
 * Created by krause on 2016-02-02.
 */
function ROC(sel, setting, size, border, onROCThreshold, scoreTmp, fmt, colors) {
  var that = this;
  var COLOR_LEFT = colors[0];
  var COLOR_RIGHT = colors[1];
  var COLOR_TMP = colors[2];

  var interactive = true;
  this.interactive = function(_) {
    if(!arguments.length) return interactive;
    interactive = !!_;
  };

  var lastL = null;
  var lastR = null;
  function doSelect(p, left) {
    if(left) {
      lastL = p;
    } else {
      lastR = p;
    }
    var xposL = lastL ? getXPos(lastL) : xScale(0.0);
    var yposL = lastL ? getYPos(lastL) : yScale(0.0);
    var xposR = lastR ? getXPos(lastR) : xScale(0.0);
    var yposR = lastR ? getYPos(lastR) : yScale(0.0);
    var sameX = xposL === xposR;
    var sameY = yposL === yposR;
    [ false, true ].forEach((l) => {
      (l ? leftThresholdX : rightThresholdX).attr({
        "x1": l ? xposL : xposR,
        "x2": l ? xposL : xposR,
        "y1": sameY && !l ? yposL : yScale(0.0),
        "y2": sameY && l ? yposR : yScale(1.0),
        "opacity": 1
      });
      (l ? leftThresholdY : rightThresholdY).attr({
        "x1": sameX && !l ? xposL : xScale(0.0),
        "x2": sameX && l ? xposR : xScale(1.0),
        "y1": l ? yposL : yposR,
        "y2": l ? yposL : yposR,
        "opacity": 1
      });
    });
    if(setting["shade"]) {
      var xpos = p ? getXPos(p) : xScale(0.0);
      var ypos = p ? getYPos(p) : yScale(0.0);
      (left ? leftThresholdRect : rightThresholdRect).attr({
        "x": left ? xScale(0.0) : xpos,
        "y": left ? ypos : yScale(1.0),
        "width": left ? xpos - xScale(0.0) : xScale(1.0) - xpos,
        "height": left ? yScale(0.0) - ypos : ypos - yScale(1.0)
      });
    }
    var val = p ? +p["score"] : 0.0;
    onROCThreshold(val, left);
  }

  function getPointForScore(score) {
    if(Number.isNaN(score)) return null;
    var p = null;
    points.some(function(cp) {
      if(+cp["score"] === +score) {
        p = cp;
        return true;
      }
      return false;
    });
    return p;
  }

  this.setROCThreshold = function(score, left) {
    doSelect(getPointForScore(score), left);
  };

  this.setROCTemp = function(score) {
    setTmp(getPointForScore(score));
  };

  var onROCTemp = function(score) {};
  this.onROCTemp = function(_) {
    if(!arguments.length) return _;
    onROCTemp = _;
  };

  var init = false;
  var lastRightPoint = [ Number.NaN, Number.NaN ];
  var svg = sel.append("svg").attr({
    "width": size + border*2,
    "height": size + border*2
  }).style({
    "cursor": "crosshair"
  });

  function getPoint(pos) {
    var mx = pos[0];
    var my = pos[1];
    if(mx < xScale(0) || mx > xScale(1) || my < yScale(1) || my > yScale(0)) {
      setTmp(null);
      return null;
    }
    var distSq = Number.POSITIVE_INFINITY;
    var point = null;
    points.forEach(function(p) {
      var x = getXPos(p);
      var y = getYPos(p);
      var ds = (x - mx)*(x - mx) + (y - my)*(y - my);
      if(ds < distSq) {
        distSq = ds;
        point = p;
      }
    });
    setTmp(point);
    return point;
  }

  var oldTemp = Number.NaN;
  function setTmp(point) {
    var score = point ? +point["score"] : Number.NaN;
    if(oldTemp === score || (Number.isNaN(oldTemp) && Number.isNaN(score))) return;
    oldTemp = score;
    if(!point) {
      curMouseX.attr({
        "opacity": 0
      });
      curMouseY.attr({
        "opacity": 0
      });
    } else {
      var xpos = getXPos(point);
      curMouseX.attr({
        "x1": xpos,
        "x2": xpos,
        "opacity": 1
      });
      var ypos = getYPos(point);
      curMouseY.attr({
        "y1": ypos,
        "y2": ypos,
        "opacity": 1
      });
    }
    scoreTmp.text(fmt(point ? score : 0.0));
    onROCTemp(score);
  }

  function mousePos() {
    return d3.mouse(svg.node());
  }

  var xScale = d3.scale.linear().domain([ 0.0, 1.0 ]).range([ border, border + size ]);
  var yScale = d3.scale.linear().domain([ 1.0, 0.0 ]).range([ border, border + size ]);

  var xAxis = d3.svg.axis().scale(xScale).ticks(4).tickSize(5).tickSubdivide(false).orient("top");
  var yAxis = d3.svg.axis().scale(yScale).ticks(4).tickSize(5).tickSubdivide(false).orient("right");

  svg.append("g").classed({
    "x": true,
    "axis": true
  }).attr({
    "transform": "translate(" + [ 0, border ] + ")"
  }).call(xAxis);
  svg.append("g").classed({
    "y": true,
    "axis": true
  }).attr({
    "transform": "translate(" + [ size + border, 0 ] + ")"
  }).call(yAxis);

  var curMouseX = svg.append("line").attr({
    "x1": xScale(0),
    "y1": yScale(0),
    "x2": xScale(0),
    "y2": yScale(1),
    "opacity": 0,
    "stroke": COLOR_TMP,
  });
  var curMouseY = svg.append("line").attr({
    "x1": xScale(0),
    "y1": yScale(0),
    "x2": xScale(1),
    "y2": yScale(0),
    "opacity": 0,
    "stroke": COLOR_TMP,
  });
  var leftThresholdX = svg.append("line").attr({
    "x1": xScale(0),
    "y1": yScale(0),
    "x2": xScale(0),
    "y2": yScale(1),
    "opacity": 0,
    "stroke": COLOR_LEFT,
  });
  var leftThresholdY = svg.append("line").attr({
    "x1": xScale(0),
    "y1": yScale(0),
    "x2": xScale(1),
    "y2": yScale(0),
    "opacity": 0,
    "stroke": COLOR_LEFT,
  });
  var leftThresholdRect = svg.append("rect").attr({
    "stroke": "none",
    "fill": COLOR_LEFT,
    "opacity": 0.1,
    "x": xScale(0),
    "y": yScale(0),
    "width": 0,
    "height": 0,
  });
  var rightThresholdX = svg.append("line").attr({
    "x1": xScale(0),
    "y1": yScale(0),
    "x2": xScale(0),
    "y2": yScale(1),
    "opacity": 0,
    "stroke": COLOR_RIGHT,
  });
  var rightThresholdY = svg.append("line").attr({
    "x1": xScale(0),
    "y1": yScale(0),
    "x2": xScale(1),
    "y2": yScale(0),
    "opacity": 0,
    "stroke": COLOR_RIGHT,
  });
  var rightThresholdRect = svg.append("rect").attr({
    "stroke": "none",
    "fill": COLOR_RIGHT,
    "opacity": 0.1,
    "x": xScale(0),
    "y": yScale(0),
    "width": 0,
    "height": 0,
  });
  svg.append("rect").attr({
    "width": xScale(1) - xScale(0),
    "height": yScale(0) - yScale(1),
    "x": xScale(0),
    "y": yScale(1),
    "fill": "none",
    "stroke": "black"
  });
  svg.append("text").attr({
    "x": border + size * 0.5,
    "y": size + border * 1.5,
    "text-anchor": "middle",
    "alignment-baseline": "middle"
  }).text(setting["x-axis"]);
  svg.append("text").attr({
    "x": 0,
    "y": 0,
    "text-anchor": "middle",
    "alignment-baseline": "middle",
    "transform": "translate(" + [ border * 0.5, border + size * 0.5 ] + ") rotate(-90)"
  }).text(setting["y-axis"]);

  function getCoord(pos, x) {
    if(pos === "bl") return x ? xScale(0) : yScale(0);
    if(pos === "tr") return x ? xScale(1) : yScale(1);
    if(pos === "tl") return x ? xScale(0) : yScale(1);
    if(pos === "br") return x ? xScale(1) : yScale(0);
    return x ? xScale(0) : yScale(0);
  }

  svg.append("line").attr({
    "x1": getCoord(setting["diagonal"][0], true),
    "y1": getCoord(setting["diagonal"][0], false),
    "x2": getCoord(setting["diagonal"][1], true),
    "y2": getCoord(setting["diagonal"][1], false),
    "stroke-dasharray": "5, 5",
    "stroke": "lightgray"
  });
  var aucText = svg.append("text").attr({
    "x": border * 0.3,
    "y": size + border * 1.5,
    "text-anchor": "left",
    "alignment-baseline": "middle"
  }).text("");

  var auc = 0.0;
  this.auc = function(_) {
    if(!arguments.length) return auc;
    auc = _;
    aucText.text(setting["note"] ? setting["note"] + ": " + fmt(auc) : "");
  };

  var points = [];
  this.points = function(_) {
    if(!arguments.length) return points;
    points = _;
  };

  function getXPos(p) {
    return xScale(setting["x"](+p["tp"], +p["tn"], +p["fp"], +p["fn"]));
  }

  function getYPos(p) {
    return yScale(setting["y"](+p["tp"], +p["tn"], +p["fp"], +p["fn"]));
  }

  this.update = function() {
    if(!init) {
      svg.on("mousemove", function() {
        getPoint(mousePos());
      }).on("mouseout", function() {
        setTmp(null);
      });
      if(interactive) {
        svg.on("click", function() {
          var p = getPoint(mousePos());
          p && doSelect(p, true);
        }).on("contextmenu", function() {
          var p = mousePos();
          if(!p || (p[0] === lastRightPoint[0] && p[1] === lastRightPoint[1])) {
            return;
          }
          doSelect(getPoint(p), false);
          lastRightPoint = p;
          d3.event.preventDefault();
        });
      } // interactive
      init = false;
    } // init

    var prev = [ xScale(1), yScale(1) ];
    var lines = points.map(function(p) {
      var oldPrev = [ prev[0], prev[1] ];
      prev[0] = getXPos(p);
      prev[1] = getYPos(p);
      return {
        "x1": oldPrev[0],
        "y1": oldPrev[1],
        "x2": prev[0],
        "y2": prev[1]
      };
    });
    var selR = svg.selectAll("line.roc").data(lines);
    selR.exit().remove();
    selR.enter().append("line").classed("roc", true);
    selR.attr({
      "x1": function(l) { return l["x1"]; },
      "y1": function(l) { return l["y1"]; },
      "x2": function(l) { return l["x2"]; },
      "y2": function(l) { return l["y2"]; },
      "stroke": "black",
    });
  }; // update
} // ROC
ROC.SETTING_ROC = {
  "x-axis": "FPR",
  "y-axis": "TPR",
  "note": "AUC",
  "x": function(tp, tn, fp, fn) {
    return fp / (fp + tn);
  },
  "y": function(tp, tn, fp, fn) {
    return tp / (tp + fn);
  },
  "shade": true,
  "diagonal": [ "bl", "tr" ],
};
ROC.SETTING_PREREC = {
  "x-axis": "Recall",
  "y-axis": "Precision",
  "note": null,
  "x": function(tp, tn, fp, fn) {
    return tp + fn !== 0 ? tp / (tp + fn) : 1.0;
  },
  "y": function(tp, tn, fp, fn) {
    return tp + fp !== 0 ? tp / (tp + fp) : 1.0;
  },
  "shade": false,
  "diagonal": [ "tl", "br" ],
};
