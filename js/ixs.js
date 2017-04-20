/**
 * Created by krause on 2017-02-17.
 */

function IxsList(sel, net) {
  var that = this;
  var ul = sel.append("ul").classed("list-group", true);

  var token = null;
  this.token = function(_) {
    if(!arguments.length) return token;
    token = _;
    ixsList = [];
  };

  var ixsList = [];
  this.choosePos = function(pos, cb) {
    net.post("ixs_put", "explainer_ixs_put/", {
      "token": token,
      "pos": pos,
    }, function(data) {
      ixsList = data;
      cb(pos, pos === ixsList.length - 1);
      that.update();
    });
  };

  this.chooseIxs = function(ixs, msg, cb) {
    if(ixs.length === 0) {
      return;
    }
    net.post("ixs_put", "explainer_ixs_put/", {
      "token": token,
      "ixs": ixs,
      "msg": msg,
    }, function(data) {
      ixsList = data;
      cb(ixsList.length - 1, true);
      that.update();
    });
  };

  var onClick = function(pos, isNew) {};
  this.onClick = function(_) {
    if(!arguments.length) return onClick;
    onClick = _;
  };

  var onCreate = function() {
    throw {
      "err": "unimplemented",
    };
  };
  this.onCreate = function(_) {
    if(!arguments.length) return onCreate;
    onCreate = _;
  };

  var onMsg = function() {
    return null;
  };
  this.onMsg = function(_) {
    if(!arguments.length) return onMsg;
    onMsg = _;
  };

  this.update = function() {
    if(ixsList.length === 0) {
      if(token === null) return;
      net.post("ixs_get", "explainer_ixs_get/", {
        "token": token,
      }, function(data) {
        ixsList = data;
        that.update();
      });
      return;
    }
    var lixs = ixsList.map(function(_, pos) {
      return pos;
    });
    var selPos = lixs.length - 1;
    lixs.push(-1);
    var iSel = ul.selectAll("li").data(lixs, function(pos) {
      return pos;
    });
    iSel.exit().remove();
    iSel.enter().append("li");
    iSel.order();
    iSel.classed({
      "list-group-item": true,
    }).style({
      "cursor": "pointer",
      "text-align": "center",
      "font-weight": function(pos) {
        return pos === selPos && selPos >= 0 ? "bold" : null;
      },
    }).text(function(pos) {
      return pos < 0 ? "+" : ixsList[pos];
    }).on("click", function(pos) {
      if(pos < 0) {
        that.chooseIxs(onCreate(), onMsg(), onClick);
      } else {
        that.choosePos(pos, onClick);
      }
    }).on("mouseenter", function() {
      d3.select(this).style({
        "background-color": "#eee",
      });
    }).on("mouseleave", function() {
      d3.select(this).style({
        "background-color": null,
      });
    });
  }; // update
} // IxsList
