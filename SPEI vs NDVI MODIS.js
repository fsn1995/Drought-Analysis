/*/
This script uses MODIS 1km NDVI product and it is spatially correlated
with SPEI calculated from NOAH Global Land Assimulation System data. 
It will display and export the correlation map of SPEI vs three months 
sum of NDVI anomalies.
Pixels with p-value <0.05 will be filtered out in the correlation map.
This study further analyzes the correlation spatial pattern by computing
the average R in different koppen climate zones. (extreme dry climate not 
included)
(SPEIxMonth in Jan-Dec vs NDVI three month anomalies)                  
//------------------------------------------------------------------------//
// For fast global study                                                  
// Contact: Shunan Feng (冯树楠): fsn.1995@gmail.com                      
*/


//------------------------------------------------------------------------//
//                             Preparation                                //
//------------------------------------------------------------------------//
// var worldmap = ee.FeatureCollection('USDOS/LSIB_SIMPLE/2017'),
//     roi = worldmap.geometry();
var worldmap = ee.FeatureCollection('ft:1tdSwUL7MVpOauSgRzqVTOwdfy17KDbw-1d9omPw');//world vector
var roi = worldmap.geometry();
// study time range
var year_start = 2001; //  MODIS NDVI 2000-02-18T00:00:00 - Present
var year_end = 2018;
var month_start = 1;
var month_end = 12;

var date_start = ee.Date.fromYMD(year_start, 1, 1);
var date_end = ee.Date.fromYMD(year_end, 12, 31);
var years = ee.List.sequence(year_start, year_end);// time range of years
var months = ee.List.sequence(month_start, month_end);// time range of months
// change the month lag here, e.g. no lag is 0,-1 is one month lag,-2 is 2 month lag
var lagflag = 0; 

// The defalt setting will correlate 2 month time scale of SPEI(SPEI2m)
// with one month lag of three month sum of NDVI anomalies.

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
var spei = spei11m.filterDate(date_start, date_end);
                //   .map(function(image) {
                //     var speiMask = image.lte(0);
                //     return image.updateMask(speiMask);
                // }); // mask out spei

//------------------------------------------------------------------------//
//               load koppen cliamte classification
//------------------------------------------------------------------------//
var imageKoppen = ee.Image("users/fsn1995/Global_19862010_KG_5m");
var koppenColor = [
  "960000", "FF0000", "FF6E6E", "FFCCCC", "CC8D14", "CCAA54", 
  "FFCC00", "FFFF64", "007800", "005000", "003200", "96FF00", 
  "00D700", "00AA00", "BEBE00", "8C8C00", "5A5A00", "550055", 
  "820082", "C800C8", "FF6EFF", "646464", "8C8C8C", "BEBEBE", 
  "E6E6E6", "6E28B4", "B464FA", "C89BFA", "C8C8FF", "6496FF", 
  "64FFFF", "F5FFFF"
  ],
    koppenName = [
     'Af', 'Am', 'As', 'Aw', 'BSh', 'BSk', 'BWh', 'BWk', 'Cfa',
     'Cfb','Cfc', 'Csa', 'Csb', 'Csc', 'Cwa','Cwb', 'Cwc', 'Dfa',
     'Dfb', 'Dfc','Dfd', 'Dsa', 'Dsb', 'Dsc', 'Dsd','Dwa', 'Dwb',
     'Dwc', 'Dwd', 'EF','ET'
  ];
  
var koppen = imageKoppen.updateMask(imageKoppen.lte(30));
Map.addLayer(koppen, {min: 0, max: 30, palette: koppenColor}, 'koppen climate class');

//------------------------------------------------------------------------//
//                         load climate data
//------------------------------------------------------------------------//
// load mean annual temperature, mean annual precipitation

var MATe = ee.Image("users/fsn1995/MAT20yrNoah"),
    MAPr = ee.Image("users/fsn1995/MAP20yrNoah");
Map.addLayer(MATe, {min: -10, max: 30, palette: ['blue', 'green', 'red']}, 
    'mean annual temperature');
Map.addLayer(MAPr.updateMask(MAPr.gt(100)), {min: 100, max: 2000, palette: ['red', 'green', 'blue']}, 
    'mean annual precipitation');

//------------------------------------------------------------------------//
//                             computation
//------------------------------------------------------------------------//
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

var corrmap = NDVI3mLag_spei.reduce(ee.Reducer.pearsonsCorrelation())
                            .addBands(koppen)
                            .updateMask(MAPr.gt(100));
var corrmap = NDVI3mLag_spei.reduce(ee.Reducer.pearsonsCorrelation())
                            .addBands(koppen)
                            .updateMask(MAPr.gt(100));
var p = corrmap.select('p-value');
corrmap = corrmap.updateMask(p.lte(0.05));
                            // .addBands(landform.select('constant').rename('landform'));
//                        //.addBands(lucc.select('landcover').rename('lucc'));
// // var corrmap = NDVI_spei.reduce(ee.Reducer.spearmansCorrelation()).clip(roi);
//                     // .addBands(lucc.select('landcover').rename('lucc'));

var corrParams = {min: -1, max: 1, palette: ['red','white', 'green']};
Map.addLayer(corrmap.select('correlation'), corrParams, 'Correlation Map');

// make scale bar, adpated from https://code.earthengine.google.com/2e0393ebc3dbbaa1cd3820118ff60ff9

// A color bar widget. Makes a horizontal color bar to display the given
// color palette.
function ColorBar(palette) {
    return ui.Thumbnail({
      image: ee.Image.pixelLonLat().select(0),
      params: {
        bbox: [0, 0, 1, 0.1],
        dimensions: '100x10',
        format: 'png',
        min: 0,
        max: 1,
        palette: palette,
      },
      style: {stretch: 'horizontal', margin: '0px 8px'},
    });
  }

function makeLegend() {
    var labelPanel = ui.Panel(
        [
          ui.Label(corrParams['min'], {margin: '4px 8px'}),
          ui.Label(
              0,
              {margin: '4px 8px', textAlign: 'center', stretch: 'horizontal'}),
          ui.Label(corrParams['max'], {margin: '4px 8px'})
        ],
        ui.Panel.Layout.flow('horizontal'));
    return ui.Panel([ColorBar(corrParams.palette), labelPanel]);
  }
// Styling for the legend title.
var LEGEND_TITLE_STYLE = {
  fontSize: '20px',
  fontWeight: 'bold',
  stretch: 'horizontal',
  textAlign: 'center',
  margin: '4px',
};

// Styling for the legend footnotes.
var LEGEND_FOOTNOTE_STYLE = {
  fontSize: '10px',
  stretch: 'horizontal',
  textAlign: 'center',
  margin: '4px',
};

// Assemble the legend panel.
Map.add(ui.Panel(
    [
      ui.Label('Correlation Coefficient (R)', LEGEND_TITLE_STYLE), makeLegend(),
      ui.Label(
          '(spei vs ndvi anomalies)', LEGEND_FOOTNOTE_STYLE),
    //   ui.Label(
    //       'Source: Global Human Settlement Layer (JRC)', LEGEND_FOOTNOTE_STYLE),
    //   ui.Label('Country boundaries source: USDOS LSIB', LEGEND_FOOTNOTE_STYLE)
    ],
    ui.Panel.Layout.flow('vertical'),
    {width: '230px', position: 'bottom-left'}));
Export.image.toDrive({
  image: corrmap,
  folder: 'speiCorr',
  description: 'Correlation map of spei with ndvi anomalies',
  scale: 10000,
//   region: roi // If not specified, the region defaults to the viewport at the time of invocation
});

var options = {
    // lineWidth: 1,
    // pointSize: 2,
    hAxis: {title: 'R and P value'},
    vAxis: {title: 'Correlation Coefficient'},
    title: 'Correlation map average'
};

var chart = ui.Chart.image.byClass(
    corrmap, 'b1', roi, ee.Reducer.mean(), 25000, koppenName
).setOptions(options);  
print(chart);


// some discarded script
// load land cover data
// var lucc = ee.Image('USGS/NLCD/NLCD2011').select('landcover');
// var lucc = ee.Image('ESA/GLOBCOVER_L4_200901_200912_V2_3').select('landcover');
// var lucc_names = ee.Dictionary.fromLists(
//     ee.List(lucc.get('landcover_class_values')).map(ee.String),
//     lucc.get('landcover_class_names')
// );
// print(lucc_names, 'lucc name list');

// var landform = ee.Image("CSP/ERGo/1_0/Global/ALOS_landforms");
// var landform_names = [
//     'Peak/ridge (warm)', 'Peak/ridge', 'Peak/ridge (cool)', 'Mountain/divide',
//     'Cliff', 'Upper slope (warm)', 'Upper slope', 'Upper slope (cool)',
//     'Upper slope (flat)', 'Lower slope (warm)', 'Lower slope','Lower slope (cool)',
//     'Lower slope (flat)', 'Valley', 'Valley (narrow)'
// ];
// var landform_palette = [
//     '141414', '383838', '808080', 'EBEB8F', 'F7D311', 'AA0000', 'D89382',
//     'DDC9C9', 'DCCDCE', '1C6330', '68AA63', 'B5C98E', 'E1F0E5', 'a975ba',
//     '6f198c'
// ];
// var landform_num = [11, 12, 13, 14, 15, 21, 22, 23, 24, 31, 32, 33, 34, 41, 42];
// var landformPara = ee.Dictionary.fromLists(
//   ee.List(landform_num).map(ee.String),
//   landform_names);

// // remove extreme environment
// MATe = MATe.updateMask(MATe.gt(0).and(MAPr.gt(100)));
// MAPr = MAPr.updateMask(MATe.gt(0).and(MAPr.gt(100)));

// var precZones = MAPr.gt(0).add(MAPr.gt(200)).add(MAPr.gt(400)).add(MAPr.gt(600))
//                     .add(MAPr.gt(800)).add(MAPr.gt(1500));
// var tempZones = MATe.gt(0).add(MATe.gt(10)).add(MATe.gt(20)).add(MATe.gt(30));
// Map.addLayer(precZones.randomVisualizer(), {}, 'prec');
// Map.addLayer(tempZones.randomVisualizer(), {}, 'temp');
// var climateZones = precZones.updateMask(MATe.gt(15));
// Map.addLayer(climateZones.randomVisualizer(), {}, 'climate zones');
                    // monthly average NDVI

// // Define arbitrary thresholds R>0.3 R>0.5
// var zones = corrmap.select('correlation').gt(0.3).add(corrmap.select('correlation').gt(0.5));
// zones = zones.updateMask(zones.neq(0));

// var vectors = zones.addBands(corrmap.select('correlation')).reduceToVectors({
//     geometry: roi,
//     crs: corrmap.projection(),
//     scale: 25000,
//     // geometryType: 'polygon',
//     eightConnected: false,
//     labelProperty: 'zone',
//     reducer: ee.Reducer.mean()
//   });
  
// // print(zones);
// // print(vectors);
// // R> 0.3 will be displayed in blue, R>0.5 will be displayed in red
// Map.addLayer(zones, {min: 1, max: 2, palette: ['0000FF', 'FF0000']}, 'raster');

// // var display = ee.Image(0).updateMask(0).paint(vectors, '000000', 3);
// // Map.addLayer(display, {palette: '000000'}, 'vectors');
  
// Export.table.toAsset({
//     collection: vectors,
//     description:'corrmap2vector',
//     assetId: 'corrmap0305',
//   });