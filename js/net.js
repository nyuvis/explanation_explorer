/**
 * Created by krause on 2016-02-04.
 */
function Net(statusSel) {
  var that = this;
  var preDelay = 500;
  var fastDuration = 200;
  var fastEase = "easeInOutCubic";
  var req = 0;
  var status = statusSel.append("i").style({
    "animation-duration": "0.8s",
    "opacity": 0.0
  }).classed({
    "fa": true,
    "fa-fw": true,
  });
  var multi = statusSel.append("span");

  var active = true;
  this.active = function(_) {
    if(!arguments.length) return active;
    active = _;
  };

  var otherReq = 0;
  this.otherReq = function(_) {
    if(!arguments.length) return otherReq;
    otherReq = +_;
    updateStatus();
  };

  function updateStatus() {
    if(req < 0 || otherReq < 0) {
      status.classed({
        "fa-frown-o": true,
        "fa-spin": false
      }).transition().duration(fastDuration).ease(fastEase).style({
        "opacity": 1
      });
    } else if(req + otherReq > 0) {
      status.classed({
        "fa-cog": true,
        "fa-spin": true
      }).transition().duration(fastDuration).ease(fastEase).style({
        "opacity": 1
      });
    } else {
      status.transition().duration(fastDuration).ease(fastEase).style({
        "opacity": 0
      });
    }
    multi.text(req + otherReq > 1 && req >= 0 && otherReq >= 0 ? "x" + (req + otherReq) : "");
  };

  function busy() {
    if(req < 0) return;
    req += 1;
    updateStatus();
  }

  function normal() {
    if(req < 0) return;
    req -= 1;
    updateStatus();
  }

  function error() {
    req = -1;
    updateStatus();
  }

  var starts = {};
  function runStart(ref) {
    setTimeout(function() {
      if(!starts[ref]) return;
      busy();
      var s = starts[ref];
      starts[ref] = null;
      if(!(ref in actives)) {
        actives[ref] = 0;
      } else {
        actives[ref] += 1;
      }
      var cur = actives[ref];
      if(s["method"] === "GET") {
        d3.json(s["url"], function(err, data) {
          if(err) {
            console.warn("Failed loading " + ref);
            error();
            return console.warn(err);
          }
          if(cur !== actives[ref]) {
            normal();
            return;
          }
          var err = true;
          try {
            s["cb"](data);
            err = false;
          } finally {
            if(err) {
              error();
            } else {
              normal();
            }
          }
        });
      } else if(s["method"] === "POST") {
        d3.json(s["url"]).header("Content-Type", "application/json").post(s["obj"], function(err, data) {
          if(err) {
            console.warn("Failed loading " + ref);
            error();
            return console.warn(err);
          }
          if(cur !== actives[ref]) {
            normal();
            return;
          }
          var err = true;
          try {
            s["cb"](data);
            err = false;
          } finally {
            if(err) {
              error();
            } else {
              normal();
            }
          }
        });
      } else {
        console.warn("unknown method", s);
      }
    }, preDelay);
  }

  var actives = {};
  this.get = function(id, url, cb) {
    if(!active) return;
    var ref = "GET " + id;
    starts[ref] = {
      "method": "GET",
      "url": url,
      "cb": cb,
    };
    runStart(ref);
  }; // get

  this.post = function(id, url, payload, cb) {
    if(!active) return;
    var ref = "POST " + id;
    var cur = actives[ref];
    var obj = JSON.stringify(payload);
    starts[ref] = {
      "method": "POST",
      "url": url,
      "cb": cb,
      "obj": obj,
    };
    runStart(ref);
  }; // post

  this.url = function(url, args) {
    return url + that.args(args);
  }; // url

  this.args = function(args) {
    return Object.keys(args).reduce(function(str, val, ix) {
      if(args[val] === null) {
        return str;
      }
      str += str.length ? "&" : "?";
      str += encodeURIComponent(val);
      str += "=";
      str += encodeURIComponent(args[val]);
      return str;
    }, "");
  }; // args
} // Net
