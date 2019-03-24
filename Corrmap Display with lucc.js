/////////////////////////////////////////////////////////////////////////////
// This script displays the correlation map with lucc. The exported map    //
// stored in GEE asset could be displayed and analyzed by this script.     //
// The average R and P values over different lucc will be printed in GEE   //
// console                                                                 //
/////////////////////////////////////////////////////////////////////////////

//-------------------------------------------------------------------------//
//                                  roi                                    //
//-------------------------------------------------------------------------//

// var worldmap = ee.FeatureCollection('ft:1tdSwUL7MVpOauSgRzqVTOwdfy17KDbw-1d9omPw');//world vector
var usstate = ee.FeatureCollection('ft:1fRY18cjsHzDgGiJiS2nnpUU3v9JPDc2HNaR7Xk8');//us state vector
// var worldmap = ee.FeatureCollection('USDOS/LSIB_SIMPLE/2017'); //not political right, 
// var worldmap = ee.FeatureCollection('users/fsn1995/UIA_World_Countries_Boundaries');
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

//-------------------------------------------------------------------------//
// LUCC: This part will import and display the lucc info in the study area //
//-------------------------------------------------------------------------//

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

//-------------------------------------------------------------------------//
//                       corrmap display with lucc                         //
//-------------------------------------------------------------------------//
var corrmap = ee.Image("users/fsn1995/corrmap") // change your asset name here
                .addBands(lucc.select('landcover').rename('lucc'));
var corrParams = {min: -1, max: 1, palette: ['red','white', 'green']};
Map.addLayer(corrmap.select('correlation'), corrParams, 'Correlation Map');

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