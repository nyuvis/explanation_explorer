/**
 * Created by krause on 2017-01-09.
 */

function Compact(sel, selHead, size, colors, fmt) {
  var that = this;
  var svg = sel.append("svg");
  var svgHead = selHead.append("svg");

  var pattern = new PatternGenerator(colors[2], colors[3]);
  pattern.addPatterns(svg);
  pattern.addPatterns(svgHead);

  pattern.addLegend(sel);

  var textShadow = "0 0 10px white, 0 0 10px white";

  var features = [];
  this.features = function(_) {
    if(!arguments.length) return features;
    features = _;
  };

  var compact = false;
  this.compact = function(_) {
    if(!arguments.length) return compact;
    compact = _;
    that.rows(that.rows());
  };

  var rows = [];
  var rixs = [];
  this.rows = function(_) {
    if(!arguments.length) return rows;
    rows = _;
    rixs = jkjs.util.flatMap(rows, (r, rix) =>
      compact? [ rix ] : [...Array(r["count"])].map(() => rix)
    );
  };

  function getRow(rix) {
    return rows[rixs[rix]];
  } // getRow

  var rSorts = [];
  this.rSorts = function(_) {
    if(!arguments.length) return rSorts;
    rSorts = _;
  };

  var fSorts = [];
  this.fSorts = function(_) {
    if(!arguments.length) return fSorts;
    fSorts = _;
  };

  var onClick = (rix, row, fix, f) => {};
  this.onClick = function(_) {
    if(!arguments.length) return onClick;
    onClick = _;
  };

  function isSpecial(fname) {
    return fname in specialColors;
  }

  function click(rix, fix) {
    onClick(rix, getRow(rix), fix, features[fix]);
  }; // click

  var onHover = function(rix, row, fix, f) {};
  this.onHover = function(_) {
    if(!arguments.length) return onHover;
    onHover = _;
  };

  function hover(rix, fix) {
    onHover(rix, getRow(rix), fix, features[fix]);
  } // hover

  var multiSelect = {};
  this.selectFeatures = function(_) {
    if(!arguments.length) return Object.keys(multiSelect);
    var s = {};
    _.forEach(function(ix) {
      s[ix] = true;
    });
    multiSelect = s;
  };

  this.highlight = (rix, fname) => {
    var normal = getFill("black", "white");
    var hover = getFill("#444", "#eee");

    function isHoverF(fix) {
      return fname && !isSpecial(fname) && features[fix]["id"] === fname;
    } // isHoverF

    function isHover(id) {
      return id[0] === rix || isHoverF(id[1]);
    } // isHover

    svg.selectAll("rect.cell").attr({
      "fill": (id) => isHover(id) ? hover(id) : normal(id),
    });
    svgHead.selectAll("text.fhead").attr({
      "font-weight": (fix) => isHoverF(fix) ? "bold" : "lighter",
    });
  };

  var specialColors = {};
  this.clearSpecialColor = () => {
    specialColors = {};
  };

  this.addSpecialColor = (fname, cb) => {
    specialColors[fname] = cb;
  };

  function specialColor(rix, row, fix, f) {
    if(!(f["id"] in specialColors)) {
      return "white";
    }
    return specialColors[f["id"]](rix, row, fix, f);
  } // specialColor

  function getFill(color, bgColor) {
    return (id) => {
      var rix = id[0];
      var row = getRow(rix);
      var fix = id[1];
      var fname = features[fix]["id"];
      if(isSpecial(fname)) {
        return specialColor(rix, row, fix, features[fix]);
      }
      var c = fname in multiSelect ? colors[0] : color;
      var bg = fname in multiSelect ? colors[1] : bgColor;
      return fname in row["features"] ? c : bg;
    };
  } // getFill

  this.update = () => {
    var wsize = size;
    var hsize = size;
    var margin = 5;
    var fontSize = hsize * 0.6;
    var central = hsize * 0.7;
    var textSize = fontSize * 3;
    var titleHeight = size * 7;
    var dmargin = margin / Math.sqrt(2);
    var titleLen = 2 * titleHeight / Math.sqrt(2) - 2 * dmargin;
    var dsize = hsize * 0.9 / Math.sqrt(2);
    var dcentral = central / Math.sqrt(2);
    var th = titleHeight + 2 * margin;
    var rw = wsize * features.length + textSize + 3 * margin + titleHeight;
    var rh = hsize * rixs.length + 2 * margin;
    sel.style({
      "width": rw + "px",
    });
    svg.attr({
      "width": rw,
      "height": rh,
    }).style({
      "width": rw + "px",
      "height": rh + "px",
    });

    selHead.style({
      "width": rw + "px",
    });
    svgHead.attr({
      "width": rw,
      "height": th,
    }).style({
      "width": rw + "px",
      "height": th + "px",
    });

    function computeSort(cache, s, ix, args) {
      var id = s[0] + "_" + ix;
      if(!(id in cache)) {
        cache[id] = s[3](args(ix));
      }
      return cache[id];
    } // computeSort

    var fixs = features.map((_, fix) => fix);
    var lSortCache = {};
    fixs.sort((aix, bix) => {
      var sa = features[aix]["id"] === "_label" ? 0 : 1;
      var sb = features[bix]["id"] === "_label" ? 0 : 1;
      var cmpL = d3.ascending(sa, sb);
      if(cmpL !== 0) {
        return cmpL;
      }
      return fSorts.reduce((cmp, s) => {
        if(cmp !== 0) {
          return cmp;
        }
        var a = computeSort(lSortCache, s, aix, (fix) => features[fix]);
        var b = computeSort(lSortCache, s, bix, (fix) => features[fix]);
        return s[2] ? d3.ascending(a, b) : d3.descending(a, b);
      }, 0);
    });

    var lSortFeatures = fixs.map((fix) => features[fix]);
    var ixs = rixs.map((_, ix) => ix);
    var rSortCache = {};
    ixs.sort((aix, bix) => {
      return rSorts.reduce((cmp, s) => {
        if(cmp !== 0) {
          return cmp;
        }
        var a = computeSort(rSortCache, s, aix, (ix) => [ getRow(ix), lSortFeatures ]);
        var b = computeSort(rSortCache, s, bix, (ix) => [ getRow(ix), lSortFeatures ]);
        return s[2] ? d3.ascending(a, b) : d3.descending(a, b);
      }, 0);
    });

    // features

    var hSel = svgHead.selectAll("g.fhead").data(fixs, (fix) => fix);
    hSel.exit().remove();
    var hSelE = hSel.enter().append("g").classed("fhead", true);
    hSelE.append("rect").classed("fhead", true);
    hSelE.append("text").classed("fhead", true);
    hSelE.append("title").classed("fhead", true);

    hSel.order();
    hSel.attr({
      "transform": (_, pos) =>
        "translate(" + [
          2 * margin + textSize + (pos + 1 - 0.5) * wsize + dsize * 0.5,
          titleHeight
        ] + ") rotate(-45)",
    });

    var maxFSize = features.reduce((p, f) => Math.max(p, f["sum"]), 1);
    hSel.selectAll("rect.fhead").attr({
      "x": -dmargin,
      "y": -dsize + dcentral * 0.25,
      "width": (fix) => titleLen * features[fix]["sum"] / maxFSize,
      "height": dsize,
      "fill": "lightgray",
      "stroke": "black",
      "stroke-width": 0.1,
    });

    hSel.selectAll("text.fhead").text((fix) => features[fix]["text"]).attr({
      "font-size": fontSize,
      "font-family": "courier",
      "stroke": "none",
      "text-anchor": "start",
      "font-style": (fix) => features[fix]["in_expl"] ? "italic" : "normal",
      "x": 0,
      "y": 0,
    }).style({
      "user-select": "none",
      "text-shadow": textShadow,
    });

    hSel.selectAll("title.fhead").text((fix) => features[fix]["title"]);

    // rows

    var gSel = svg.selectAll("g.row").data(ixs, (ix) => ix);
    gSel.exit().remove();
    var gSelE = gSel.enter().append("g").classed("row", true);
    var tSelE = gSelE.append("g").classed("gsize", true);
    tSelE.append("rect").classed("gsizefull", true);
    tSelE.append("rect").classed("gsize", true);
    tSelE.append("text").classed("gsize", true).append("tspan").classed("gsize", true);
    gSelE.append("g").classed("rectrow", true);
    gSel.order();

    gSel.attr({
      "transform": (_, pos) => "translate(" + [
        2 * margin + textSize,
        hsize * pos + margin
      ] + ")",
    });

    var maxCount = rows.reduce((p, r) => Math.max(p, r["count"]), 1);
    function getCountWidth(rix) {
      return getRow(rix)["count"] / maxCount * textSize;
    } // getCountWidth

    gSel.selectAll("g.gsize").on("click", function() {
      that.compact(!that.compact());
      that.update();
    }).style({
      "cursor": "pointer",
      "pointer-events": "all",
    });
    gSel.selectAll("rect.gsizefull").attr({
      "x": -margin - textSize,
      "y": 0,
      "width": textSize,
      "height": hsize,
      "fill": "none",
      "stroke": "none",
      "stroke-width": 0.1,
    });
    gSel.selectAll("rect.gsize").attr({
      "x": (rix) => -margin - getCountWidth(rix),
      "y": 0,
      "width": (rix) => getCountWidth(rix),
      "height": hsize,
      "fill": compact ? "lightgray" : "none",
      "stroke": compact ? "black" : "none",
      "stroke-width": 0.1,
    });
    gSel.selectAll("text.gsize").attr({
      "font-size": fontSize,
      "font-family": "courier",
      "font-weight": "lighter",
      "stroke": "none",
      "text-anchor": "end",
      "alignment-baseline": "central",
      "transform": "translate(" + [ -margin * 2, 0 ] + ")",
      "x": 0,
      "y": central,
    }).style({
      "user-select": "none",
      "text-shadow": textShadow,
    });
    gSel.selectAll("tspan.gsize").text(
      !compact ? "" : (rix) => fmt(getRow(rix)["count"])
    );

    var cellSel = gSel.selectAll("g.rectrow").selectAll("g.col").data((ix) =>
      fixs.map((fix) => [ ix, fix ])
    , (id) => id[0] + "_" + id[1]);
    cellSel.exit().remove();
    var cellSelE = cellSel.enter().append("g").classed("col", true);
    var rectSelE = cellSelE.append("rect").classed("cell", true);
    rectSelE.append("title");

    cellSel.order();
    cellSel.attr({
      "transform": (_, pos) => "translate(" + [ wsize * pos, 0 ] + ")",
    });

    cellSel.selectAll("rect.cell").attr({
      "x": 0,
      "y": 0,
      "width": wsize,
      "height": hsize,
      "stroke-width": 0.1,
      "stroke": "black",
    }).style({
      "cursor": "pointer",
    }).on("click", (id) =>
      click(id[0], id[1])
    ).on("mouseenter", (id) =>
      hover(id[0], id[1])
    );
    that.highlight(-1, null);

    svg.on("mouseleave", () => hover(-1, -1));

    cellSel.selectAll("title").text((id) => features[id[1]]["title"]);
  };
} // Expl
