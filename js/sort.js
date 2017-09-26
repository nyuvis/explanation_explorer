/**
 * Created by krause on 2017-02-19.
 */

function Sort(sel, onClick, onAscClick) {
  var that = this;

  var sorts = [];
  this.sorts = function(_) {
    if(!arguments.length) {
      return sorts;
    }
    sorts = _;
  }; // sorts

  this.moveUp = (id) => {
    var el = null;
    var isFirst = 0;
    sorts = jkjs.util.flatMap(sorts, (s) => {
      if(!el && s[0] === id) {
        el = s;
        if(isFirst === 0) {
          isFirst = 1;
        }
        return [];
      }
      if(isFirst === 0) {
        isFirst = -1;
      }
      return [ s ];
    });
    if(el) {
      sorts.unshift(el);
    }
    return isFirst > 0;
  }; // moveUp

  this.toggleAsc = (id) => {
    sorts = sorts.map((s, pos) =>
      s[0] === id ? [ s[0], s[1], !s[2] ] : s
    );
  }; // toggleAsc

  var lastHoverAsc = -1;
  this.update = () => {
    var ixs = sorts.map((_, ix) => ix);
    var bSel = sel.selectAll("div.el").data(ixs, (ix) => ix);
    bSel.exit().remove();
    var bSelE = bSel.enter().append("div").classed("el", true);
    bSelE.append("i").classed("asc", true);
    bSelE.append("span").classed("rect", true);

    bSel.style({
      "margin": "5px",
      "text-overflow": "ellipsis",
      "white-space": "nowrap",
    }).order();
    bSel.selectAll("span.rect").text((ix) => sorts[ix][1]).attr({
      "title": (ix) => sorts[ix][1],
    }).style({
      "height": "1.5em",
      "border": "1px solid black",
      "border-radius": "5px",
      "padding": "2px",
      "user-select": "none",
      "cursor": "pointer",
      "text-overflow": "ellipsis",
      "white-space": "nowrap",
      "width": "auto",
    }).on("click", function(ix) {
      onClick(sorts[ix], ix);
    }).on("mouseenter", (ix) => {
      highlightRect(ix);
    }).on("mouseleave", (ix) => {
      highlightRect(-1);
    });

    function highlightRect(six) {
      bSel.selectAll("span.rect").style({
        "background": (ix) => ix === six ? "#e7e7e7" : "white",
        "color": (ix) => jkjs.util.getFontColor(ix === six ? "#e7e7e7" : "white"),
      });
    } // highlightRect

    highlightRect(-1);

    bSel.selectAll("i.asc").classed({
      "fa": true,
      "fa-sort-amount-asc": function(ix) {
        return sorts[ix][2];
      },
      "fa-sort-amount-desc": function(ix) {
        return !sorts[ix][2];
      },
    }).attr({
      "aria-hidden": "true",
    }).style({
      "margin": "4px",
      "user-select": "none",
      "cursor": "pointer",
    }).on("click", function(ix) {
      onAscClick(sorts[ix]);
    }).on("mouseenter", (ix) => {
      highlightAsc(ix);
    }).on("mouseleave", (ix) => {
      highlightAsc(-1);
    });

    function highlightAsc(six) {
      bSel.selectAll("i.asc").style({
        "color": (ix) => ix === six ? "#666" : "black",
      });
      lastHoverAsc = six;
    } // highlightAsc

    highlightAsc(lastHoverAsc);
  }; // update
} // Sort
