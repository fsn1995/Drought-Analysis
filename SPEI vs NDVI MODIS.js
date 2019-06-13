////////////////////////////////////////////////////////////////////////////
// This script uses MODIS 1km NDVI product and it is spatially            //
// correlate with SPEI calculated from NOAH Global Land Assimulation      //
// System data. It will display and export the correlation map of SPEI vs //
// three months sum of NDVI anomalies. (spearson/pearson's correlation)   //
//------------------------------------------------------------------------//
// For fast global study                                                  //
// Contact: Shunan Feng (冯树楠): fsn.1995@gmail.com                      //
////////////////////////////////////////////////////////////////////////////


//------------------------------------------------------------------------//
//                             Preparation                                //
//------------------------------------------------------------------------//


// // var worldmap = ee.FeatureCollection('ft:1tdSwUL7MVpOauSgRzqVTOwdfy17KDbw-1d9omPw');//world vector
// var usstate = ee.FeatureCollection('ft:1fRY18cjsHzDgGiJiS2nnpUU3v9JPDc2HNaR7Xk8');//us state vector
// // var worldmap = ee.FeatureCollection('USDOS/LSIB_SIMPLE/2017'); //not political right, 
// // var country = ['Spain'];//CHANGE the NAME of country here!
// var state = ['California'];//CHANGE the NAME of us state here!

// // var countryshape = worldmap.filter(ee.Filter.inList('Country', country));// country 
// var stateshape = usstate.filter(ee.Filter.inList('Name', state));// us state
// // var roi = countryshape.geometry();// country 
// var roi = stateshape.geometry();// us state
// var roiLayer = ui.Map.Layer(roi, {color: 'FF0000'}, 'roi');
// // var roiCentroid = roi.centroid();
// Map.layers().add(roiLayer);//display roi
// // Map.setCenter(roiCentroid);

// study time range
var year_start = 2000;
var year_end = 2018;
// month range of ndvi anomalies (May to July)
// var month_start = 5;
// var month_end = 7;
var speim = 4;// month of spei 
var month_start = speim + 1;
var month_end = speim + 3;

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
var ndvi = ee.ImageCollection('MODIS/006/MOD13A2')
    .filterDate(date_start, date_end)
    .select('NDVI');

var spei = ee.ImageCollection("users/fsn1995/spei3m_noah");


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
var corrmap = NDVI_spei.reduce(ee.Reducer.pearsonsCorrelation());
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
