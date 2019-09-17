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
var lagflag = 0;

var date_start = ee.Date.fromYMD(year_start, 1, 1);
var date_end = ee.Date.fromYMD(year_end, 12, 31);
var years = ee.List.sequence(year_start, year_end);// time range of years
var months = ee.List.sequence(month_start, month_end);// time range of months

// define your study area and name it as roi. e.g. draw it by hand tool

var geometry = ee.FeatureCollection([
    /* color: #d63000 */ee.Geometry.MultiPoint(
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
         [116.1996688117191, 37.90027047802768]]) //Northern China
]);
// var geometry = /* color: #d63000 */ee.Geometry.MultiPoint(
//   [[-120.04598637852064, 36.447665173620244],//California
//    [-99.39168950352064, 32.980880455676854], //Texas
//    [-41.521726852388724, -10.87755592386568],//Brazil
//    [21.87462563721556, -23.646207259859224], //Southern Africa
//    [120.66368813721556, -31.729729863475043],//Australia1
//    [125.05821938721556, -25.5639224731522],  //Australia2
//    [148.08556313721556, -25.5639224731522],  //Australia3
//    [-7.587965499171105, 38.51236079666947],  //Portugal
//    [-4.072340499171105, 37.89075584438553],  //Spain
//    [15.087815750828895, 57.84360752733928],  //Sweden
//    [24.931565750828895, 61.22692304603273],  //Finland
//    [77.1762313117191, 16.351044772181],      //India
//    [116.1996688117191, 37.90027047802768]]); //Northern China

var roiPoints = geometry.buffer(9000);

//------------------------------------------------------------------------//
//                               Datainput                                //
//------------------------------------------------------------------------//

// load MODIS NDVI 2000-02-18T00:00:00 - Present
var ndvi = ee.ImageCollection('MODIS/006/MOD13A2')
    .filterDate(date_start, date_end)
    .select('NDVI');

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
                }); // mask out spei

// monthly average NDVI
// sytstem time is set as 1st of each month
var NDVI_monthlyave = ee.ImageCollection.fromImages(
    years.map(function (y) {
        return months.map(function(m) {
            var vi = ndvi.select('NDVI')
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

// 20yr monthly average NDVI
var NDVI_30yrave = ee.ImageCollection.fromImages(
    months.map(function (m) {
        var vi = ndvi.select('NDVI')
                     .filter(ee.Filter.calendarRange(m, m, 'month'))
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

// compute three month sum ndvi anomaly

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


//------------------------------------------------------------------//
// This part compares NDVI anomalies with spei computed from NOAH   //
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

var corrmap = NDVI3mLag_spei.reduce(ee.Reducer.pearsonsCorrelation()); 
var corrParams = {min: -1, max: 1, palette: ['red','white', 'green']};
Map.addLayer(corrmap.select('correlation'), corrParams, 'Correlation Map');                
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

print(ui.Chart.image.seriesByRegion(NDVI_anomSumMLag, roiPoints
    , ee.Reducer.mean(), 'NDVI_anomalySum',1000));
print(ui.Chart.image.seriesByRegion(NDVI3mLag_spei, roiPoints, 
    ee.Reducer.mean(), 'NDVI_anomalySum',1000));
print(ui.Chart.image.seriesByRegion(NDVI3mLag_spei, roiPoints, 
    ee.Reducer.mean(), 'b1',1000));