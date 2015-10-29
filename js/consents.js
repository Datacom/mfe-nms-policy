var resetTabCharts 
var _data = {};
var original_data
var _council_bounds = {};
var _region_bounds = {};
var _auth_dict = {};
var _region_dict = {};
var _label_dict = {};
var _title_text = {};
var small_chart_height = 150;

var days_binsize = 2;
var max_days_bin = 100;
var cost_binsize = 500;
var max_cost_bin = 10000;

var donut_inner = 43
var donut_outer = 70
var donut_height = 150

var getkeys;
//----------------------------------------CLEANUP functions----------------------------------------------------------------------------

function cleanup(d) {
  trimAll(d);
  
  d.date = dateFormat.parse(d['Date lodged']);
  
 
  d.hasAppeal = d["Appealed"].toLowerCase() != 'yes' ? "No" :"Yes"
  d.hasObjection = d["Section 357 objections"].toLowerCase() != 'yes' ? "No" :"Yes"
  
  d["Notification Decision"] = titleCase(d["Notification Decision"])
  d["Notification Decision"] = d["Notification Decision"]=="" ? "empty cell":d["Notification Decision"]
  d["Type of resource consent"] =titleCase(d["Type of resource consent"])
  d.Council=titleCase(d.Council)
  d.council_type = _auth_dict[d["Council"]].council_type
  d["Total charge for applicant"]=+d["Total charge for applicant"].replace("$","").replace(",","")
  if (isNaN(d["Total charge for applicant"])) { d["Total charge for applicant"] = 0}
  d["Deposit charged"]=+d["Deposit charged"].replace("$","").replace(",","")
  if (isNaN(d["Deposit charged"])) { d["Deposit charged"] = 0}
  d["Amount of discount"]=+d["Amount of discount"].replace("$","").replace(",","")
  if (isNaN(d["Amount of discount"])) { d["Amount of discount"] = 0}
  d["further information requested"] = (d["Date of first section 92(1) request"].toLowerCase() == "Not Applicable".toLowerCase())?0:1;
  d["Class of activity"] = titleCase(d["Class of activity"])
  d["Decision"] = titleCase(d["Decision"])
  d["Decision"] = d["Decision"]=="" ? "empty cell":d["Decision"]
  d["Decision-maker"] = titleCase(d["Decision-maker"])
  d["Decision-maker"] = d["Decision-maker"]=="" ? "empty cell":d["Decision-maker"]
  d["Type of application"] =titleCase(d["Type of application"])
  d["Statutory days lapsed"] = +d["Statutory days lapsed"]
  
  d.days_bin = Math.min(Math.floor(d["Statutory days lapsed"]/days_binsize)*days_binsize,max_days_bin)
  d.cost_bin = Math.min(Math.floor(d["Total charge for applicant"]/cost_binsize)*cost_binsize,max_cost_bin)
  
  d.hasCost = d["Total charge for applicant"] > 0 ? "Yes" : "No"
  d.hasDiscount = d["Amount of discount"] == 0 ? "No":"Yes"
  
  
  return d;
}


//-------------------------------------crossfilter reduce functions------------------------------------------------------------------
function Init(isFake){return {count : 0,
                        countCharges : 0,
                        sumCharges:0,
                        sumDiscount : 0,
                        countObjections : 0,
                        meanCost : function(){return this.count >0 ? this.sumCharges/this.count : 0}, 
                        meanDiscount : function(){return this.countCharges > 0 ?this.sumDiscount/this.countCharges : 0 },
                        percentObjections : function(){return this.count > 0 ? this.countObjections/this.count : 0},
                        not_real : !!isFake,
                        }
                   }

function Add(p,v){p.count  += 1
                  p.sumCharges  += v["Total charge for applicant"]
                  p.sumDiscount += v["Amount of discount"]
                  p.countCharges += v["Total charge for applicant"] > 0 ? 1 : 0
                  p.countObjections += v.hasObjection == "Yes" ? 1 : 0
                  return p;
                }

function Remove(p,v){p.count -= 1
                    p.sumCharges   -= v["Total charge for applicant"]
                    p.sumDiscount -= v["Amount of discount"]
                    p.countCharges -= v["Total charge for applicant"] > 0 ? 1 : 0
                    p.countObjections -= v.hasObjection == "Yes" ? 1 : 0
                    return p;
                    }

//-------------------------------------Accessor functions---------------------------------

  valueAccessors = [
    { 
      name:"By Count",
     "accessor":function(d){return d.value.count},
     axisFormat : integer_format, 
     titleFormat : title_integer_format,
      
    },
    { 
      name:"By Total Cost",
      "accessor":function(d){return d.value.sumCharges},
      axisFormat : axis_dollar_format, 
      titleFormat : title_dollar_format
    },
    {
      name:"By Mean Cost",
      "accessor":function(d){return d.value.meanCost()},
      axisFormat : axis_dollar_format, 
      titleFormat : title_dollar_format
    },
    { 
      name:"By Total Discounts",
     "accessor":function(d){return d.value.sumDiscount}, 
     axisFormat : axis_dollar_format, 
     titleFormat : title_dollar_format 
    },
    { 
      name:"By Mean Discount",
     "accessor":function(d){return d.value.meanDiscount()}, 
     axisFormat : axis_dollar_format, 
     titleFormat : title_dollar_format 
    },
    { 
      name:"By Number of Objections",
     "accessor":function(d){return d.value.countObjections}, 
     axisFormat : integer_format, 
     titleFormat : title_integer_format 
    },
    {
     name:"By Percentage with Objections",
     "accessor":function(d){return d.value.percentObjections()}, 
     axisFormat : percent_format, 
     titleFormat : percent_format
    },
  ]
  
valueAccessor = function(d){return d.value.count}

//-------------------------------------Load data and dictionaries -----------------------------------------------------------

queue()
    .defer(d3.csv,  "data/consents.csv")
    .defer(d3.csv,  "dictionaries/NMS_authority_dict.csv")
    .defer(d3.csv,  "dictionaries/Region_dict.csv")
    .defer(d3.csv,  "dictionaries/label_dict.csv")
    .defer(d3.csv,  "dictionaries/information_text.csv")
    .defer(d3.json, "gis/council_boundaries.singlepart.simp100.WGS84.geojson")
    .defer(d3.json, "gis/region_boundaries_singlepart_simp_p001.geojson")
    .await(showCharts);

  var raw_column_names = ["Year", "Type of resource consent", "Type of application", "Description of activity(s)", "Class of activity", "Decision", "Appealed", "Deposit charged", "Total charge for applicant", "Amount of discount"];

function showCharts(err, data, auth_dict, region_dict, label_dict, title_text, council_bounds, region_bounds) {
  
  _.forEach(data, function(d,i){d.ID=i})
  
  original_data = JSON.parse(JSON.stringify(data))
  
  var councilNames = [];
  
  for (i in auth_dict) {
    entry = auth_dict[i]
    trimAll(entry)
    name = entry.Name
    councilNames.push(name);
    _auth_dict[entry.Name]=entry;
  } 

    for (i in region_dict) {
    entry = region_dict[i]
    trimAll(entry)
    name = entry.Map_region
    _region_dict[name]=entry;
  }
  
 for (i in label_dict) {
    entry = label_dict[i]
    trimAll(entry)
    name = entry.Label
    _label_dict[name]=entry;
  }
  
  for (i in title_text){
      if(title_text[i].filename == "consents (1.5)"){
        entry = title_text[i]
        trimAll(entry)
        name = entry.id
        _title_text[name]=entry;
      } 
  }
  
  for (i in data) {
    data[i] = cleanup(data[i]);
  }
  _data = data;
  _council_bounds = council_bounds;
  _region_bounds = region_bounds;    

//---------------------------------some d3 for title texts-----------------------------------    
  apply_text(_title_text)
  make_tabs()

//-------------------------------------------FILTERS-----------------------------------------------
  ndx = crossfilter(_data);
  
  dc.dataCount(".dc-data-count")
    .dimension(ndx)
    .group(ndx.groupAll());  
  
  
  // this next section is so we can fetch the RAW data which corresponds to the current filters for downloading.
  all_records = ndx.dimension(_.identity)
  these_records = function(){
      return _.map(all_records.top(_data.length), function(d){var x = original_data[d.ID]; delete x.ID; return x})
  }
  
//-----------------------------------1.5 NUMBER of CONSENTS ------------------------------------------------- 
     
  RC_type = ndx.dimension(function(d) { return d["Type of resource consent"]});
  RC_type_group = RC_type.group().reduce(Add,Remove,Init);
 
  RC_type_chart = dc.rowChart('#RC_type')
    .dimension(RC_type)
    .group(RC_type_group)
    .valueAccessor(valueAccessor)
    .transitionDuration(200)
    .height(small_chart_height)
    .colors(default_colors)
    .elasticX(true)
    .ordering(function(d) {return -d.value})
    //.cap(10)
    .label(function(d){return _label_dict[d.key] ? _label_dict[d.key].Abbreviation : d.key})

  RC_type_chart.xAxis().ticks(4).tickFormat(integer_format);
  RC_type_chart.on('pretransition.dim', dim_zero_rows)

  Notification_Type = ndx.dimension(function(d) { return d["Notification Decision"]});
  Notification_Type_group = Notification_Type.group().reduce(Add,Remove,Init)
  
  Notification_Type_chart = dc.rowChart('#Notification_Type')
    .dimension(Notification_Type)
    .group(Notification_Type_group)
    .valueAccessor(valueAccessor)
    .transitionDuration(200)
    .height(small_chart_height)
    .colors(default_colors)
    .elasticX(true)
    .ordering(function(d) {return -d.value})
    //.cap(10)
    .label(function(d){return _label_dict[d.key] ? _label_dict[d.key].Abbreviation : d.key})

  
  Notification_Type_chart.xAxis().ticks(4).tickFormat(integer_format);
  Notification_Type_chart.on('pretransition.dim', dim_zero_rows)
  
  Council_Type = ndx.dimension(function(d) { return d.council_type});
  Council_Type_group = Council_Type.group().reduce(Add,Remove,Init);
  
  Council_Type_chart = dc.rowChart('#Council_Type')
    .dimension(Council_Type)
    .group(Council_Type_group)
    .valueAccessor(valueAccessor)
    .transitionDuration(200)
    .height(100)
    .colors(default_colors)
    .elasticX(true)
    .ordering(function(d) {return -d.value})
    .label(function(d){return _label_dict[d.key] ? _label_dict[d.key].Abbreviation : d.key})

 
  Council_Type_chart.xAxis().ticks(4).tickFormat(integer_format);
  Council_Type_chart.on('pretransition.dim', dim_zero_rows)
  
  
  Activity_Class = ndx.dimension(function(d) { return d["Class of activity"]});
  Activity_Class_group = Activity_Class.group().reduce(Add,Remove,Init)
  
  Activity_Class_chart = dc.rowChart('#Activity_Class')
    .dimension(Activity_Class)
    .group(Activity_Class_group)
    .valueAccessor(valueAccessor)
    .transitionDuration(200)
    .height(small_chart_height)
    .colors(default_colors)
    .elasticX(true)
    .ordering(function(d) {return -d.value})
    .label(function(d){return _label_dict[d.key] ? _label_dict[d.key].Abbreviation : d.key})
 
  Activity_Class_chart.xAxis().ticks(4).tickFormat(integer_format);
  Activity_Class_chart.on('pretransition.dim', dim_zero_rows)
  
  Decision = ndx.dimension(function(d) { return d["Decision"]});
  Decision_group = Decision.group().reduce(Add,Remove,Init);
  
  Decision_chart = dc.rowChart('#Decision')
    .dimension(Decision)
    .group(Decision_group)
    .valueAccessor(valueAccessor)
    .transitionDuration(200)
    .height(small_chart_height)
    .colors(default_colors)
    .elasticX(true)
    .ordering(function(d) {return -d.value})
    .label(function(d){return _label_dict[d.key] ? _label_dict[d.key].Abbreviation : d.key})
 
  Decision_chart.xAxis().ticks(4).tickFormat(integer_format);
  Decision_chart.on('pretransition.dim', dim_zero_rows)
  
  Decision_maker = ndx.dimension(function(d) { return d["Decision-maker"]});
  Decision_maker_group = Decision_maker.group().reduce(Add,Remove,Init)
  
  Decision_maker_chart = dc.rowChart('#Decision_maker')
    .dimension(Decision_maker)
    .group(Decision_maker_group)
    .valueAccessor(valueAccessor)
    .transitionDuration(200)
    .height(280)
    .colors(default_colors)
    .elasticX(true)
    .ordering(function(d) {return -d.value})
    .label(function(d){return _label_dict[d.key] ? _label_dict[d.key].Abbreviation : d.key})
 
  Decision_maker_chart.xAxis().ticks(4).tickFormat(integer_format);
  Decision_maker_chart.on('pretransition.dim', dim_zero_rows);
  
  Application_type = ndx.dimension(function(d) { return d["Type of application"]});
  Application_type_group = Application_type.group().reduce(Add,Remove,Init)
  
  Application_type_chart = dc.rowChart('#Application_type')
    .dimension(Application_type)
    .group(Application_type_group)
    .valueAccessor(valueAccessor)
    .transitionDuration(200)
    .height(100)
    .colors(default_colors)
    .elasticX(true)
    .ordering(function(d) {return -d.value})
    .label(function(d){return _label_dict[titleCase(d.key)] ? _label_dict[d.key].Abbreviation : d.key})
 
  Application_type_chart.xAxis().ticks(4).tickFormat(integer_format);
  Application_type_chart.on('pretransition.dim', dim_zero_rows);
  
  time_taken = ndx.dimension(function(d) {return d.days_bin});
  time_taken_group =  time_taken.group().reduceCount();
  
  time_taken_chart = dc.barChart('#time_taken')
    .dimension(time_taken)
    .group(time_taken_group)
    .height(small_chart_height)
    .colors(default_colors)
    .elasticX(false)
    .elasticY(true)
    .x(d3.scale.linear().domain([0,time_taken.top(1)[0].days_bin+days_binsize]))
    .xUnits(dc.units.fp.precision(days_binsize))
    .centerBar(false)
    .renderHorizontalGridLines(true)
    .renderVerticalGridLines(true)
    .transitionDuration(200)
  
  time_taken_chart.yAxis().ticks(4).tickFormat(integer_format);
  
 cost = ndx.dimension(function(d) {return d.cost_bin});
 cost_group =  cost.group().reduceCount();
  
  cost_chart = dc.barChart('#cost')
    .dimension(cost)
    .group(cost_group)
    .height(small_chart_height)
    .colors(default_colors)
    .elasticX(false)
    .elasticY(true)
    .x(d3.scale.linear().domain([0,cost.top(1)[0].cost_bin+cost_binsize]))
    .xUnits(dc.units.fp.precision(cost_binsize))
    .centerBar(false)
    .renderHorizontalGridLines(true)
    .renderVerticalGridLines(true)
    .transitionDuration(200)
  
  cost_chart.yAxis().ticks(4).tickFormat(integer_format);
  cost_chart.xAxis().tickFormat(axis_dollar_format);
  
  discount = ndx.dimension(function(d){return d.hasDiscount});
  discount_group = discount.group().reduceCount() 
  
//  discount_chart = dc.pieChart('#has_discount')
//    .dimension(discount)
//    .group(discount_group)
//    .innerRadius(donut_inner)
//    .radius(donut_outer)
//    .transitionDuration(200)
//    .height(donut_height)
//    .colors(default_colors) 
  
discount_chart = dc.rowChart('#has_discount')
    .dimension(discount)
    .group(discount_group)
    .valueAccessor(function(d){return 1})
    .height(small_chart_height/2)
    .width(150)
    .colors(default_colors)
    .title(function(d){return d.key+": "+title_integer_format(d.value)})

discount_chart.xAxis().ticks(0).tickFormat(function(){return ""})
     
  
  objection = ndx.dimension(function(d){return d.hasObjection});
  objection_group = objection.group().reduceCount()
  
  objection_chart = dc.rowChart('#has_objection')
    .dimension(objection)
    .group(objection_group)
    .valueAccessor(function(d){return 1})
    .height(small_chart_height/2)
    .width(150)
    .colors(default_colors)
    .title(function(d){return d.key+": "+title_integer_format(d.value)})

objection_chart.xAxis().ticks(0).tickFormat(function(){return ""})
  
  appeal = ndx.dimension(function(d){return d.hasAppeal});
  appeal_group = appeal.group().reduceCount()
  
appeal_chart = dc.rowChart('#has_appeal')
    .dimension(appeal)
    .group(appeal_group)
    .valueAccessor(function(d){return 1})
    .height(small_chart_height/2)
    .width(150)
    .colors(default_colors)
    .title(function(d){return d.key+": "+title_integer_format(d.value)})

 appeal_chart.xAxis().ticks(0).tickFormat(function(){return ""})
 
  hasCost = ndx.dimension(function(d){return d.hasCost});
  hasCost_group = hasCost.group().reduceCount()
  
  hasCost_chart = dc.rowChart('#has_cost')
    .dimension(hasCost)
    .group(hasCost_group)
    .valueAccessor(function(d){return 1})
    .height(small_chart_height/2)
    .width(150)
    .colors(default_colors)
    .title(function(d){return d.key+": "+title_integer_format(d.value)})

  hasCost_chart.xAxis().ticks(0).tickFormat(function(){return ""})
//  
//---------------------------------Map functions

  function zoomed() {
    projection
    .translate(d3.event.translate)
    .scale(d3.event.scale);
    var hidden = projection.scale() == 1600 && JSON.stringify(projection.translate()) == JSON.stringify([220,320]);
    d3.select('#resetPosition').classed('hidden',function(){return hidden})
    district_map.render();
    region_map.render();
    }
  
  zoom = d3.behavior.zoom()
    .translate(projection.translate())
    .scale(projection.scale())
    .scaleExtent([1600, 20000])
    .on("zoom", zoomed);

  consents = ndx.dimension(function(d) { return d["Council"]});
  consents_group = generateCompleteGroup(consents.group().reduce(Add,Remove,Init), councilNames, Init(true))
  
//---------------------------------Map 1 districts 
  d3.select("#district_map").call(zoom);

  function colourRenderlet(chart) {
    ext = d3.extent(district_map.data(), district_map.valueAccessor());
    ext[0]=0.0001;
    district_map.colorDomain(ext);
    }  
  
district_map = dc.geoChoroplethChart("#district_map")
      .dimension(consents)
      .group(consents_group)
      .valueAccessor(valueAccessor)
      .projection(projection)
      .colorAccessor(function(d){return d + 1})
      .colorCalculator(function(d){return !d ? map_zero_colour : colourscale(d)})
      .transitionDuration(200)
      .height(600)
      .overlayGeoJson(_council_bounds.features, 'council', function(d) {return d.properties.TA2013_NAM})
      .colors(colourscale)
      .title(function(d) {return !d.value ? d.key + ": 0" : d.key + ": " + title_integer_format(d.value)})
      .on("preRender.color", colourRenderlet)
      .on("preRedraw.color", colourRenderlet)
  
//---------------------------------Map 2 Regions
  
  d3.select("#region_map").call(zoom);

  function colourRenderlet(chart) {
    ext = d3.extent(region_map.data(), region_map.valueAccessor());
    ext[0]=0.0001;
    region_map.colorDomain(ext);
  }

  region_map = dc.geoChoroplethChart("#region_map")
      .dimension(consents)
      .group(consents_group)
      .valueAccessor(valueAccessor)
      .projection(projection)
      .colorAccessor(function(d){return d + 1})
      .colorCalculator(function(d){return !d ? map_zero_colour : colourscale(d)})
      .transitionDuration(200)
      .height(600)
      .overlayGeoJson(_region_bounds.features, 'region', function(d) {return _region_dict[d.properties.REGC2013_N].council_name})
      .colors(colourscale)
      .title(function(d) {return !d.value ? d.key + ": 0" : d.key + ": " + title_integer_format(d.value)})
      .on("preRender.color", colourRenderlet)
      .on("preRedraw.color", colourRenderlet)
    
  //--------------------------------paired chart
  
  var council_charts = generateSplitRowChart(consents, consents_group, "#pair_chart1", "#pair_chart2", "#legend_reset", function(d) { return d < 'O'},valueAccessor);
  
  resetReviews = mergeFilters([council_charts.chart1, council_charts.chart2, region_map, district_map],"#LegendReset").reset;

  council_charts.chart1.xAxis().ticks(4).tickFormat(integer_format)
  council_charts.chart2.xAxis().ticks(4).tickFormat(integer_format)  

  council_charts.chart1.title(function(d){return d.key + ': '+title_integer_format(valueAccessor)})
  council_charts.chart2.title(function(d){return d.key + ': '+title_integer_format(valueAccessor)})  
  
  
  width = Math.max(region_map.width(), district_map.width());
  region_map.width(width);
  district_map.width(width);
  council_charts.chart1.width(width/2);
  council_charts.chart2.width(width/2);

  charts = dc.chartRegistry.list();
  
  changeAccessorsTo = function changeAccessorsTo(accessor, el) {
    //console.log("changing to " + accessor.name);
    d3.select("#accessors").selectAll(".accessor")
      .classed("active",false);
    valueAccessor = accessor.accessor;
    
    for (chartId in charts) {
      var chart = charts[chartId];
      if (["#time_taken", //list of chart anchors for which the specified valueaccessor does not make sense
          '#cost',
          '#has_objection',
          '#has_appeal',
          '#has_discount',
          '#has_cost'].indexOf(chart.anchor()) > -1) {
        continue;
      }
      
      chart.valueAccessor(accessor.accessor)
      chart.title(function(d){return typeof(d.value) == "object" ? d.key + ': '+accessor.titleFormat(valueAccessor(d)) : d.key + ': '+accessor.titleFormat(d.value)
        })
      if (chart.xAxis){chart.xAxis().ticks(4).tickFormat(accessor.axisFormat)}
    }
    council_charts.changeValueAccessor(valueAccessor);
    d3.select(el.parentNode).classed("active",true);
    dc.redrawAll();
  }

  d3.select("#accessors")
          .selectAll(".accessor").data(valueAccessors)
          .enter()
            .append("li").attr("role","presentation").attr("class","accessor")
              .append("a").attr("href","#")
                .text(function(d){ return d.name})
                .on("click", function (d){changeAccessorsTo(d,this)})
        
  
  d3.selectAll(".inactive_at_start").classed("active", false);
  
  var councils = ndx.dimension(function(d) { return d["Council"]});
  
  var table_chart = dc.dataTable("#table")
     .dimension(councils)
     .group(function (d) {
      return d.Council;
     })
    .columns([
      {label:"Year",format: function (d) {return d['Year']}},
       {label:"Type of Consent",format: function (d) {return d['Type of resource consent']}},
       {label:"Type of Application",format: function (d) {return d['Type of application']}},
       {label:"Description of activity(s)",format: function (d) {return d['Description of activity(s)']}},
       {label:"Class",format: function (d) {return d['Class of activity']}},
       {label:"Decision",format: function (d) {return d['Decision']}},
       {label:"Appealed",format: function (d) {return d['Appealed']}},
       {label:"Total Charge",format: function (d) {return title_dollar_format(d['Total charge for applicant'])}},
       {label:"Deposit",format: function (d) {return title_dollar_format(d['Deposit charged'])}},
       {label:"Discount",format: function (d) {return title_dollar_format(d['Amount of discount'])}}
    ])
  
  council_charts.chart1.on("pretransition", grey_undefined)
  council_charts.chart2.on("pretransition", grey_undefined)
  
  dc.renderAll();
  
  changeAccessorsTo(valueAccessors[0], d3.select("li a")[0][0]);
  
}
