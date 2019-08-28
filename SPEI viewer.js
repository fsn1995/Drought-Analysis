////////////////////////////////////////////////////////////////////////////
//                              SPEI viewer                               //
// This script computes the differences of the annual average SPEI.       //
// Positive SPEI values are masked as it focuses on the drought period.   //
// The difference maps show the annual difference of drought. Each layer  //
// represents the difference between the annual average SPEI in that year //
// and the previous years.                                                //
//------------------------------------------------------------------------//
// Optionally, one may export the annual difference maps to Goole drive.  //
// You can also define a point/region of interest by uploading a shapefile//
// or draw it by hand in GEE. The monthly evolution of SPEI will be displ //
// -ayed. Just like SPEI vs NDVI time series analysis                     //
////////////////////////////////////////////////////////////////////////////

//-------------------------------Preparation------------------------------//
// study time range
var year_start = 2001; //  MODIS NDVI 2000-02-18T00:00:00 - Present
var year_end = 2018;
var month_start = 1;
var month_end = 12;

var date_start = ee.Date.fromYMD(year_start, 1, 1);
var date_end = ee.Date.fromYMD(year_end, 12, 31);
var years = ee.List.sequence(year_start, year_end);// time range of years

// define your study area and name it as roi. e.g. draw it by hand tool


// var months = ee.List.sequence(month_start, month_end);// time range of months
// change the month lag here, e.g. no lag is 0,-1 is one month lag,-2 is 2 month lag
var lagflag = 0; 

var spei1m = ee.ImageCollection("users/fsn1995/spei1m_noah");
var spei2m = ee.ImageCollection("users/fsn1995/spei2m_noah");
var spei3m = ee.ImageCollection("users/fsn1995/spei3m_noah");
var spei4m = ee.ImageCollection("users/fsn1995/spei4m_noah");
var spei5m = ee.ImageCollection("users/fsn1995/spei5m_noah");
var spei6m = ee.ImageCollection("users/fsn1995/spei6m_noah");
var spei7m = ee.ImageCollection("users/fsn1995/spei7m_noah");
var spei8m = ee.ImageCollection("users/fsn1995/spei8m_noah");
var spei9m = ee.ImageCollection("users/fsn1995/spei9m_noah");
var spei10m = ee.ImageCollection("users/fsn1995/spei10m_noah");
var spei11m = ee.ImageCollection("users/fsn1995/spei11m_noah");
var spei12m = ee.ImageCollection("users/fsn1995/spei12m_noah");

// select the time scale of spei here
var spei = spei11m.filterDate(date_start, date_end)
                  .map(function(image) {
                    var speiMask = image.lte(0);
                    return image.updateMask(speiMask);
                }); // mask spei > 0

var ndvi = ee.ImageCollection('MODIS/006/MOD13A2')
    .filterDate(date_start, date_end)
    .select('NDVI');

//-------------------------Trend identification---------------------------//

// kendall's test, P-value disabled by GEE

// var speiTrend = spei.reduce(ee.Reducer.kendallsCorrelation());
// var speiTrendTau = {min: -1, max: 1, palette: ['red','white', 'green']};
// // var speiTrendP = {min: 0, max: 1, palette: ['red','white', 'green']};
// Map.addLayer(speiTrend.select('b1_tau'), speiTrendTau, 'speiTrendTau');
// // Map.addLayer(speiTrend.select('b1_p-value'), speiTrendP, 'speiTrendP');

// var ndviTrend = ndvi.reduce(ee.Reducer.kendallsCorrelation());
// Map.addLayer(ndviTrend.select('NDVI_tau'), speiTrendTau, 'ndviTrendTau');
// // Map.addLayer(ndviTrend.select('NDVI_p-value'), speiTrendP, 'speiTrendP');

// ee.ImageCollection.formaTrend

// var speiTrendTau = {min: -1, max: 1, palette: ['red','white', 'green']};
// var speiTrend = spei.formaTrend();
// Map.addLayer(speiTrend.select('long-trend'), speiTrendTau, 'speiTrend');
// Map.addLayer(speiTrend.select('long-tstat'), speiTrendTau, 'speiTstat');
// var ndviTrend = ndvi.formaTrend();
// Map.addLayer(ndviTrend.select('long-trend'), speiTrendTau, 'ndviTrend');
// Map.addLayer(ndviTrend.select('long-tstat'), speiTrendTau, 'ndviTstat');

// linear trend

var speiLinear = spei.map(function(image) {
    return image.addBands(image.metadata('system:time_start').divide(1e18));
    // Scale milliseconds by a large constant to avoid very small slopes
    // in the linear regression output. code from GEE guides
});

var speiLinear = speiLinear.select(['system:time_start', 'b1']).reduce(
  ee.Reducer.linearFit());

Export.image.toDrive({
  image: speiLinear.select('scale'),
  folder: 'speiDiff',
  description: 'speiLinearScale',
  scale: 10000,
//   region: roi // If not specified, the region defaults to the viewport at the time of invocation
});

Export.image.toDrive({
  image: speiLinear.select('offset'),
  folder: 'speiDiff',
  description: 'speiLinearOffset',
  scale: 10000,
//   region: roi // If not specified, the region defaults to the viewport at the time of invocation
});

Map.addLayer(speiLinear,
  {min: 0, max: [-0.9, 8e-5, 1], bands: ['scale', 'offset', 'scale']}, 'fit');

// annual spei
var speiYear = ee.ImageCollection.fromImages(
    years.map(function (y) {
        var indice = spei.select('b1')
                         .filter(ee.Filter.calendarRange(y, y, 'year'))
                         .mean()
                         .rename('speiy');
        return indice.set('year', y)
                     .set('system:time_start', ee.Date.fromYMD(y, 1, 1));
    }).flatten()
);

var speiYear1 = ee.ImageCollection.fromImages(
  years.map(function (y) {
      var indice = spei.select('b1')
                       .filter(ee.Filter.calendarRange(y, y, 'year'))
                       .mean()
                       .rename('speiy1');
      return indice.set('year', y)
                   .set('system:time_start', ee.Date.fromYMD(y, 1, 1));
  }).flatten()
);

var addLag1y = function(image) {
  var lagy = ee.Date(image.get('system:time_start')).advance(-1,'year');
  return image.set({'lagy': lagy});
};
var addLag0y = function(image) {
  var lagy = ee.Date(image.get('system:time_start')).advance(0,'year');
  return image.set({'lagy': lagy});
};

var spei0 = speiYear.select('speiy').map(addLag0y);
var spei1 = speiYear1.select('speiy1').map(addLag1y);
// print(spei0);
// print(spei1);

var lagFilter = ee.Filter.equals({
  leftField: 'lagy',
  rightField: 'lagy',
});
var lagLink = ee.Join.saveFirst({
  matchKey: 'match',
});

var speiAll = ee.ImageCollection(lagLink.apply(spei0.select('speiy'),
        spei1.select('speiy1'),lagFilter))
        .map(function(image) {
          return image.addBands(image.get('match'));
        });
        
// Map.addLayer(speiAll.select('speiy').filterDate('2017-01-01'));
print(speiAll);
// spei differences
var speiDiff = speiAll.map(function(image) {
  return image.addBands(
    image.expression('a1 - b1', {
      a1: image.select('speiy1'),
      b1: image.select('speiy')
    }).rename('speiDiff'));
});

// var mapPara = {min: -1, max: 1, palette: ['red','white', 'green']};
// Map.addLayer(speiDiff, mapPara);

// // experiment with linear fit

// var spei = spei.map(function(image) {
//     return image.addBands(image.metadata('system:time_start').divide(1e18));
//     // Scale milliseconds by a large constant to avoid very small slopes
//     // in the linear regression output. code from GEE guides
// });

var mapPara = {min: -1, max: 1, palette: ['red','white', 'green']};
// Map.addLayer(speiDiff.select('speiDiff').filterDate('2001-01-01'), mapPara, '2001');
Map.addLayer(speiDiff.select('speiDiff').filterDate('2002-01-01'), mapPara, '2002');
Map.addLayer(speiDiff.select('speiDiff').filterDate('2003-01-01'), mapPara, '2003');
Map.addLayer(speiDiff.select('speiDiff').filterDate('2004-01-01'), mapPara, '2004');
Map.addLayer(speiDiff.select('speiDiff').filterDate('2005-01-01'), mapPara, '2005');
Map.addLayer(speiDiff.select('speiDiff').filterDate('2006-01-01'), mapPara, '2006');
Map.addLayer(speiDiff.select('speiDiff').filterDate('2007-01-01'), mapPara, '2007');
Map.addLayer(speiDiff.select('speiDiff').filterDate('2008-01-01'), mapPara, '2008');
Map.addLayer(speiDiff.select('speiDiff').filterDate('2009-01-01'), mapPara, '2009');
Map.addLayer(speiDiff.select('speiDiff').filterDate('2010-01-01'), mapPara, '2010');
Map.addLayer(speiDiff.select('speiDiff').filterDate('2011-01-01'), mapPara, '2011');
Map.addLayer(speiDiff.select('speiDiff').filterDate('2012-01-01'), mapPara, '2012');
Map.addLayer(speiDiff.select('speiDiff').filterDate('2013-01-01'), mapPara, '2013');
Map.addLayer(speiDiff.select('speiDiff').filterDate('2014-01-01'), mapPara, '2014');
Map.addLayer(speiDiff.select('speiDiff').filterDate('2015-01-01'), mapPara, '2015');
Map.addLayer(speiDiff.select('speiDiff').filterDate('2016-01-01'), mapPara, '2016');
Map.addLayer(speiDiff.select('speiDiff').filterDate('2017-01-01'), mapPara, '2017');
Map.addLayer(speiDiff.select('speiDiff').filterDate('2018-01-01'), mapPara, '2018');

//------------------------------------------------------------------------//
// uncomment the following lines for optional experiment                  //
//------------------------------------------------------------------------//

// Export.image.toDrive({
//   image: speiDiff.select('speiDiff'),
//   folder: 'speiDiff',
//   description: 'Differences of annual SPEI',
//   scale: 10000,
// //   region: roi // If not specified, the region defaults to the viewport at the time of invocation
// });
// print(ui.Chart.image.seriesByRegion(spei.select('b1'), roi, ee.Reducer.mean(), 'Montly SPEI', 1000));