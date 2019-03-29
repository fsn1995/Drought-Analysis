////////////////////////////////////////////////////////////////////////////
// This script will compute the monthly NDVI from Landsat imagery and     //
// correlate with SPEI calculated from NOAH Global Land Assimulation      //
// System data. It will display and export the correlation map of SPEI vs //
// three months sum of NDVI anomalies. (spearson/pearson's correlation)   //
//------------------------------------------------------------------------//
// This is part of a group work about drought analysis by MSc students in //
// Department of Earth Sciences, Uppsala University:                      //
// de Mendonça Fileni, Felipe; Erikson, Torbjörn-Johannes; Feng, Shunan   //                                                                         //
// Supervisor: Pettersson, Rickard; Winterdahl, Mattias                   //
// Contact: Shunan Feng (冯树楠): fsn.1995@gmail.com                      //
////////////////////////////////////////////////////////////////////////////

// NOTE
// The correlation map can be displayed for the period of 1984-2004 in console
// Longer period must be exported through task, (normally will take 1 hour for 
// 40-year calculation 

// note to myself:
// lucc class name on correlation chart needs to be corrected
// lucc class should be simplified
// SPEI could be uploaded once it is done and correlate it with NDVI 
// Time lag and month gaps of ndvi

//------------------------------------------------------------------------//
//                             Preparation                                //
//------------------------------------------------------------------------//


// var worldmap = ee.FeatureCollection('ft:1tdSwUL7MVpOauSgRzqVTOwdfy17KDbw-1d9omPw');//world vector
var usstate = ee.FeatureCollection('ft:1fRY18cjsHzDgGiJiS2nnpUU3v9JPDc2HNaR7Xk8');//us state vector
// var worldmap = ee.FeatureCollection('USDOS/LSIB_SIMPLE/2017'); //not political right, 
// var country = ['Spain'];//CHANGE the NAME of country here!
var state = ['California'];//CHANGE the NAME of us state here!

// var countryshape = worldmap.filter(ee.Filter.inList('Country', country));// country 
var stateshape = usstate.filter(ee.Filter.inList('Name', state));// us state
// var roi = countryshape.geometry();// country 
var roi = stateshape.geometry();// us state
var roiLayer = ui.Map.Layer(roi, {color: 'FF0000'}, 'roi');
// var roiCentroid = roi.centroid();
Map.layers().add(roiLayer);//display roi
// Map.setCenter(roiCentroid);

// study time range
var year_start = 1984;
var year_end = 2018;
// month range of ndvi anomalies (May to July)
var month_start = 5;
var month_end = 7;
var speim = 4;// month of spei 

var date_start = ee.Date.fromYMD(year_start, 1, 1);
var date_end = ee.Date.fromYMD(year_end, 12, 31);
var years = ee.List.sequence(year_start, year_end);// time range of years
var months = ee.List.sequence(month_start, month_end);// time range of months
// next step is to define the months of ndvi anomal calculation
// var month_anomaly = ee.List.sequence(3,5);// March to May
// var month_upper = 8;// May to July
// var month_lower = 4;

//------------------------------------------------------------------------//
//                                 NDVI                                   //
//------------------------------------------------------------------------//

// load landsat image
var surfaceReflectance4 = ee.ImageCollection('LANDSAT/LT04/C01/T1_SR')
    .filterDate(date_start, date_end)
    .filterBounds(roi);
var surfaceReflectance5 = ee.ImageCollection('LANDSAT/LT05/C01/T1_SR')
    .filterDate(date_start, date_end)
    .filterBounds(roi);
var surfaceReflectance7 = ee.ImageCollection('LANDSAT/LE07/C01/T1_SR')
    .filterDate(date_start, date_end)
    .filterBounds(roi);   
var surfaceReflectance8 = ee.ImageCollection('LANDSAT/LC08/C01/T1_SR')
    .filterDate(date_start, date_end)
    .filterBounds(roi);
var surfaceReflectance457 = surfaceReflectance4.merge(surfaceReflectance5).merge(surfaceReflectance7);
// var spei = ee.ImageCollection("users/felipef93/SPEI_CAL").filterBounds(roi);
var spei = ee.ImageCollection("users/felipef93/SPEI_CAL_3m").filterBounds(roi);

// // cloud/snow/water mask
// pixel_qa contains fmask information: 
// bit 0: fill, bit 1: clear, bit 2: water, 
// bit 3: cloud shadow, bit 4: snow/ice bit 5: cloud
// fmask for surfaceReflectance8
var fmaskL8sr = function(image) {
    var cloudShadowBitmask = 1 << 3;
    var cloudsBitMask = 1 << 5;
    var waterBitmask = 1 << 2;
    var snowBitmask = 1 << 4;
    // QA band pixel value
    var qa = image.select('pixel_qa');
    // set cloud and shadows to 0
    var mask = qa.bitwiseAnd(cloudShadowBitmask).eq(0)
        .and(qa.bitwiseAnd(cloudsBitMask).eq(0))
        .and(qa.bitwiseAnd(waterBitmask).eq(0))
        .and(qa.bitwiseAnd(snowBitmask).eq(0));
    return image.updateMask(mask);
};
// fmask for surfaceRflectance457
var fmaskL457 = function(image) {
    var qa = image.select('pixel_qa');
    // If the cloud bit (5) is set and the cloud confidence (7) is high
    // or the cloud shadow bit is set (3), then it's a bad pixel. (GEE example)
    var maskband = qa.bitwiseAnd(1 << 5)
            .and(qa.bitwiseAnd(1 << 7))
            .or(qa.bitwiseAnd(1 << 3))
            .and(qa.bitwiseAnd(1 << 2))
            .and(qa.bitwiseAnd(1 << 4));
    // Remove edge pixels that don't occur in all bands
    var mask2 = image.mask().reduce(ee.Reducer.min());
    return image.updateMask(maskband.not()).updateMask(mask2);
};

// NDVI computation [-1 1]
var addNDVI457 = function(image) {
    var ndvi457 = image.normalizedDifference(['B4', 'B3']).rename('NDVI');
    return image.addBands(ndvi457);
};
var addNDVI8 = function(image) {
    var ndvi8 = image.normalizedDifference(['B5', 'B4']).rename('NDVI');
    return image.addBands(ndvi8);
};

// add cloud masked ndvi band

var L8ndvi = surfaceReflectance8
    .filter(ee.Filter.calendarRange(month_start, month_end, 'month'))
    .map(fmaskL8sr)
    .map(addNDVI8);

var L457ndvi = surfaceReflectance457
    .filter(ee.Filter.calendarRange(month_start, month_end, 'month'))
    .map(fmaskL457)
    .map(addNDVI457);

// merge L8 L457 NDVI
var landsatndvi = L8ndvi.merge(L457ndvi);
// var NDVI = landsatndvi.filterDate(date_start, date_end)
//                       .sort('system:time_start', false)
//                       .select('NDVI');


// monthly average NDVI
// sytstem time is set as 1st of each month
var NDVI_monthlyave = ee.ImageCollection.fromImages(
    years.map(function (y) {
        return months.map(function(m) {
            var vi = landsatndvi.select('NDVI')
                                .filter(ee.Filter.calendarRange(y, y, 'year'))
                                .filter(ee.Filter.calendarRange(m, m, 'month'))
                                .mean()
                                .rename('NDVIm');
            return vi.set('year', y)
                     .set('month', m)
                     .set('system:time_start', ee.Date.fromYMD(y, m, 1));
        });
    }).flatten()
);

// 30yr monthly average NDVI
var NDVI_30yrave = ee.ImageCollection.fromImages(
    months.map(function (m) {
        var vi = NDVI_monthlyave.filter(ee.Filter.eq('month', m))
                                .mean()
                                .rename('NDVIy');
        return vi.set('month', m);
    }).flatten()
);
// print(NDVI_30yrave);

// NDVI anomaly = monthly average NDVI - 30yr monthly average NDVI 
// NDVI monthly anomaly
var monthfilter = ee.Filter.equals({
    leftField: 'month',
    rightField: 'month',
});
var monthlink = ee.Join.saveFirst({
    matchKey: 'match',
});

var NDVI_monthlink = ee.ImageCollection(monthlink.apply(NDVI_monthlyave,NDVI_30yrave,monthfilter))
    .map(function(image) {
        return image.addBands(image.get('match'));
    });

// var date_all = NDVI_monthlink.map(function(image) {
//     return image.set('date', image.date());
// });
// print(date_all);
// var datelist = date_all.aggregate_array('date');
// print(datelist);

// var NDVIfiltered = NDVI_monthlink.filterMetadata('month','less_than',month_upper)
//                                  .filterMetadata('month','greater_than',month_lower);

// print(NDVIfiltered,'ndvifiltered');
                             
var addNDVI_anomaly = function(image) {
    var anomaly = image.expression(
        'b1-b2',
        {
            b1: image.select('NDVIm'),
            b2: image.select('NDVIy'),
        }
    ).rename('NDVI_anomaly');
    return image.addBands(anomaly);
};
                            
var NDVI_anomaly = NDVI_monthlink.map(addNDVI_anomaly);
// print(NDVI_anomaly);
                            
// three month sum of NDVI_anomaly 
var NDVI_anomaly_sum = ee.ImageCollection.fromImages(
    years.map(function (y) {
        var vi = NDVI_anomaly.select('NDVI_anomaly')
                             .filter(ee.Filter.eq('year', y))
                             .sum()
                             .rename('NDVI_anomaly_sum');
        return vi.set('year', y)
                 .set('month', speim)// here is set as the month of spei (April)
                 .set('system:time_start', ee.Date.fromYMD(y, speim, 1));
    }).flatten()
);

// Map.addLayer(speiSelect.select('spei'), corrParams, 'spei Map');
// print(NDVI_anomaly_sum);

//------------------------------------------------------------------//
// This part compares NDVI anomalies with spei2m computed from NOAH //
// Global land assimulation system                                  //
//------------------------------------------------------------------//

var speiSet = spei.map(function(image) {
    return image.set('date', image.date());
  });
  
// print(speiSet,'speiSet');

var yearfilter = ee.Filter.equals({
    leftField: 'system:time_start',
    rightField: 'date',
});
var yearlink = ee.Join.saveFirst({
    matchKey: 'match',
});

// print(NDVI_anomaly_sum,'ndvi');
// print(spei,'spei');
var NDVI_spei = ee.ImageCollection(yearlink.apply(NDVI_anomaly_sum.select('NDVI_anomaly_sum'),
        speiSet.select('b1'),yearfilter))
        .map(function(image) {
            return image.addBands(image.get('match'));
        });
// print(NDVI_spei,'NDVI_spei');
var corrmap = NDVI_spei.reduce(ee.Reducer.pearsonsCorrelation()).clip(roi);
// var corrmap = NDVI_spei.reduce(ee.Reducer.spearmansCorrelation()).clip(roi);
                    // .addBands(lucc.select('landcover')
                    // .rename('lucc'));
var corrParams = {min: -1, max: 1, palette: ['red','white', 'green']};
Map.addLayer(corrmap.select('correlation'), corrParams, 'Correlation Map');

Export.image.toDrive({
  image: corrmap,
  description: 'Correlation map of monthly NDVI and water balance',
  scale: 1000,
//   region: roi
});
