/**
 * Created by krause on 2017-02-19.
 */

function Search(sel, getSuggestions) {
  var that = this;
  var label = sel.append("span").style({
    "float": "left",
    "width": "2em",
    "height": "2em",
    "padding-top": "0.5em",
    "text-align": "center",
  });
  label.append("i").classed({
    "fa": true,
    "fa-search": true,
  });
  var group = sel.append("div").style({
    "float": "left",
    "width": "auto",
  }).append("div").classed({
    "dropdown": true,
    "btn-group": true,
  }).on("click", function() {
    searchInput.select().node().focus();
  });
  var field = group.append("span").classed({
    "btn": true,
    "btn-default": true,
  }).style({
    "padding": "3px",
    "width": "auto",
  });
  var toggle = group.append("button").classed({
    "btn": true,
    "btn-default": true,
    "dropdown-toggle": true,
  }).attr({
    "type": "button"
  }).on("click", function() {
    if(group.classed("open")) {
      setOpenSearchList(false);
    } else {
      requestSuggestions(searchText.value);
    }
    d3.event.stopPropagation();
  });
  var dropdownList = group.append("div").classed("dropdown-menu", true);
  toggle.append("span").classed("caret", true);
  sel.append("div").style({
    "clear": "both",
  });

  d3.select("body").on("click", function() {
    setOpenSearchList(false);
  });

  var searchText = new jkjs.Cell("");
  searchText.addChangeListener(function() {
    suggestionList.select(searchText.value);
    suggestionList.selectionIntoView();
    suggestionList.highlight(null);
  });

  var onClickSubmit = function(st) {};
  this.onClickSubmit = function(_) {
    if(!arguments.length) return onClickSubmit;
    onClickSubmit = _;
  };

  var searchInput = new jkjs.InputText(field, searchText);

  var suggestionList = new List(dropdownList, "100%", null, function(e) {
    searchText.value = e["text"];
    searchInput.select().node().focus();
    setOpenSearchList(false);
  });
  suggestionList.listSel().style({
    "max-height": "300px",
  });

  searchInput.select().style({
    "font-family": 'Menlo, Monaco, Consolas, "Courier New", monospace',
  }).on("keypress", function() {
    var code = d3.event.code;
    if(code === "Enter") {
      if(group.classed("open")) {
        setOpenSearchList(false);
        return;
      }
      var si = this;
      searchText.value = si.value;
      if(searchText.value.trim()) {
        onClickSubmit(searchText.value);
        si.blur();
      }
    }
  }).on("keydown", function() {
    var code = d3.event.code;
    if(code === "ArrowDown") {
      moveSearchCursor(true);
    } else if(code === "ArrowUp") {
      moveSearchCursor(false);
    } else if(code === "Escape") {
      setOpenSearchList(false);
      searchText.value = searchBuffer;
    }
  }).on("input", function() {
    var term = this.value;
    requestSuggestions(term);
  });

  function requestSuggestions(term) {
    setTimeout(function() {
      var list = getSuggestions(term);
      suggestionList.elems(list.map(function(e) {
        return {
          "ix": e,
          "text": e,
        };
      }));
      suggestionList.update();
      setOpenSearchList(true);
    }, 100);
  } // requestSuggestions

  var searchBuffer = "";
  function setOpenSearchList(open) {
    group.classed("open", open);
    if(open) {
      searchBuffer = searchInput.select().node().value;
      if(suggestionList.elems().map(function(e) {
        return e["text"];
      }).indexOf(searchBuffer) >= 0) {
        searchBuffer = "";
      }
      searchInput.select().node().focus();
    }
  } // setOpenSearchList

  function moveSearchCursor(down) {
    var searchInputEl = searchInput.select().node();
    if(!group.classed("open")) {
      if(!down) return;
      searchText.value = searchInputEl.value;
      requestSuggestions(searchText.value);
      return;
    }
    var list = suggestionList.elems().map(function(e) {
      return e["text"];
    });
    var ix = list.indexOf(searchInputEl.value);
    ix += down ? 1 : -1;
    if(ix < 0) {
      searchText.value = searchBuffer;
    } else {
      searchText.value = list[Math.min(ix, list.length - 1)];
    }
  } // moveSearchCursor

} // Search
