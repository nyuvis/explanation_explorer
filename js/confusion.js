/**
 * Created by krause on 2016-02-10.
 */
function Confusion(sel, colors, noUncertain, fontSize, padding) {
  var that = this;
  var COLOR_LEFT = colors[0];
  var COLOR_RIGHT = colors[1];
  var uncertain = !noUncertain;

  function getPattern(color) {
    var s = 10;
    var svgNode = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svgNode.setAttributeNS("http://www.w3.org/2000/xmlns/", "xmlns", "http://www.w3.org/2000/svg");
    svgNode.setAttributeNS("http://www.w3.org/2000/xmlns/", "xmlns:xlink", "http://www.w3.org/1999/xlink");
    var svg = d3.select(svgNode).attr({
      "width": s,
      "height": s,
    }).style({
      "width": s + "px",
      "height": s + "px",
      "overflow": "hidden",
    });
    svg.append("rect").attr({
      "x": 0,
      "y": 0,
      "width": s,
      "height": s,
      "fill": color,
      "stroke": "none",
    });
    svg.append("path").attr({
      "fill": "none",
      "stroke": "black",
      "stroke-width": 0.5,
      "stroke-linecap": "square",
      "d": new jkjs.Path().move(0, s * 0.25).line(s * 0.25, 0)
                          .move(0, s * 0.75).line(s * 0.75, 0)
                          .move(s * 0.25, s).line(s, s * 0.25)
                          .move(s * 0.75, s).line(s, s * 0.75),
    });
    return "url(\"data:image/svg+xml;base64,"
      + window.btoa(svg.node().outerHTML)
      + "\")";
  } // getPattern
  var hedgeLeft = getPattern(COLOR_LEFT);
  var hedgeRight = getPattern(COLOR_RIGHT);

  var textShadow = "0 0 10px white, 0 0 10px white";

  var mainTable = sel.append("table").style({
    "border-collapse": "collapse",
    "empty-cells": "show",
    "font-size": fontSize,
    "padding": padding,
  });
  var headTable = mainTable.append("thead").append("tr");
  headTable.append("th").style({
    "font-size": fontSize,
    "padding": padding,
  });
  headTable.append("th").text("P (prediction)").style({
    "border-width": "0 0 2px 1px",
    "border-style": "solid",
    "text-align": "center",
    "font-size": fontSize,
    "padding": padding,
  });
  if(uncertain) {
    headTable.append("th").text("U (prediction)").style({
      "border-width": "0 0 2px 1px",
      "border-style": "solid",
      "text-align": "center",
      "font-size": fontSize,
      "padding": padding,
    });
  }
  headTable.append("th").text("N (prediction)").style({
    "border-width": "0 0 2px 1px",
    "border-style": "solid",
    "text-align": "center",
    "font-size": fontSize,
    "padding": padding,
  });
  headTable.append("th").style({
    "border-width": "0 0 1px 1px",
    "border-style": "solid",
    "width": "3em",
    "font-size": fontSize,
    "padding": padding,
  });
  var bodyTable = mainTable.append("tbody");
  var r1 = bodyTable.append("tr");
  r1.append("td").text("P (ground truth)").style({
    "font-weight": "bold",
    "border-width": "1px 2px 0 0",
    "border-style": "solid",
    "text-align": "center",
    "font-size": fontSize,
    "padding": padding,
  });
  var tp = r1.append("td").style({
    "border-color": "black",
    "border-width": "0 1px 1px 0",
    "border-style": "solid",
    "text-align": "right",
    "font-size": fontSize,
    "padding": padding,
  });
  var r1ign = uncertain ? r1.append("td").style({
    "border-color": "black",
    "border-width": "0 1px 1px 0",
    "border-style": "solid",
    "text-align": "right",
    "font-size": fontSize,
    "padding": padding,
  }) : d3.select();
  var fn = r1.append("td").style({
    "border-color": "black",
    "border-width": "0 0 1px 0",
    "border-style": "solid",
    "text-align": "right",
    "font-size": fontSize,
    "padding": padding,
  });
  var r1Sum = r1.append("td").style({
    "border-width": "0 0 1px 2px",
    "border-style": "solid",
    "text-align": "right",
    "font-size": fontSize,
    "padding": padding,
  });
  var r2 = bodyTable.append("tr");
  r2.append("td").text("N (ground truth)").style({
    "font-weight": "bold",
    "border-width": "1px 2px 0 0",
    "border-style": "solid",
    "text-align": "center",
    "font-size": fontSize,
    "padding": padding,
  });
  var fp = r2.append("td").style({
    "border-color": "black",
    "border-width": "0 1px 0 0",
    "border-style": "solid",
    "text-align": "right",
    "font-size": fontSize,
    "padding": padding,
  });
  var r2ign = uncertain ? r2.append("td").style({
    "border-color": "black",
    "border-width": "0 1px 0 0",
    "border-style": "solid",
    "text-align": "right",
    "font-size": fontSize,
    "padding": padding,
  }) : d3.select();
  var tn = r2.append("td").style({
    "text-align": "right",
    "font-size": fontSize,
    "padding": padding,
  });
  var r2Sum = r2.append("td").style({
    "border-width": "0 0 1px 2px",
    "border-style": "solid",
    "text-align": "right",
    "font-size": fontSize,
    "padding": padding,
  });
  var r3 = bodyTable.append("tr");
  r3.append("td").style({
    "border-width": "1px 1px 0 0",
    "border-style": "solid",
    "font-size": fontSize,
    "padding": padding,
  });
  var c1Sum = r3.append("td").style({
    "border-color": "black",
    "border-width": "2px 1px 0 0",
    "border-style": "solid",
    "text-align": "right",
    "font-size": fontSize,
    "padding": padding,
  });
  var ignSum = uncertain ? r3.append("td").style({
    "border-width": "2px 1px 0 0",
    "border-style": "solid",
    "text-align": "right",
    "font-size": fontSize,
    "padding": padding,
  }) : d3.select();
  var c2Sum = r3.append("td").style({
    "border-color": "black",
    "border-width": "2px 1px 0 0",
    "border-style": "solid",
    "text-align": "right",
    "font-size": fontSize,
    "padding": padding,
  });
  var allSum = r3.append("td").style({
    "font-weight": "bold",
    "text-align": "right",
    "font-size": fontSize,
    "padding": padding,
  });

  var vTp = 0;
  var vTn = 0;
  var vFp = 0;
  var vFn = 0;
  var vTign = 0;
  var vFign = 0;
  this.data = function(_) {
    if(!arguments.length) return [ vTp, vTn, vFp, vFn, vTign, vFign ];
    vTp = +_[0];
    vTn = +_[1];
    vFp = +_[2];
    vFn = +_[3];
    vTign = +_[4];
    vFign = +_[5];
  };

  this.stats = function(_) {
    if(!arguments.length) {
      return {
        "tp": vTp,
        "fp": vFp,
        "fn": vFn,
        "tn": vTn,
        "up": vTign,
        "un": vFign,
      };
    }
    vTp = +_["tp"];
    vFp = +_["fp"];
    vFn = +_["fn"];
    vTn = +_["tn"];
    vTign = uncertain ? +_["up"] : 0;
    vFign = uncertain ? +_["un"] : 0;
  };

  this.update = function() {

    function setColor(sel, img, color) {
      if(!img) {
        sel.style({
          "background": color,
        });
      } else {
        sel.style({
          "background-image": img,
        });
      }
      sel.style({
        "color": jkjs.util.getFontColor(color),
        "text-shadow": textShadow,
      });
    } // setColor

    setColor(tp, null, COLOR_LEFT);
    setColor(fp, hedgeLeft, COLOR_LEFT);
    setColor(fn, hedgeRight, COLOR_RIGHT);
    setColor(tn, null, COLOR_RIGHT);
    setColor(r1Sum, null, "darkgray");
    setColor(r2Sum, null, "lightgray");

    tp.text(vTp);
    if(uncertain) {
      r1ign.text(vTign);
      r2ign.text(vFign);
      ignSum.text(vTign + vFign);
    }
    fn.text(vFn);
    fp.text(vFp);
    tn.text(vTn);
    r1Sum.text(vTp + vTign + vFn);
    r2Sum.text(vFp + vFign + vTn);
    c1Sum.text(vTp + vFp);
    c2Sum.text(vFn + vTn);
    allSum.text(vTp + vTn + vFp + vFn + vTign + vFign);
  }; // update
  that.update();
} // Confusion
