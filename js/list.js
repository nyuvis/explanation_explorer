/**
 * Created by krause on 2016-09-14.
 */

function List(sel, width, height, onClick) {
  var that = this;
  var list = sel.style({
    "width": width,
    "height": height,
    "overflow-y": "auto",
    "overflow-x": "hidden",
  }).append("ul").style({
    "padding": 0,
    "margin": 0,
  });

  this.listSel = function() {
    return list;
  };

  var elems = [];
  var ixs = [];
  this.elems = function(_) {
    if(!arguments.length) return elems;
    elems = _;
    ixs = elems.map(function(e, ix) {
      return ix;
    });
  };
  this.transform = function(cb) {
    elems = elems.map(cb);
  };
  this.order = function(sorter) {
    ixs.sort(function(aix, bix) {
      return sorter(elems[aix], elems[bix]);
    });
  };

  var fired = false;
  var selected = null;
  this.select = function(_) {
    if(!arguments.length) return selected;
    selected = _;
    fired = false;
  };

  this.toggleCurrent = function() {
    if(!selected) return;
    if(selected in multiSelect) {
      var s = {};
      Object.keys(multiSelect).forEach(function(ix) {
        if(ix === selected) return;
        s[ix] = true;
      });
      multiSelect = s;
    } else {
      multiSelect[selected] = true;
    }
    selected = null;
  };

  var multiSelect = {};
  this.selectMulti = function(_) {
    if(!arguments.length) return Object.keys(multiSelect);
    var s = {};
    _.forEach(function(ix) {
      s[ix] = true;
    });
    multiSelect = s;
  };

  var onHover = null;
  this.onHover = function(_) {
    if(!arguments.length) return onHover;
    onHover = _;
  };

  this.highlight = function(ix) {
    list.selectAll("li.elem").style({
      "background": function(eix) {
        var e = elems[eix];
        return isSelected(e["ix"]) ? "rgb(55, 126, 184)" : (e["ix"] === ix ? "#e7e7e7" : null);
      },
      "font-weight": function(eix) {
        var e = elems[eix];
        return isSelected(e["ix"]) ? "bold" : null;
      },
      "color": function(eix) {
        var e = elems[eix];
        return isSelected(e["ix"]) ? "white" : null;
      },
    });
  };

  this.selectionIntoView = function() {
    list.selectAll("li.elem").each(function(eix) {
      var e = elems[eix];
      if(isSelected(e["ix"])) {
        d3.select(this).node().scrollIntoView(false);
      }
    });
  };

  function isSelected(ix) {
    return ix === selected || ix in multiSelect;
  } // isSelected

  this.update = function() {
    var l = list.selectAll("li.elem").data(ixs, function(ix) {
      return ix;
    });
    l.exit().remove();
    l.enter().append("li").classed("elem", true);

    list.selectAll("li.elem:hover").style({
      "background": function(eix) {
        var e = elems[eix];
        return isSelected(e["ix"]) ? "rgb(55, 126, 184)" : "#e7e7e7";
      }
    });

    l.style({
      "list-style-type": "none",
      "cursor": "pointer",
      "padding": "5px",
    }).attr({
      "title": function(eix) {
        var e = elems[eix];
        return e["text"];
      },
    }).text(function(eix) {
      var e = elems[eix];
      if(!fired && isSelected(e["ix"])) {
        fired = true;
        onClick(e);
      }
      return e["text"];
    }).on("click", function(eix) {
      var e = elems[eix];
      that.select(e["ix"]);
      if(!fired) {
        fired = true;
        onClick(e);
      }
      that.update();
    }).on("mouseenter", function(eix) {
      if(onHover) {
        var e = elems[eix];
        that.highlight(null);
        onHover(e);
      }
    }).order();
    that.highlight(null);

    list.on("mouseleave", function() {
      if(onHover) {
        that.highlight(null);
        onHover(null);
      }
    });
  };
}; // List
