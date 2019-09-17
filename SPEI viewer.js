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
var geometry = /* color: #d63000 */ee.Geometry.MultiPoint(
  [[-120.04598637852064, 36.447665173620244],//California
   [-99.39168950352064, 32.980880455676854], //Texas
   [-41.521726852388724, -10.87755592386568],//Brazil
   [21.87462563721556, -23.646207259859224], //Southern Africa
   [120.66368813721556, -31.729729863475043],//Australia1
   [125.05821938721556, -25.5639224731522],  //Australia2
   [148.08556313721556, -25.5639224731522],  //Australia3
   [-7.587965499171105, 38.51236079666947],  //Portugal
   [-4.072340499171105, 37.89075584438553],  //Spain
   [15.087815750828895, 57.84360752733928],  //Sweden
   [24.931565750828895, 61.22692304603273],  //Finland
   [77.1762313117191, 16.351044772181],      //India
   [116.1996688117191, 37.90027047802768]]); //Northern China

var roiPoints = geometry.buffer(9000);
//-------------------------------------------------------------------------//
// LUCC: This part will import and display the lucc info                   //
//-------------------------------------------------------------------------//
var worldmap = ee.FeatureCollection('ft:1tdSwUL7MVpOauSgRzqVTOwdfy17KDbw-1d9omPw');//world vector
var roiWorld = worldmap.geometry();

var lucc = ee.Image('ESA/GLOBCOVER_L4_200901_200912_V2_3').select('landcover');
// var lucc = ee.Image('USGS/NLCD/NLCD2011').select('landcover').clip(roi);
Map.addLayer(lucc, {}, 'Landcover');
var lucc_pixelArea = ee.Image.pixelArea().addBands(lucc);
var lucc_group = lucc_pixelArea.reduceRegion({
    reducer: ee.Reducer.sum().group({
        groupField: 1,
        groupName: 'landcover_class_value'
    }),
    geometry: roiWorld,
    scale: 300,// meters
    bestEffort: true,
});
// print('reduction_results', lucc_group);

var lucc_names = ee.Dictionary.fromLists(
    ee.List(lucc.get('landcover_class_values')).map(ee.String),
    lucc.get('landcover_class_names')
);
print('lucc_names',lucc_names);
var lucc_palette = ee.Dictionary.fromLists(
    ee.List(lucc.get('landcover_class_values')).map(ee.String),
    lucc.get('landcover_class_palette')
);
// Chart functions
function createFeature(roi_class_stats) {
    roi_class_stats = ee.Dictionary(roi_class_stats);
    var class_number = roi_class_stats.get('landcover_class_value');
    var result = {
        lucc_class_number: class_number,
        lucc_class_name: lucc_names.get(class_number),
        lucc_class_palette: lucc_palette.get(class_number),
        area_m2: roi_class_stats.get('sum')
    };
    return ee.Feature(null, result);
}
function createPieChartSliceDictionary(perc) {
    return ee.List(perc.aggregate_array("lucc_class_palette"))
             .map(function(p) { return {'color': p}; }).getInfo();
}
// pie chart of lucc summary
var roi_stats = ee.List(lucc_group.get('groups'));
var lucc_Pie = ee.FeatureCollection(roi_stats.map(createFeature));
var lucc_Piechart = ui.Chart.feature.byFeature({
    features: lucc_Pie,
    xProperty: 'lucc_class_name',
    yProperties: ['area_m2', 'lucc_class_number']
})
.setChartType('PieChart')
.setOptions({
    title: 'Land Cover Summary Chart',
    slices: createPieChartSliceDictionary(lucc_Pie),
    sliceVisibilityThreshold: 0
});
print('LUCC percentage', lucc_Piechart);


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