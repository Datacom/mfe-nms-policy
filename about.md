---
layout: page
title: About
permalink: /about/
---

This is the base Jekyll theme. You can find out more info about customizing your Jekyll theme, as well as basic Jekyll usage documentation at [jekyllrb.com](http://jekyllrb.com/)

You can find the source code for the Jekyll new theme at: [github.com/jglovier/jekyll-new](https://github.com/jglovier/jekyll-new)

You can find the source code for Jekyll at [github.com/jekyll/jekyll](https://github.com/jekyll/jekyll)



  
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
       {label:"Deposit",format: function (d) {return d['Deposit charged']}},
       {label:"Total Charge",format: function (d) {return title_dollar_format(d['Total charge for applicant'])}},
       {label:"Discount",format: function (d) {return title_dollar_format(d['Amount of discount'])}}
    ])
  dc.renderAll();
  

  