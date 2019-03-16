////////////////////////////////////////////////////////////////////////////
// This script will compute the monthly NDVI from Landsat imagery and     //
// water balance from NOAH Global Land Assimulation System.               //
// It will display and export the correlation map of NDVI vs water        //
// balance. Charts also considered lucc info and the average R and P value//
// over different vegetation type is computed and shown in GEE console.   //
////////////////////////////////////////////////////////////////////////////
// This is part of a group work about drought analysis by MSc students in //
// Department of Earth Sciences, Uppsala University:                      //
// de Mendonça Fileni, Felipe; Erikson, Torbjörn-Johannes; Feng, Shunan   //                                                                         //
// Supervisor: Pettersson, Rickard; Winterdahl, Mattias                   //
// Contact: Shunan Feng (冯树楠): fsn.1995@gmail.com                      //
////////////////////////////////////////////////////////////////////////////

// NOTE!
// The process of NOAH takes too much computation resource so the study time 
// is limited to recent years (2013-2018); This won't be a problem when comapring 
// spei with ndvi.

// note to myself:
// lucc class name on correlation chart needs to be corrected
// lucc class should be simplified
// SPEI could be uploaded once it is done and correlate it with NDVI 
// Time lag and month gaps of ndvi

////////////////////////////////////////////////////////////////////////////
//                          Preparation                                   //
////////////////////////////////////////////////////////////////////////////

// var worldmap = ee.FeatureCollection('ft:1tdSwUL7MVpOauSgRzqVTOwdfy17KDbw-1d9omPw');//world vector
// var usstate = ee.FeatureCollection('ft:1fRY18cjsHzDgGiJiS2nnpUU3v9JPDc2HNaR7Xk8');//us state vector
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
var month_start = 1;
var month_end = 12;

var date_start = ee.Date.fromYMD(year_start, month_start, 1);
var date_end = ee.Date.fromYMD(year_end, month_end, 31);
var years = ee.List.sequence(year_start, year_end);// time range of years
var months = ee.List.sequence(month_start, month_end);// time range of months
// next step is to define the months of ndvi anomal calculation
// var month_anomaly = ee.List.sequence(3,5);// March to May
var month_upper = 8;// April to June
var month_lower = 4;

////////////////////////////////////////////////////////////////////////////
//                                 NDVI                                   //
////////////////////////////////////////////////////////////////////////////

// load landsat image
var surfaceReflectance4 = ee.ImageCollection('LANDSAT/LT04/C01/T1_SR')
    .filterDate('1982-01-01', '2018-10-01');
var surfaceReflectance5 = ee.ImageCollection('LANDSAT/LT05/C01/T1_SR')
    .filterDate('1984-01-01', '2018-10-01');
var surfaceReflectance7 = ee.ImageCollection('LANDSAT/LE07/C01/T1_SR')
    .filterDate('1999-01-01', '2018-10-01');   
var surfaceReflectance8 = ee.ImageCollection('LANDSAT/LC08/C01/T1_SR')
    .filterDate('2013-01-01', '2018-12-01');
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
    .filterBounds(roi)
    .map(fmaskL8sr)
    .map(addNDVI8);

var L457ndvi = surfaceReflectance457
    .filterBounds(roi)
    .map(fmaskL457)
    .map(addNDVI457);

// merge L8 L457 NDVI
var landsatndvi = L8ndvi.merge(L457ndvi);
var NDVI = landsatndvi.filterDate(date_start, date_end)
                      .sort('system:time_start', false)
                      .select('NDVI');
// get the list of image dates
// var date_all = NDVI.map(function(image) {
//     return image.set('date', image.date());
// });
// print(date_all);
// var datelist = date_all.aggregate_array('date');
// print(datelist);

// monthly average NDVI
// sytstem time is set as 15th of each month
var NDVI_monthlyave = ee.ImageCollection.fromImages(
    years.map(function (y) {
        return months.map(function(m) {
            var vi = NDVI.filter(ee.Filter.calendarRange(y, y, 'year'))
                         .filter(ee.Filter.calendarRange(m, m, 'month'))
                         .mean()
                         .rename('NDVIm');
            return vi.set('year', y)
                     .set('month', m)
                     .set('system:time_start', ee.Date.fromYMD(y, m, 15));
        });
    }).flatten()
);
var NDVIfiltered = NDVI_monthlyave.filterMetadata('month','less_than',month_upper)
                             .filterMetadata('month','greater_than',month_lower);
// print(NDVI_monthlyave);

//////////////////////////////////////////////////////////////////////
//LUCC: This part will import and display the lucc info in the study//
//area                                                              //
//////////////////////////////////////////////////////////////////////

// load lucc
var lucc = ee.Image('ESA/GLOBCOVER_L4_200901_200912_V2_3').select('landcover').clip(roi);
Map.addLayer(lucc, {}, 'Landcover');
var lucc_pixelArea = ee.Image.pixelArea().addBands(lucc);
var lucc_group = lucc_pixelArea.reduceRegion({
    reducer: ee.Reducer.sum().group({
        groupField: 1,
        groupName: 'landcover_class_value'
    }),
    geometry: roi,
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

//////////////////////////////////////////////////////////////////////
// This part will prepare the water balance from NOAH Global        //
// land assimulation system                                         //
//////////////////////////////////////////////////////////////////////

var climate1 = ee.ImageCollection('NASA/GLDAS/V20/NOAH/G025/T3H')
    .select(['Rainf_f_tavg','Evap_tavg'])
    .filter(ee.Filter.date(date_start, date_end))
    .filterBounds(roi);
var climate2 = ee.ImageCollection('NASA/GLDAS/V021/NOAH/G025/T3H')
    .select(['Rainf_f_tavg','Evap_tavg'])
    .filter(ee.Filter.date('2011-01-01', '2018-12-31'))
    .filterBounds(roi);
var climate = climate1.merge(climate2)
    .filter(ee.Filter.date(date_start, date_end));
var rain = climate.select('Rainf_f_tavg');
var evap = climate.select('Evap_tavg');
var addRain_mm = function(image) {
    var Rain_mm = image.expression(
        'b1 / 997 * 86400 / 8 * 100',// unit coversion
        {
            b1: image.select('Rainf_f_tavg')
        }
    ).rename('Rain_mm');
    return image.addBands(Rain_mm);
};
var addEvap_mm = function(image) {
    var Evap_mm = image.expression(
        'b1 / 997 * 86400 / 8 * 100',// unit coversion
        {
            b1: image.select('Evap_tavg')
        }
    ).rename('Evap_mm');
    return image.addBands(Evap_mm);
};
var rain = rain.map(addRain_mm);
var evap = evap.map(addEvap_mm);

var rain_monthlysum = ee.ImageCollection.fromImages(
    years.map(function (y) {
        return months.map(function(m) {
            var vi = rain.select('Rain_mm')
                         .filter(ee.Filter.calendarRange(y, y, 'year'))
                         .filter(ee.Filter.calendarRange(m, m, 'month'))
                         .sum()
                         .rename('rainm');
            return vi.set('year', y)
                     .set('month', m)
                     .set('system:time_start', ee.Date.fromYMD(y, m, 15));
        });
    }).flatten()
);
// print(rain_monthlysum);

var evap_monthlysum = ee.ImageCollection.fromImages(
    years.map(function (y) {
        return months.map(function(m) {
            var vi = evap.select('Evap_mm')
                         .filter(ee.Filter.calendarRange(y, y, 'year'))
                         .filter(ee.Filter.calendarRange(m, m, 'month'))
                         .sum()
                         .rename('evapm');
            return vi.set('year', y)
                     .set('month', m)
                     .set('system:time_start', ee.Date.fromYMD(y, m, 15));
        });
    }).flatten()
);
// print(evap_monthlysum);

var monthfilter = ee.Filter.equals({
    leftField: 'month',
    rightField: 'month',
});
var monthlink = ee.Join.saveFirst({
    matchKey: 'match',
});

var climate_monthlink = ee.ImageCollection(monthlink.apply(evap_monthlysum,rain_monthlysum,monthfilter))
    .map(function(image) {
        return image.addBands(image.get('match'));
    });
var climate_filtered = climate_monthlink.filterMetadata('month','less_than',month_upper)
                                        .filterMetadata('month','greater_than',month_lower);
var waterbalance = climate_monthlink.map(function(image) {
    return image.addBands(image.select('rainm')
                               .subtract(image.select('evapm'))
                               .rename('wb'));
});

//////////////////////////////////////////////////////////////////////
//                        Mapping and charting                      //
//////////////////////////////////////////////////////////////////////

var monthfilter = ee.Filter.equals({
    leftField: 'system:time_start',
    rightField: 'system:time_start',
});
var NDVI_WB = ee.ImageCollection(monthlink.apply(NDVIfiltered.select('NDVIm'),
        waterbalance.select('wb'),monthfilter))
        .map(function(image) {
            return image.addBands(image.get('match'));
        });
var corrmap = NDVI_WB.reduce(ee.Reducer.pearsonsCorrelation()).clip(roi)
                     .addBands(lucc.select('landcover')
                     .rename('lucc'));
var corrParams = {min: -1, max: 1, palette: ['red','white', 'green']};
Map.addLayer(corrmap.select('correlation'), corrParams, 'Correlation Map');

Export.image.toDrive({
  image: corrmap,
  description: 'Correlation map of monthly NDVI and water balance',
  scale: 10000,
//   region: roi
});
var options = {
    // lineWidth: 1,
    // pointSize: 2,
    hAxis: {title: 'R and P value'},
    vAxis: {title: 'Correlation Coefficient'},
    title: 'Correlation map average'
};
var chart = ui.Chart.image.byClass(
    corrmap, 'lucc', roi, ee.Reducer.mean(), 1000, lucc.get('landcover_class_names')
).setOptions(options);  
print(chart);
