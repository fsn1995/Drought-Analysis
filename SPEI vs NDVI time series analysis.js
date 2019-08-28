////////////////////////////////////////////////////////////////////////////
// This script aims to compare the time series of SPEI and NDVI in the    //
// identified sensitive regions where vegetation correlated closely with  //
// meteorological drought.                                                //
//------------------------------------------------------------------------//
// This is part of a group work about drought analysis by MSc students in //
// Department of Earth Sciences, Uppsala University:                      //
// de Mendonça Fileni, Felipe; Erikson, Torbjörn-Johannes; Feng, Shunan   //                                                                         //
// Supervisor: Pettersson, Rickard; Winterdahl, Mattias                   //
// Contact: Shunan Feng (冯树楠): fsn.1995@gmail.com                      //
////////////////////////////////////////////////////////////////////////////


//------------------------------------------------------------------------//
//                             Preparation                                //
//------------------------------------------------------------------------//

// import the generated shapefile
var vectormap = ee.FeatureCollection("users/fsn1995/corrmap0305");
var vector = vectormap.geometry();// us state
var vectorLayer = ui.Map.Layer(vector, {color: 'FF0000'}, 'R>0.3&0.5');
Map.layers().add(vectorLayer);//display roi


// define your study area and name it as roi. e.g. draw it by hand tool

var lagflag = 0;

// study time range
var year_start = 2013;
var year_end = 2018;
// month range of ndvi anomalies (May to July)
// var month_start = 5;
// var month_end = 7;
// var speim = 4;// month of spei 
var month_start = 1;
var month_end = 12;

var date_start = ee.Date.fromYMD(year_start, 1, 1);
var date_end = ee.Date.fromYMD(year_end, 12, 31);
var years = ee.List.sequence(year_start, year_end);// time range of years
var months = ee.List.sequence(month_start, month_end);// time range of months
// next step is to define the months of ndvi anomal calculation
// var month_anomaly = ee.List.sequence(3,5);// March to May
// var month_upper = 8;// May to July
// var month_lower = 4;

//------------------------------------------------------------------------//
//                                 SPEI                                   //
//------------------------------------------------------------------------//
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
var spei = spei11m.filterBounds(roi)
                  .filterDate(date_start, date_end)
                  .map(function(image) {
                    var speiMask = image.lte(0);
                    return image.updateMask(speiMask);
                }); // mask out spei

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
// print(NDVI_monthlyave);

// NDVI anomaly = monthly average NDVI - 30yr monthly average NDVI 
// NDVI monthly anomaly
var monthfilter = ee.Filter.equals({
    leftField: 'month',
    rightField: 'month',
});
var monthlink = ee.Join.saveFirst({
    matchKey: 'match',
});
// print(NDVI_30yrave);
var NDVI_monthlink = ee.ImageCollection(monthlink.apply(NDVI_monthlyave,NDVI_30yrave,monthfilter))
    .map(function(image) {
        return image.addBands(image.get('match'));
    });
                             
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

//------------------------------------------------------------------------//
//                                  Lag                                   //
//------------------------------------------------------------------------//
// lag is achieved by shifting the date of the data

var addLagm = function(image) {
    var lagm = ee.Date(image.get('system:time_start')).advance(lagflag,'month');
    return image.set({'lagm': lagm});
};

// below is to compute ndvi three month anomaly
var addLag0m = function(image) {
    var lagm = ee.Date(image.get('system:time_start')).advance(0,'month');
    return image.set({'lagm': lagm});
};

var addLag1m = function(image) {
    var lagm = ee.Date(image.get('system:time_start')).advance(-1,'month');
    return image.set({'lagm': lagm});
};

var addLag2m = function(image) {
    var lagm = ee.Date(image.get('system:time_start')).advance(-2,'month');
    return image.set({'lagm': lagm});
};

var NDVI0 = NDVI_anomaly.select('NDVI_anomaly').map(addLag0m);
var NDVI1 = NDVI_anomaly.select('NDVI_anomaly').map(addLag1m);
var NDVI2 = NDVI_anomaly.select('NDVI_anomaly').map(addLag2m);

var lagFilter = ee.Filter.equals({
    leftField: 'lagm',
    rightField: 'lagm',
});
var lagLink = ee.Join.saveFirst({
    matchKey: 'match',
});

var NDVI_threeMonthAnomaly = ee.ImageCollection(lagLink.apply(NDVI0.select('NDVI_anomaly'),
        NDVI1.select('NDVI_anomaly'),lagFilter))
        .map(function(image) {
            return image.addBands(image.get('match'));
        });


var NDVI_threeMonthAnomaly = ee.ImageCollection(lagLink.apply(NDVI_threeMonthAnomaly,
        NDVI2.select('NDVI_anomaly'),lagFilter))
        .map(function(image) {
            return image.addBands(image.get('match'));
        });

var NDVI_anomaly_sum = NDVI_threeMonthAnomaly.map(function(image) {
    return image.addBands(
        image.expression('a1 + b1 + c1', {
            a1: image.select('NDVI_anomaly'),
            b1: image.select('NDVI_anomaly_1'),
            c1: image.select('NDVI_anomaly_2'),
        }).rename('NDVI_anomalySum'));
});

var NDVI_anomSumMLag = NDVI_anomaly_sum.select('NDVI_anomalySum').map(addLagm);


// Map.addLayer(speiSelect.select('spei'), corrParams, 'spei Map');
// print(NDVI_anomaly_sum);

//------------------------------------------------------------------//
// This part compares NDVI anomalies with spei2m computed from NOAH //
// Global land assimulation system                                  //
//------------------------------------------------------------------//

var speiSet = spei.map(function(image) {
    return image.set('date', image.date());
  });
  
  var timescaleFilter = ee.Filter.equals({
    leftField: 'lagm',
    rightField: 'date',
});  
// print(speiSet,'speiSet');
var NDVI3mLag_spei = ee.ImageCollection(lagLink.apply(NDVI_anomSumMLag.select('NDVI_anomalySum'),
        speiSet.select('b1'),timescaleFilter))
        .map(function(image) {
            return image.addBands(image.get('match'));
        });

// print(NDVI_spei,'NDVI_spei');
var corrmap = NDVI3mLag_spei.reduce(ee.Reducer.pearsonsCorrelation()).clip(roi);
// var corrmap = NDVI_spei.reduce(ee.Reducer.spearmansCorrelation()).clip(roi);
                    // .addBands(lucc.select('landcover')
                    // .rename('lucc'));
var corrParams = {min: -1, max: 1, palette: ['red','white', 'green']};
Map.addLayer(corrmap.select('correlation'), corrParams, 'Correlation Map');

// Export.image.toDrive({
//   image: corrmap,
//   description: 'Correlation map of monthly NDVI and water balance',
//   scale: 1000,
// //   region: roi
// });var landsatndvi = L8ndvi.merge(L457ndvi);
print(ui.Chart.image.seriesByRegion(landsatndvi, roi, ee.Reducer.mean(), 'NDVI',200));
print(ui.Chart.image.seriesByRegion(NDVI3mLag_spei, roi, ee.Reducer.mean(), 'NDVI_anomalySum',200));
print(ui.Chart.image.seriesByRegion(NDVI3mLag_spei, roi, ee.Reducer.mean(), 'b1',200));