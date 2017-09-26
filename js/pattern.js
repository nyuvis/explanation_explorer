/**
 * Created by krause on 2017-04-20.
 */
function PatternGenerator(leftColor, rightColor) {
  var that = this;

  var leftColorDark = null;
  var rightColorDark = null;
  this.setDarkColors = function(lc, rc) {
    leftColorDark = lc;
    rightColorDark = rc;
  }; // setDarkColors

  var posColor = null;
  var negColor = null;
  this.setPosColors = function(lc, rc) {
    posColor = lc;
    negColor = rc;
  }; // setPosColors

  function createPattern(hedge, s, color) {
    hedge.append("rect").attr({
      "x": 0,
      "y": 0,
      "width": s,
      "height": s,
      "fill": color,
      "stroke": "none",
      "stroke-width": 0,
    });
    hedge.append("path").attr({
      "fill": "none",
      "stroke": "black",
      "stroke-width": 0.5,
      "stroke-linecap": "square",
      "d": new jkjs.Path().move(0, s * 0.25).line(s * 0.25, 0)
                          .move(0, s * 0.75).line(s * 0.75, 0)
                          .move(s * 0.25, s).line(s, s * 0.25)
                          .move(s * 0.75, s).line(s, s * 0.75),
    });
  } // createPattern

  this.addPatterns = function(root) {
    var defs = root.append("defs");
    var s = 10;
    var vec = [
      [ "hedge_pattern_left", leftColor ],
      [ "hedge_pattern_right", rightColor ],
    ];
    if(leftColorDark) {
      vec.push([ "hedge_pattern_left_dark", leftColorDark ]);
    }
    if(rightColorDark) {
      vec.push([ "hedge_pattern_right_dark", rightColorDark ]);
    }
    vec.forEach((arr) => {
      var id = arr[0];
      var color = arr[1];
      var hedge = defs.append("pattern").attr({
        "id": id,
        "x": 0,
        "y": 0,
        "width": s,
        "height": s,
        "patternUnits": "userSpaceOnUse",
      });
      createPattern(hedge, s, color);
    });
  }; // addPatterns

  this.getPatternURL = function(color) {
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
    createPattern(svg, s, color);
    return "url(\"data:image/svg+xml;base64,"
      + window.btoa(svg.node().outerHTML)
      + "\")";
  }; // getPatternURL

  this.getShadow = function(color, radius, times) {
    var c = color;
    if(c === "url(#hedge_pattern_left)") {
      c = leftColor;
    }
    if(c === "url(#hedge_pattern_right)") {
      c = rightColor;
    }
    return [...Array(times)].map(() => "0 0 " + radius + "px " + c).join(",");
  }; // getShadow

  this.addLegend = function(sel) {
    var legend = sel.append("div").style({
      "position": "fixed",
      "bottom": "25px",
      "right": "25px",
    });
    var vec = [
      [ "true positive", leftColor ],
      [ "false positive", that.getPatternURL(leftColor) ],
      [ "false negative", that.getPatternURL(rightColor) ],
      [ "true negative", rightColor ],
    ];
    if(posColor) {
      vec.push([ "positive", posColor ]);
    }
    if(negColor) {
      vec.push([ "negative", negColor ]);
    }
    var textShadow = that.getShadow("white", 5, 4);
    vec.forEach((arr) => {
      var name = arr[0];
      var color = arr[1];
      var row = legend.append("div");
      row.append("span").style({
        "display": "inline-block",
        "border": "black 1px solid",
        "background": color,
        "width": "1em",
        "height": "1em",
        "vertical-align": "middle",
        "user-select": "none",
      });
      row.append("span").style({
        "vertical-align": "middle",
        "user-select": "none",
      }).text(" ");
      row.append("span").style({
        "vertical-align": "middle",
        "user-select": "none",
        "text-shadow": textShadow,
      }).text(name);
    });
  }; // addLegend
} // PatternGenerator
