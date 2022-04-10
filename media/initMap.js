const userSettings = JSON.parse(document.getElementById('vscode-3dviewer-data').getAttribute('data-settings'));
const fileToLoad = userSettings.fileToLoad;
var map = new ol.Map({
    target: 'map',
    view: new ol.View({
        center: ol.proj.fromLonLat([119, 37]),
        zoom: 4,
    }),
});
let currentBaseMap = '';
let basemaps = new Map();
// 矢量图
let vec_w = createVec_w();
// 中文注记
let cva_w = createCva_w();
// 影像图
let img_w = createImg_w();
// 地形图
let ter_w = createTer_w();

map.addLayer(vec_w);
map.addLayer(cva_w);
drawGeojson(fileToLoad);
currentBaseMap = 'vec_w';
// 将图层全部用Map存储起来
basemaps.set('vec_w', vec_w);
basemaps.set('img_w', img_w);
basemaps.set('ter_w', ter_w);

// 底图切换事件
var toggleDom = document.getElementById('toggle');
toggleDom.onclick = function (evt) {
    var ev = ev || window.event;
    var target = ev.target || ev.srcElement;
    if (target.nodeName.toLocaleLowerCase() == 'img') {
        switch (target.name) {
        case 'vec':
            handleLayer('vec_w');
            break;
        case 'img':
            handleLayer('img_w');
            break;
        case 'ter':
            handleLayer('ter_w');
            break;
        default:
            break;
        }
    }
};
// 移除上个图层，添加要切换的图层
function handleLayer(type) {
    if (currentBaseMap === type) {
        return;
}
map.removeLayer(basemaps.get(currentBaseMap));
map.addLayer(basemaps.get(type));
currentBaseMap = type;
}
// 创建矢量底图
function createVec_w() {
    var layer = new ol.layer.Tile({
        source: new ol.source.XYZ({
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        }),
        title: 'ESRI影像',
        zIndex: 0,
    });
    return layer;
}
// 创建标注图层
function createCva_w() {
    var source = new ol.source.XYZ({
        url: 'http://t1.tianditu.com/DataServer?T=cva_w&tk=81b9a9cf3e4be1df181e7bf54c5949fc&x={x}&y={y}&l={z}',
    });
    var layer = new ol.layer.Tile({
        id: 'tileLayer',
        title: '标注图层',
        layerName: 'baseMap',
        source: source,
        zIndex: 1,
    });
    return layer;
}
// 创建影像底图
function createImg_w() {
    var source = new ol.source.XYZ({
        url: 'http://t1.tianditu.com/DataServer?T=img_w&tk=81b9a9cf3e4be1df181e7bf54c5949fc&x={x}&y={y}&l={z}',
    });
    var layer = new ol.layer.Tile({
        id: 'tileLayer',
        title: '影像底图',
        layerName: 'baseMap',
        source: source,
        zIndex: 0,
    });
    return layer;
}
// 创建地形底图
function createTer_w() {
    var source = new ol.source.XYZ({
        url: 'http://t1.tianditu.com/DataServer?T=ter_w&tk=81b9a9cf3e4be1df181e7bf54c5949fc&x={x}&y={y}&l={z}',
    });
    var layer = new ol.layer.Tile({
        id: 'tileLayer',
        title: '地形',
        layerName: 'baseMap',
        source: source,
        zIndex: 0,
    });
    return layer;
}

//加载geojson数据
function renderGeojson(path) {
    var layer = new ol.layer.Vector({
        title: 'geojson图层',
        zIndex: 1,
        source: new ol.source.Vector({
        url: path,
        format: new ol.format.GeoJSON({
            dataProjection: 'EPSG:4326',
            featureProjection: 'EPSG:3857',
        }),
        }),
    });
        map.addLayer(layer);
}

    function drawGeojson(url) {
        fetch(url)
            .then(function (response) {
            return response.json();
            })
            .then(function (featureJson) {
                let vectorSource = new ol.source.Vector({
                    features: new ol.format.GeoJSON({
                    dataProjection: 'EPSG:4326',
                    featureProjection: 'EPSG:3857',
                    }).readFeatures(featureJson),
                });
                let vectorLayer = new ol.layer.Vector({
                    source: vectorSource,
                    zIndex: 1,
                    // projection: 'EPSG:3857',
                    style: function (feature) {
                    return new ol.style.Style({
                        fill: new ol.style.Fill({
                        color: 'rgba(37,241,239,0.2)',
                        }),
                        stroke: new ol.style.Stroke({
                        color: '#264df6',
                        width: 2,
                        }),
                    });
                    },
                });
                map.addLayer(vectorLayer);
                
                // map.getView().fit(vectorLayer.getExtent())
                map.getView().fit(vectorSource.getExtent())
            });
    }
            
