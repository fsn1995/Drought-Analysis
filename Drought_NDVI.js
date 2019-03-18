// calculate ndvi and monthly ndvi anomaly: yes
// extract point time series of values: yes
// month gaps: solved (at least partially)
// three month sum of ndvi anomaly: yes
// ndvi mapping and image export: yes
// correlation map: yes
// noah data for water balance analysis: yes
// image clip: yes

// upload spei: tried but spei needs to be re-examined (datetime)
// new feature: day of year charts- developing

// note: noah data starts from 1948-1010
// if GEE refuses to display the map then reduce the time or
// we would have to export it to google drive (run tasks).

// Shunan

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


// define roi (name of the country)
// var worldmap = ee.FeatureCollection('USDOS/LSIB_SIMPLE/2017'); not political right, 
var worldmap = ee.FeatureCollection('users/fsn1995/UIA_World_Countries_Boundaries');
var country = ['Belgium'];//change the name of country here
var countryshape = worldmap.filter(ee.Filter.inList('Country', country));
var roi = countryshape.geometry();
var roiLayer = ui.Map.Layer(roi, {color: 'FF0000'}, 'roi');
Map.layers().add(roiLayer);//display roi
var roi_point = ee.Geometry.Point(-4.603578, 36.654435).buffer(500);// Malaga

// study time range
var year_start = 1984;
var year_end = 2018;
var month_start = 1;
var month_end = 12;
// next step is to define the months of ndvi anomal calculation
// var month_anomaly = ee.List.sequence(3,5);// March to May
var month_upper = 6;// March to May
var month_lower = 2;

var date_start = ee.Date.fromYMD(year_start, month_start, 1);
var date_end = ee.Date.fromYMD(year_end, month_end, 31);
var years = ee.List.sequence(year_start, year_end);// time range of years
var months = ee.List.sequence(month_start, month_end);// time range of months

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
// print(NDVI_monthlyave);
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

var NDVIfiltered = NDVI_monthlink.filterMetadata('month','less_than',month_upper)
                             .filterMetadata('month','greater_than',month_lower);



// var NDVI_anomaly = NDVI_monthlink.map(function(image) {
//     return image.addBands(image.expression(
//         'b1-b2',
//         {
//             b1: image.select('NDVIm'),
//             b2: image.select('NDVIy'),
//         }
//     )).rename('NDVI_anomaly');
// });
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

var NDVI_anomaly = NDVIfiltered.map(addNDVI_anomaly);
// print(NDVI_anomaly);

// three month sum of NDVI_anomaly 
var NDVI_anomaly_sum = ee.ImageCollection.fromImages(
    years.map(function (y) {
        var vi = NDVI_anomaly.select('NDVI_anomaly')
                             .filter(ee.Filter.eq('year', y))
                             .sum()
                             .rename('NDVI_anomaly_sum');
        return vi.set('year', y);
    }).flatten()
);
print(NDVI_anomaly_sum);
var meanndvi = NDVI_anomaly_sum.select('NDVI_anomaly_sum').reduce(ee.Reducer.max());
var ndviParams = {min: -1, max: 1, palette: ['blue','white', 'green']};
Map.addLayer(meanndvi.select('NDVI_anomaly_sum_max').clip(roi), ndviParams, 'NDVI image');


// Export.image.toDrive({
//   image: meanndvi,
//   description: 'ndvitest',
//   scale: 1000,
// //   region: roi
// });

// time series plotting
// time consuming, better choose to export a point value.
// var options = {
//     title: 'Time Series of NDVI anomaly',
//     hAxis: {title: 'Time'},
//     vAxis: {title: 'NDVI monthly anomaly'},
// };
// var NDVI_timeseries = ui.Chart.image.seriesByRegion(
//     NDVI_anomaly, roi, ee.Reducer.mean(), 'NDVI_anomaly', 
//     10000, 'system:time_start', 'label').setChartType('LineChart')
//                                         .setOptions(options);
// print(NDVI_timeseries);

// Export.Chart.toDrive({
//     Chart: NDVI_timeseries,
//     description: 'ndvi experiment',
//     fileFormat: 'JPG'
//   });

// load land cover data
var lucc = ee.Image('ESA/GLOBCOVER_L4_200901_200912_V2_3').select('landcover').clip(roi);
// print(lucc);
// Map.addLayer(lucc, {}, 'Landcover');

// var lucc_wf = lucc.reduceRegion({
//     reducer: ee.Reducer.frequencyHistogram(),// weighted frequency table
//     geometry: roi,
//     scale:25000
// });
// print(lucc_wf);
// var lucc_arealist = ee.Dictionary(lucc_wf.get('landcover'));
// var lucc_areasum = ee.Array(lucc_arealist.values()).reduce(ee.Reducer.sum(),[0]).get([0]);
// // i have some doubts about this line below, need to check
// var lucc_perc = ee.Array(lucc_arealist.values()).divide(lucc_areasum).multiply(100);
// var lucc_percSort = lucc_perc.sort();
var lucc_pixelArea = ee.Image.pixelArea().addBands(lucc);
var lucc_group = lucc_pixelArea.reduceRegion({
    reducer: ee.Reducer.sum().group({
        groupField: 1,
        groupName: 'landcover_class_value'
    }),
    geometry: roi,
    scale: 300,
    bestEffort: true,
});
print('reduction_results', lucc_group);

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
print(lucc_Piechart);


// // water balance
// NASA/GLDAS/V020/NOAH/G025/T3H
var climate = ee.ImageCollection('NASA/GLDAS/V20/NOAH/G025/T3H')
    .filter(ee.Filter.date(date_start, date_end))
    .filterBounds(roi);
    // .filterMetadata('month','less_than',month_upper)
    // .filterMetadata('month','greater_than',month_lower);

var rain = climate.select('Rainf_f_tavg');
var evap = climate.select('Evap_tavg');

// print(rain);
// print(evap);

var rain_monthlyave = ee.ImageCollection.fromImages(
    years.map(function (y) {
        return months.map(function(m) {
            var vi = rain.filter(ee.Filter.calendarRange(y, y, 'year'))
                         .filter(ee.Filter.calendarRange(m, m, 'month'))
                         .mean()
                         .rename('rainm');
            return vi.set('year', y)
                     .set('month', m)
                     .set('system:time_start', ee.Date.fromYMD(y, m, 15));
        });
    }).flatten()
);
// print(rain_monthlyave);

var evap_monthlyave = ee.ImageCollection.fromImages(
    years.map(function (y) {
        return months.map(function(m) {
            var vi = evap.filter(ee.Filter.calendarRange(y, y, 'year'))
                         .filter(ee.Filter.calendarRange(m, m, 'month'))
                         .mean()
                         .rename('evapm');
            return vi.set('year', y)
                     .set('month', m)
                     .set('system:time_start', ee.Date.fromYMD(y, m, 15));
        });
    }).flatten()
);
// print(evap_monthlyave);

var monthfilter = ee.Filter.equals({
    leftField: 'month',
    rightField: 'month',
});
var monthlink = ee.Join.saveFirst({
    matchKey: 'match',
});

var climate_monthlink = ee.ImageCollection(monthlink.apply(evap_monthlyave,rain_monthlyave,monthfilter))
    .map(function(image) {
        return image.addBands(image.get('match'));
    });
var climate_filtered = climate_monthlink.filterMetadata('month','less_than',month_upper)
                                        .filterMetadata('month','greater_than',month_lower);
// print(climate_filtered);

// // monthly mean climate data didn't return any data so this part is skipped
var waterbalance = climate_filtered.map(function(image) {
    return image.addBands(image.select('rainm')
                               .subtract(image.select('evapm'))
                               .rename('wb'));
});
// // correlation map
var monthfilter = ee.Filter.equals({
    leftField: 'system:time_start',
    rightField: 'system:time_start',
});
var NDVI_WB = ee.ImageCollection(monthlink.apply(NDVI_anomaly.select('NDVI_anomaly'),
        waterbalance.select('wb'),monthfilter))
        .map(function(image) {
            return image.addBands(image.get('match'));
        });

var corrmap = NDVI_WB.reduce(Reducer.pearsonsCorrelation());

var corrParams = {min: -1, max: 1, palette: ['blue','white', 'green']};
Map.addLayer(corrmap.select('correlation'), ndviParams, 'Correlation Map');


Export.image.toDrive({
  image: corrmap,
  description: 'Correlation map of monthly NDVI_anomaly and water balance',
  scale: 10000,
//   region: roi
});






// // var addWaterbalance = function(image) {
// //     var wb = image.expression(
// //         'b1-b2',
// //         {
// //             b1: image.select('rainm'),
// //             b2: image.select('evap')
// //         }
// //     ).rename('wb');
// //     return image.addBands(wb);
// // };
// var waterbalance = climate_filtered.map(addWaterbalance);
// print(waterbalance);

// point data extraction and time series analysis.

// time series chart print
// print(ui.Chart.image.series(NDVI.select('NDVI'), roi_point, ee.Reducer.mean()));
// print(ui.Chart.image.series(NDVI_anomaly.select('NDVI_anomaly'), roi_point, ee.Reducer.mean()));
// print(ui.Chart.image.series(rain.select('Rainf_f_tavg'), roi_point, ee.Reducer.mean()));
// print(ui.Chart.image.series(rain.select('Evap_tavg'), roi_point, ee.Reducer.mean()));
