// study time range
var year_start = 2001; //  MODIS NDVI 2000-02-18T00:00:00 - Present
var year_end = 2018;
var month_start = 1;
var month_end = 12;

var date_start = ee.Date.fromYMD(year_start, 1, 1);
var date_end = ee.Date.fromYMD(year_end, 12, 31);
var years = ee.List.sequence(year_start, year_end);// time range of years
var years1 = ee.List.sequence(year_start - 1 , year_end - 1);// time range of years
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
                    var speiMask = image.gte(0);
                    return image.updateMask(speiMask);
                }); // mask spei > 0

var addLag1y = function(image) {
  var lagy = ee.Date(image.get('system:time_start')).advance(-1,'year');
  return image.set({'lagy': lagy});
};
var addLag0y = function(image) {
  var lagy = ee.Date(image.get('system:time_start')).advance(0,'year');
  return image.set({'lagy': lagy});
};

var spei0 = spei.select('b1').map(addLag0y);
var spei1 = spei.select('b1').map(addLag1y);


// annual spei
var speiYear = ee.ImageCollection.fromImages(
    years.map(function (y) {
        var indice = spei0.select('b1')
                            .filter(ee.Filter.calendarRange(y, y, 'year'))
                            .mean()
                            .rename('speiy');
        return indice.set('year', y)
                     .set('system:time_start', ee.Date.fromYMD(y, 1, 1));
    }).flatten()
);

var speiYear1 = ee.ImageCollection.fromImages(
  years1.map(function (y) {
      var indice = spei1.select('b1')
                          .filter(ee.Filter.calendarRange(y, y, 'year'))
                          .mean()
                          .rename('speiy1');
      return indice.set('year', y)
                   .set('system:time_start', ee.Date.fromYMD(y, 1, 1));
  }).flatten()
);

var lagFilter = ee.Filter.equals({
  leftField: 'year',
  rightField: 'year',
});
var lagLink = ee.Join.saveFirst({
  matchKey: 'match',
});

var speiAll = ee.ImageCollection(lagLink.apply(speiYear.select('speiy'),
        speiYear1.select('speiy1'),lagFilter))
        .map(function(image) {
          return image.addBands(image.get('match'));
        });
        
        
// print(speiAll);
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

// var speiYear = ee.ImageCollection.fromImages(
//     years.map(function (y) {
//         var indice = spei.select(['system:time_start', 'b1'])
//                          .filter(ee.Filter.calendarRange(y, y, 'year'))
//                          .reduce(ee.Reducer.linearFit());
//         return indice.set('year', y)
//                      .set('system:time_start', ee.Date.fromYMD(y, 1, 1));                 
//     }).flatten()
// );

var mapPara = {min: -1, max: 1, palette: ['red','white', 'green']};
Map.addLayer(speiDiff.select('speiDiff').filterDate('2001-01-01'), mapPara, '2001');
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
