// Some test of soil moisture

////////////////////////////////////////////////////////////////////////////
//                          Preparation                                   //
////////////////////////////////////////////////////////////////////////////

// var worldmap = ee.FeatureCollection('ft:1tdSwUL7MVpOauSgRzqVTOwdfy17KDbw-1d9omPw');//world vector
var usstate = ee.FeatureCollection('ft:1fRY18cjsHzDgGiJiS2nnpUU3v9JPDc2HNaR7Xk8');//us state vector
// var worldmap = ee.FeatureCollection('USDOS/LSIB_SIMPLE/2017'); //not political right, 
// var worldmap = ee.FeatureCollection('users/fsn1995/UIA_World_Countries_Boundaries');
var country = ['Spain'];//CHANGE the NAME of country here!
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
var month_start = 3;
var month_end = 10;

var date_start = ee.Date.fromYMD(year_start, 1, 1);
var date_end = ee.Date.fromYMD(year_end, 12, 31);
var years = ee.List.sequence(year_start, year_end);// time range of years
var months = ee.List.sequence(month_start, month_end);// time range of months
// next step is to define the months of ndvi anomal calculation
// var month_anomaly = ee.List.sequence(3,5);// March to May
// var month_upper = 8;// May to July
// var month_lower = 4;

////////////////////////////////////////////////////////////////////////////
//                                 NDVI                                   //
////////////////////////////////////////////////////////////////////////////

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
// // get the list of image dates
// var date_all = NDVI.map(function(image) {
//     return image.set('date', image.date());
// });
// print(date_all);
// var datelist = date_all.aggregate_array('date');
// print(datelist);

// monthly average NDVI
// sytstem time is set as 1st of each month
var NDVI_monthlyave = ee.ImageCollection.fromImages(
    years.map(function (y) {
        return months.map(function(m) {
            var vi = landsatndvi.select('NDVI')
                                .filter(ee.Filter.calendarRange(y, y, 'year'))
                                .filter(ee.Filter.calendarRange(m, m, 'month'))
                                .mean()
                                .log()
                                .rename('NDVIm');
            return vi.set('year', y)
                     .set('month', m)
                     .set('system:time_start', ee.Date.fromYMD(y, m, 1));
        });
    }).flatten()
);
// var NDVIfiltered = NDVI_monthlyave.filterMetadata('month','less_than',month_upper)
//                              .filterMetadata('month','greater_than',month_lower);
// print(NDVI_monthlyave);

//////////////////////////////////////////////////////////////////////
// This part will prepare the water balance from NOAH Global        //
// land assimulation system                                         //
//////////////////////////////////////////////////////////////////////

// Alternative: GLDAS NOAH data
// var climate1 = ee.ImageCollection('NASA/GLDAS/V20/NOAH/G025/T3H')
//     .select(['Rainf_f_tavg','Evap_tavg'])
//     .filter(ee.Filter.date(date_start, date_end))
//     .filterBounds(roi);
// var climate2 = ee.ImageCollection('NASA/GLDAS/V021/NOAH/G025/T3H')
//     .select(['Rainf_f_tavg','Evap_tavg'])
//     .filter(ee.Filter.date('2011-01-01', '2018-12-31'))
//     .filterBounds(roi);
// var climate = climate1.merge(climate2)
//     .filter(ee.Filter.date(date_start, date_end));

var climate = ee.ImageCollection("NASA/FLDAS/NOAH01/C/GL/M/V001")
    .select('SoilMoi10_40cm_tavg')
    .filter(ee.Filter.date(date_start, date_end))
    .filterBounds(roi);
    // .rename('sm');

var addSM_mm = function(image) {
    var SM_mm = image.expression(
        'b1 / 997 * 86400 / 8 * 100',// unit coversion
        {
            b1: image.select('SoilMoi10_40cm_tavg')
        }
    ).rename('SM_mm');
    return image.addBands(SM_mm);
};

var sm = climate.map(addSM_mm);
var sm_month = ee.ImageCollection.fromImages(
    years.map(function (y) {
        return months.map(function(m) {
            var vi = sm.select('SM_mm')
                         .filter(ee.Filter.calendarRange(y, y, 'year'))
                         .filter(ee.Filter.calendarRange(m, m, 'month'))
                         .sum()
                         .rename('sm');
            return vi.set('year', y)
                     .set('month', m)
                     .set('system:time_start', ee.Date.fromYMD(y, m, 1));
        });
    }).flatten()
);
// print(rain_monthlysum);

var monthlink = ee.Join.saveFirst({
    matchKey: 'match',
});


//////////////////////////////////////////////////////////////////////
//                        Mapping and charting                      //
//////////////////////////////////////////////////////////////////////

var monthfilter = ee.Filter.equals({
    leftField: 'system:time_start',
    rightField: 'system:time_start',
});
var NDVI_SM = ee.ImageCollection(monthlink.apply(NDVI_monthlyave.select('NDVIm'),
        sm_month.select('sm'),monthfilter))
        .map(function(image) {
            return image.addBands(image.get('match'));
        });
var corrmap = NDVI_SM.reduce(ee.Reducer.pearsonsCorrelation()).clip(roi);
                    //  .addBands(lucc.select('landcover')
                    //  .rename('lucc'));
var corrParams = {min: -1, max: 1, palette: ['red','white', 'green']};
Map.addLayer(corrmap.select('correlation'), corrParams, 'Correlation Map');

Export.image.toDrive({
  image: corrmap,
  description: 'Correlation map of monthly NDVI and water balance',
  scale: 1000,
//   region: roi
});
// var options = {
//     // lineWidth: 1,
//     // pointSize: 2,
//     hAxis: {title: 'R and P value'},
//     vAxis: {title: 'Correlation Coefficient'},
//     title: 'Correlation map average'
// };
// var chart = ui.Chart.image.byClass(
//     corrmap, 'lucc', roi, ee.Reducer.mean(), 1000, lucc.get('landcover_class_names')
// ).setOptions(options);  
// print(chart);
