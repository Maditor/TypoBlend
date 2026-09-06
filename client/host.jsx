#target photoshop
// ============================================================
//  TypoBlend – CEP Host Script
//  Tái tạo Layer Style / Blending Options của Photoshop dưới dạng
//  panel "sống": Sync đọc fx từ layer đang chọn, Apply ghi đè xuống
//  layer đang chọn (1 hoặc nhiều), không cần mở/đóng dialog Layer Style.
// ============================================================

// ---------- JSON polyfill (phòng khi engine cũ) ----------
if (typeof JSON === "undefined") { JSON = {}; }
if (typeof JSON.parse !== "function") {
    JSON.parse = function (s) { return eval('(' + s + ')'); };
}
if (typeof JSON.stringify !== "function") {
    JSON.stringify = function (obj) {
        if (obj === null || obj === undefined) return "null";
        if (typeof obj === "number" || typeof obj === "boolean") return obj.toString();
        if (typeof obj === "string") {
            return '"' + obj.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n") + '"';
        }
        if (obj instanceof Array) {
            var arr = [];
            for (var i = 0; i < obj.length; i++) arr.push(JSON.stringify(obj[i]));
            return "[" + arr.join(",") + "]";
        }
        var str = [];
        for (var key in obj) { if (obj.hasOwnProperty(key)) str.push('"' + key + '":' + JSON.stringify(obj[key])); }
        return "{" + str.join(",") + "}";
    };
}

// ---------- Helpers ngắn gọn ----------
function sID(s) { return stringIDToTypeID(s); }
function cID(s) { return charIDToTypeID(s); }
function num(v, def) { v = parseFloat(v); return isNaN(v) ? def : v; }

// ---------- Bảng map Blend Mode (DOM layer.blendMode) ----------
var LAYER_BLEND_MAP = {
    normal: BlendMode.NORMAL, dissolve: BlendMode.DISSOLVE, darken: BlendMode.DARKEN, multiply: BlendMode.MULTIPLY,
    colorBurn: BlendMode.COLORBURN, linearBurn: BlendMode.LINEARBURN, darkerColor: BlendMode.DARKERCOLOR,
    lighten: BlendMode.LIGHTEN, screen: BlendMode.SCREEN, colorDodge: BlendMode.COLORDODGE, linearDodge: BlendMode.LINEARDODGE,
    lighterColor: BlendMode.LIGHTERCOLOR, overlay: BlendMode.OVERLAY, softLight: BlendMode.SOFTLIGHT, hardLight: BlendMode.HARDLIGHT,
    vividLight: BlendMode.VIVIDLIGHT, linearLight: BlendMode.LINEARLIGHT, pinLight: BlendMode.PINLIGHT, hardMix: BlendMode.HARDMIX,
    difference: BlendMode.DIFFERENCE, exclusion: BlendMode.EXCLUSION, subtract: BlendMode.SUBTRACT, divide: BlendMode.DIVIDE,
    hue: BlendMode.HUE, saturation: BlendMode.SATURATION, color: BlendMode.COLORBLEND, luminosity: BlendMode.LUMINOSITY
};
var BLEND_MODE_REVERSE = {};
for (var _k in LAYER_BLEND_MAP) { if (LAYER_BLEND_MAP.hasOwnProperty(_k)) BLEND_MODE_REVERSE[String(LAYER_BLEND_MAP[_k])] = _k; }

// ============================================================
//  LAYER / SELECTION HELPERS
// ============================================================
function getActiveLayer() {
    if (!app.documents.length) return null;
    try { return app.activeDocument.activeLayer; } catch (e) { return null; }
}

function getActiveLayerId() {
    try {
        if (!app.documents.length) return "NONE";
        return String(app.activeDocument.activeLayer.id);
    } catch (e) { return "NONE"; }
}

function docState() {
    try {
        if (!app.documents.length) return "NO_DOC";
        if (!app.activeDocument.activeLayer) return "NO_LAYER";
        return "OK";
    } catch (e) { return "NO_DOC"; }
}

function getSelectedLayersIDs() {
    var ids = [];
    try {
        var ref = new ActionReference();
        ref.putProperty(sID("property"), sID("targetLayersIDs"));
        ref.putEnumerated(sID("document"), sID("ordinal"), sID("targetEnum"));
        var desc = executeActionGet(ref);
        var list = desc.getList(sID("targetLayersIDs"));
        for (var i = 0; i < list.count; i++) ids.push(list.getReference(i).getIdentifier());
    } catch (e) {
        try { ids.push(app.activeDocument.activeLayer.id); } catch (e2) {}
    }
    return ids;
}

function selectLayerByID(id) {
    var ref = new ActionReference();
    ref.putIdentifier(cID("Lyr "), id);
    var desc = new ActionDescriptor();
    desc.putReference(cID("null"), ref);
    desc.putBoolean(cID("MkVs"), false);
    executeAction(cID("slct"), desc, DialogModes.NO);
}

function selectLayersByIDs(ids) {
    for (var i = 0; i < ids.length; i++) {
        var desc = new ActionDescriptor();
        var ref = new ActionReference();
        ref.putIdentifier(cID("Lyr "), ids[i]);
        desc.putReference(cID("null"), ref);
        desc.putBoolean(sID("makeVisible"), false);
        desc.putEnumerated(sID("selectionModifier"), sID("selectionModifierType"),
            i === 0 ? sID("replaceSelection") : sID("addToSelection"));
        executeAction(cID("slct"), desc, DialogModes.NO);
    }
}

function getCurrentLayerEffects() {
    try {
        if (!app.documents.length) return null;
        var ref = new ActionReference();
        ref.putEnumerated(cID("Lyr "), cID("Ordn"), cID("Trgt"));
        var desc = executeActionGet(ref);
        var fxKey = sID("layerEffects");
        if (desc.hasKey(fxKey)) return desc.getObjectValue(fxKey);
        return null;
    } catch (e) { return null; }
}

// ============================================================
//  COLOR / GRADIENT HELPERS
// ============================================================
function colorDesc(c) {
    var d = new ActionDescriptor();
    d.putDouble(sID("red"), c.r);
    d.putDouble(sID("green"), c.g);
    d.putDouble(sID("blue"), c.b);
    return d;
}

// Gradient nhiều màu (tối thiểu 2 stop, không giới hạn số lượng)
function buildGradientColorObject(stops) {
    if (!stops || stops.length < 2) stops = [{ pos: 0, r: 0, g: 0, b: 0 }, { pos: 100, r: 255, g: 255, b: 255 }];
    var sorted = stops.slice().sort(function (a, b) { return a.pos - b.pos; });

    var grad = new ActionDescriptor();
    grad.putString(sID("name"), "Custom");
    grad.putEnumerated(sID("gradientForm"), sID("gradientForm"), sID("customStops"));
    grad.putInteger(sID("interfaceIconFrameDimmed"), 4096);

    var colorList = new ActionList();
    for (var i = 0; i < sorted.length; i++) {
        var st = sorted[i];
        var stopDesc = new ActionDescriptor();
        stopDesc.putObject(sID("color"), sID("RGBColor"), colorDesc(st));
        stopDesc.putEnumerated(sID("type"), sID("colorStopType"), sID("userStop"));
        stopDesc.putInteger(sID("location"), Math.round((st.pos / 100) * 4096));
        stopDesc.putInteger(sID("midpoint"), 50);
        colorList.putObject(sID("colorStop"), stopDesc);
    }
    grad.putList(sID("colors"), colorList);

    var transList = new ActionList();
    for (var j = 0; j < sorted.length; j++) {
        var ts = new ActionDescriptor();
        var op = (sorted[j].opacity === undefined || sorted[j].opacity === null) ? 100 : sorted[j].opacity;
        ts.putUnitDouble(sID("opacity"), sID("percentUnit"), op);
        ts.putInteger(sID("location"), Math.round((sorted[j].pos / 100) * 4096));
        ts.putInteger(sID("midpoint"), 50);
        transList.putObject(sID("transferSpec"), ts);
    }
    grad.putList(sID("transparency"), transList);
    return grad;
}

function readGradientStops(gradObj) {
    var stops = [];
    try {
        var colorList = gradObj.getList(sID("colors"));
        var transList = null;
        try { transList = gradObj.getList(sID("transparency")); } catch (e) {}
        for (var i = 0; i < colorList.count; i++) {
            var stopDesc = colorList.getObjectValue(i);
            var c = stopDesc.getObjectValue(sID("color"));
            var loc = stopDesc.getInteger(sID("location"));
            var op = 100;
            if (transList) {
                try {
                    for (var j = 0; j < transList.count; j++) {
                        var ts = transList.getObjectValue(j);
                        if (ts.getInteger(sID("location")) === loc) { op = ts.getUnitDoubleValue(sID("opacity")); break; }
                    }
                } catch (e2) {}
            }
            stops.push({
                pos: Math.round((loc / 4096) * 100),
                r: Math.round(c.getDouble(sID("red"))),
                g: Math.round(c.getDouble(sID("green"))),
                b: Math.round(c.getDouble(sID("blue"))),
                opacity: Math.round(op)
            });
        }
    } catch (e) {}
    if (stops.length < 2) stops = [{ pos: 0, r: 0, g: 0, b: 0, opacity: 100 }, { pos: 100, r: 255, g: 255, b: 255, opacity: 100 }];
    return stops;
}

// ============================================================
//  ĐỌC GIÁ TRỊ TỪ ACTIONDESCRIPTOR
// ============================================================
function enumStr(desc, key) {
    try { return typeIDToStringID(desc.getEnumerationValue(sID(key))); } catch (e) { return null; }
}
function getColorVal(desc, key) {
    try {
        var c = desc.getObjectValue(sID(key));
        return { r: Math.round(c.getDouble(sID("red"))), g: Math.round(c.getDouble(sID("green"))), b: Math.round(c.getDouble(sID("blue"))) };
    } catch (e) { return null; }
}
function getNumVal(desc, key) {
    try { return desc.getUnitDoubleValue(sID(key)); } catch (e) {
        try { return desc.getDouble(sID(key)); } catch (e2) { return null; }
    }
}
function getBoolVal(desc, key) {
    try { return desc.getBoolean(sID(key)); } catch (e) { return false; }
}

// ============================================================
//  TẠO DESCRIPTOR CHO TỪNG EFFECT (giống hệt nhóm field trong
//  dialog Layer Style của Photoshop)
// ============================================================

// ----- Gradient Overlay -----
function createGradientOverlayDescriptor(d) {
    var gf = new ActionDescriptor();
    gf.putBoolean(sID("enabled"), true);
    gf.putBoolean(sID("present"), true);
    gf.putBoolean(sID("showInDialog"), true);
    gf.putEnumerated(sID("mode"), sID("blendMode"), sID(d.blendMode || "normal"));
    gf.putUnitDouble(sID("opacity"), sID("percentUnit"), num(d.opacity, 100));
    gf.putUnitDouble(sID("angle"), sID("angleUnit"), num(d.angle, 90));
    gf.putEnumerated(sID("type"), sID("gradientType"), sID(d.style || "linear"));
    gf.putBoolean(sID("reverse"), !!d.reverse);
    gf.putBoolean(sID("dither"), d.dither !== false);
    gf.putBoolean(sID("align"), d.align !== false);
    gf.putUnitDouble(sID("scale"), sID("percentUnit"), num(d.scale, 100));
    gf.putObject(sID("gradient"), sID("gradientClassEvent"), buildGradientColorObject(d.stops));
    return gf;
}

// ----- Stroke -----
function createStrokeDescriptor(d) {
    var st = new ActionDescriptor();
    st.putBoolean(sID("enabled"), true);
    st.putBoolean(sID("present"), true);
    st.putBoolean(sID("showInDialog"), true);
    st.putEnumerated(sID("style"), sID("frameStyle"), sID(d.position || "outsetFrame"));
    st.putEnumerated(sID("mode"), sID("blendMode"), sID(d.blendMode || "normal"));
    st.putUnitDouble(sID("opacity"), sID("percentUnit"), num(d.opacity, 100));
    st.putUnitDouble(sID("size"), sID("pixelsUnit"), num(d.size, 3));
    st.putBoolean(sID("overprint"), false);

    if (d.paintType === "gradient") {
        st.putEnumerated(sID("paintType"), sID("frameFill"), sID("gradientFill"));
        var g = d.gradient || {};
        st.putBoolean(sID("reverse"), !!g.reverse);
        st.putBoolean(sID("align"), g.align !== false);
        st.putUnitDouble(sID("angle"), sID("angleUnit"), num(g.angle, 0));
        st.putEnumerated(sID("type"), sID("gradientType"), sID(g.style || "linear"));
        st.putUnitDouble(sID("scale"), sID("percentUnit"), num(g.scale, 100));
        st.putObject(sID("gradient"), sID("gradientClassEvent"), buildGradientColorObject(g.stops));
    } else {
        st.putEnumerated(sID("paintType"), sID("frameFill"), sID("solidColor"));
        st.putObject(sID("color"), sID("RGBColor"), colorDesc(d.color || { r: 255, g: 255, b: 255 }));
    }
    return st;
}

// ----- Drop Shadow / Inner Shadow (cùng cấu trúc field) -----
function createShadowDescriptor(d) {
    var desc = new ActionDescriptor();
    desc.putBoolean(sID("enabled"), true);
    desc.putBoolean(sID("present"), true);
    desc.putBoolean(sID("showInDialog"), true);
    desc.putEnumerated(sID("mode"), sID("blendMode"), sID(d.blendMode || "multiply"));
    desc.putUnitDouble(sID("opacity"), sID("percentUnit"), num(d.opacity, 75));
    desc.putBoolean(sID("useGlobalAngle"), d.useGlobalLight !== false);
    desc.putUnitDouble(sID("localLightingAngle"), sID("angleUnit"), num(d.angle, 120));
    desc.putUnitDouble(sID("distance"), sID("pixelsUnit"), num(d.distance, 5));
    desc.putUnitDouble(sID("chokeMatte"), sID("percentUnit"), num(d.choke, 0));
    desc.putUnitDouble(sID("blur"), sID("pixelsUnit"), num(d.size, 5));
    desc.putObject(sID("color"), sID("RGBColor"), colorDesc(d.color || { r: 0, g: 0, b: 0 }));
    return desc;
}

// ----- Outer Glow -----
function createOuterGlowDescriptor(d) {
    var og = new ActionDescriptor();
    og.putBoolean(sID("enabled"), true);
    og.putBoolean(sID("present"), true);
    og.putBoolean(sID("showInDialog"), true);
    og.putEnumerated(sID("mode"), sID("blendMode"), sID(d.blendMode || "screen"));
    og.putUnitDouble(sID("opacity"), sID("percentUnit"), num(d.opacity, 75));
    og.putEnumerated(sID("glowTechnique"), sID("matteTechnique"), sID(d.technique || "softMatte"));
    og.putUnitDouble(sID("chokeMatte"), sID("pixelsUnit"), num(d.choke, 0));
    og.putUnitDouble(sID("blur"), sID("pixelsUnit"), num(d.size, 20));
    og.putUnitDouble(sID("noise"), sID("percentUnit"), num(d.noise, 0));
    og.putBoolean(sID("antiAlias"), false);
    og.putUnitDouble(sID("inputRange"), sID("percentUnit"), num(d.range, 50));
    og.putObject(sID("color"), sID("RGBColor"), colorDesc(d.color || { r: 255, g: 190, b: 0 }));
    return og;
}

// ----- Inner Glow -----
function createInnerGlowDescriptor(d) {
    var ig = new ActionDescriptor();
    ig.putBoolean(sID("enabled"), true);
    ig.putBoolean(sID("present"), true);
    ig.putBoolean(sID("showInDialog"), true);
    ig.putEnumerated(sID("mode"), sID("blendMode"), sID(d.blendMode || "screen"));
    ig.putUnitDouble(sID("opacity"), sID("percentUnit"), num(d.opacity, 75));
    ig.putEnumerated(sID("glowTechnique"), sID("matteTechnique"), sID(d.technique || "softMatte"));
    ig.putUnitDouble(sID("chokeMatte"), sID("pixelsUnit"), num(d.choke, 0));
    ig.putUnitDouble(sID("blur"), sID("pixelsUnit"), num(d.size, 10));
    ig.putUnitDouble(sID("inputRange"), sID("percentUnit"), num(d.range, 50));
    ig.putBoolean(sID("antiAlias"), false);
    ig.putObject(sID("color"), sID("RGBColor"), colorDesc(d.color || { r: 255, g: 255, b: 181 }));
    return ig;
}

// ----- Satin (tên nội bộ Photoshop: chromeFX) -----
function createSatinDescriptor(d) {
    var s = new ActionDescriptor();
    s.putBoolean(sID("enabled"), true);
    s.putBoolean(sID("present"), true);
    s.putBoolean(sID("showInDialog"), true);
    s.putEnumerated(sID("mode"), sID("blendMode"), sID(d.blendMode || "multiply"));
    s.putObject(sID("color"), sID("RGBColor"), colorDesc(d.color || { r: 0, g: 0, b: 0 }));
    s.putUnitDouble(sID("opacity"), sID("percentUnit"), num(d.opacity, 50));
    s.putUnitDouble(sID("localLightingAngle"), sID("angleUnit"), num(d.angle, 19));
    s.putUnitDouble(sID("distance"), sID("pixelsUnit"), num(d.distance, 11));
    s.putUnitDouble(sID("blur"), sID("pixelsUnit"), num(d.size, 14));
    s.putBoolean(sID("invert"), d.invert !== false);
    s.putBoolean(sID("antialiasGloss"), !!d.antiAlias);
    return s;
}

// ----- Color Overlay (tên nội bộ: solidFill) -----
function createColorOverlayDescriptor(d) {
    var c = new ActionDescriptor();
    c.putBoolean(sID("enabled"), true);
    c.putBoolean(sID("present"), true);
    c.putBoolean(sID("showInDialog"), true);
    c.putEnumerated(sID("mode"), sID("blendMode"), sID(d.blendMode || "normal"));
    c.putObject(sID("color"), sID("RGBColor"), colorDesc(d.color || { r: 255, g: 0, b: 0 }));
    c.putUnitDouble(sID("opacity"), sID("percentUnit"), num(d.opacity, 100));
    return c;
}

// ----- Bevel & Emboss -----
function createBevelEmbossDescriptor(d) {
    var b = new ActionDescriptor();
    b.putBoolean(sID("enabled"), true);
    b.putBoolean(sID("present"), true);
    b.putBoolean(sID("showInDialog"), true);
    b.putEnumerated(sID("bevelStyle"), sID("bevelEmbossStyle"), sID(d.style || "innerBevel"));
    b.putEnumerated(sID("bevelTechnique"), sID("bevelTechnique"), sID(d.technique || "smoothTechnique"));
    b.putUnitDouble(sID("strengthRatio"), sID("percentUnit"), num(d.depth, 100));
    b.putEnumerated(sID("bevelDirection"), sID("bevelEmbossDirection"), sID(d.direction || "in"));
    b.putUnitDouble(sID("blur"), sID("pixelsUnit"), num(d.size, 5));
    b.putUnitDouble(sID("softness"), sID("pixelsUnit"), num(d.soften, 0));
    b.putBoolean(sID("useGlobalAngle"), d.useGlobalLight !== false);
    b.putUnitDouble(sID("localLightingAngle"), sID("angleUnit"), num(d.angle, 120));
    b.putUnitDouble(sID("localLightingAltitude"), sID("angleUnit"), num(d.altitude, 30));
    b.putBoolean(sID("antialiasGloss"), !!d.antiAlias);
    b.putEnumerated(sID("highlightMode"), sID("blendMode"), sID(d.highlightMode || "screen"));
    b.putObject(sID("highlightColor"), sID("RGBColor"), colorDesc(d.highlightColor || { r: 255, g: 255, b: 255 }));
    b.putUnitDouble(sID("highlightOpacity"), sID("percentUnit"), num(d.highlightOpacity, 75));
    b.putEnumerated(sID("shadowMode"), sID("blendMode"), sID(d.shadowMode || "multiply"));
    b.putObject(sID("shadowColor"), sID("RGBColor"), colorDesc(d.shadowColor || { r: 0, g: 0, b: 0 }));
    b.putUnitDouble(sID("shadowOpacity"), sID("percentUnit"), num(d.shadowOpacity, 75));
    return b;
}

// ============================================================
//  ÁP DỤNG (APPLY) – GHI ĐÈ TOÀN BỘ FX THEO TRẠNG THÁI PANEL
// ============================================================
function _buildEffectsDescriptor(data) {
    var effDesc = new ActionDescriptor();
    effDesc.putUnitDouble(sID("scale"), sID("percentUnit"), 100.0);

    if (data.bevelEmboss && data.bevelEmboss.enabled) effDesc.putObject(sID("bevelEmboss"), sID("bevelEmboss"), createBevelEmbossDescriptor(data.bevelEmboss));
    if (data.stroke && data.stroke.enabled) effDesc.putObject(sID("frameFX"), sID("frameFX"), createStrokeDescriptor(data.stroke));
    if (data.innerShadow && data.innerShadow.enabled) effDesc.putObject(sID("innerShadow"), sID("innerShadow"), createShadowDescriptor(data.innerShadow));
    if (data.innerGlow && data.innerGlow.enabled) effDesc.putObject(sID("innerGlow"), sID("innerGlow"), createInnerGlowDescriptor(data.innerGlow));
    if (data.satin && data.satin.enabled) effDesc.putObject(sID("chromeFX"), sID("chromeFX"), createSatinDescriptor(data.satin));
    if (data.colorOverlay && data.colorOverlay.enabled) effDesc.putObject(sID("solidFill"), sID("solidFill"), createColorOverlayDescriptor(data.colorOverlay));
    if (data.gradientOverlay && data.gradientOverlay.enabled) effDesc.putObject(sID("gradientFill"), sID("gradientFill"), createGradientOverlayDescriptor(data.gradientOverlay));
    if (data.outerGlow && data.outerGlow.enabled) effDesc.putObject(sID("outerGlow"), sID("outerGlow"), createOuterGlowDescriptor(data.outerGlow));
    if (data.dropShadow && data.dropShadow.enabled) effDesc.putObject(sID("dropShadow"), sID("dropShadow"), createShadowDescriptor(data.dropShadow));

    return effDesc;
}

function applyBlendingOptionsToLayer(blending) {
    if (!blending) return;
    try {
        var layer = app.activeDocument.activeLayer;
        if (blending.blendMode && LAYER_BLEND_MAP[blending.blendMode]) layer.blendMode = LAYER_BLEND_MAP[blending.blendMode];
        if (blending.opacity !== undefined && blending.opacity !== null) layer.opacity = num(blending.opacity, 100);
        if (blending.fillOpacity !== undefined && blending.fillOpacity !== null) layer.fillOpacity = num(blending.fillOpacity, 100);
    } catch (e) {}
}

// Xoá hẳn property layerEffects hiện có (nếu có) trước khi ghi lại — bắt buộc
// phải làm bước này vì lệnh "set" (setd) của Photoshop GỘP vào object cũ chứ
// không thay thế hoàn toàn, nên nếu chỉ "set" một effDesc mới/rỗng thì các
// effect cũ không có trong đó vẫn còn nguyên (đây là lý do nút Clear trước
// đây không xoá được, và vì sao tắt 1 effect rồi Apply có thể không gỡ hẳn).
function deleteLayerEffectsIfExists() {
    try {
        var ref = new ActionReference();
        ref.putProperty(cID("Prpr"), sID("layerEffects"));
        ref.putEnumerated(cID("Lyr "), cID("Ordn"), cID("Trgt"));
        var desc = new ActionDescriptor();
        desc.putReference(cID("null"), ref);
        executeAction(cID("Dlt "), desc, DialogModes.NO);
    } catch (e) {
        // Layer vốn không có fx nào sẵn -> không có gì để xoá, bỏ qua.
    }
}

function _applyFX(data) {
    deleteLayerEffectsIfExists();
    var effDesc = _buildEffectsDescriptor(data);
    var setDesc = new ActionDescriptor();
    var ref = new ActionReference();
    ref.putEnumerated(cID("Lyr "), cID("Ordn"), cID("Trgt"));
    setDesc.putReference(cID("null"), ref);
    var layerDesc = new ActionDescriptor();
    layerDesc.putObject(sID("layerEffects"), sID("layerEffects"), effDesc);
    setDesc.putObject(cID("T   "), cID("Lyr "), layerDesc);
    executeAction(cID("setd"), setDesc, DialogModes.NO);

    if (data.blending) applyBlendingOptionsToLayer(data.blending);
    app.refresh();
    return "OK";
}

function applyFXFromJSON(jsonStr) {
    try {
        var data = (typeof jsonStr === "string") ? JSON.parse(jsonStr) : jsonStr;
        if (!data) return "NO_DATA";
        if (!app.documents.length) return "NO_DOC";
        if (!getActiveLayer()) return "NO_LAYER";
        return _applyFX(data);
    } catch (e) { return "ERROR:" + e.message; }
}

// ----- Style tạm để nhân bản fx cho nhiều layer cùng lúc -----
function makeTempStyle(name) {
    var desc = new ActionDescriptor();
    var ref = new ActionReference();
    ref.putClass(sID("style"));
    desc.putReference(cID("null"), ref);
    desc.putString(cID("Nm  "), name);
    var fromRef = new ActionReference();
    fromRef.putEnumerated(cID("Lyr "), cID("Ordn"), cID("Trgt"));
    desc.putReference(sID("using"), fromRef);
    desc.putBoolean(sID("blendOptions"), false);
    desc.putBoolean(sID("layerEffects"), true);
    desc.putBoolean(sID("pushToDesignLibraries"), false);
    executeAction(cID("Mk  "), desc, DialogModes.NO);
}
function applyTempStyle(name) {
    var desc = new ActionDescriptor();
    var ref = new ActionReference();
    ref.putName(sID("style"), name);
    desc.putReference(cID("null"), ref);
    var toRef = new ActionReference();
    toRef.putEnumerated(cID("Lyr "), cID("Ordn"), cID("Trgt"));
    desc.putReference(sID("to"), toRef);
    desc.putBoolean(sID("group"), true);
    executeAction(sID("applyStyle"), desc, DialogModes.NO);
}
function deleteTempStyle(name) {
    try {
        var desc = new ActionDescriptor();
        var ref = new ActionReference();
        ref.putName(sID("style"), name);
        desc.putReference(cID("null"), ref);
        executeAction(cID("Dlt "), desc, DialogModes.NO);
    } catch (e) {}
}

function applyFXToSelectedLayers(payloadStr) {
    try {
        if (!app.documents.length) return "NO_DOC";
        var doc = app.activeDocument;
        var originalLayer = doc.activeLayer;
        var selectedIds = getSelectedLayersIDs();
        if (selectedIds.length === 0) return "NO_LAYER";
        var payload = (typeof payloadStr === "string") ? JSON.parse(payloadStr) : payloadStr;
        if (!payload) return "NO_DATA";

        if (selectedIds.length === 1) {
            selectLayerByID(selectedIds[0]);
            _applyFX(payload);
            selectLayerByID(originalLayer.id);
            return "OK";
        }

        // Nhiều layer: build fx trên layer tạm rồi nhân bản bằng Layer Style,
        // Blend Mode/Opacity/Fill set riêng cho từng layer (đây là thuộc tính
        // cấp layer, không thuộc bộ layerEffects nên không copy được qua style).
        selectLayerByID(selectedIds[0]);
        var tempLayer = doc.activeLayer.duplicate(doc, ElementPlacement.PLACEATEND);
        tempLayer.name = "_blend_temp_fx";
        doc.activeLayer = tempLayer;
        deleteLayerEffectsIfExists();

        var effDesc = _buildEffectsDescriptor(payload);
        var setDesc = new ActionDescriptor();
        var ref = new ActionReference();
        ref.putEnumerated(cID("Lyr "), cID("Ordn"), cID("Trgt"));
        setDesc.putReference(cID("null"), ref);
        var layerDesc = new ActionDescriptor();
        layerDesc.putObject(sID("layerEffects"), sID("layerEffects"), effDesc);
        setDesc.putObject(cID("T   "), cID("Lyr "), layerDesc);
        executeAction(cID("setd"), setDesc, DialogModes.NO);

        var styleName = "_blend_fx_" + Number(new Date());
        makeTempStyle(styleName);
        selectLayersByIDs(selectedIds);
        applyTempStyle(styleName);
        doc.activeLayer = tempLayer;
        tempLayer.remove();
        deleteTempStyle(styleName);

        for (var i = 0; i < selectedIds.length; i++) {
            selectLayerByID(selectedIds[i]);
            applyBlendingOptionsToLayer(payload.blending);
        }

        selectLayerByID(originalLayer.id);
        app.refresh();
        return "OK";
    } catch (e) { return "ERROR: " + e.toString(); }
}

// ============================================================
//  ĐỌC FX TỪ LAYER ĐANG CHỌN (SYNC)
// ============================================================
function readShadowLike(desc) {
    return {
        enabled: true,
        blendMode: enumStr(desc, "mode") || "multiply",
        color: getColorVal(desc, "color") || { r: 0, g: 0, b: 0 },
        opacity: getNumVal(desc, "opacity") || 75,
        useGlobalLight: getBoolVal(desc, "useGlobalAngle"),
        angle: getNumVal(desc, "localLightingAngle") || 120,
        distance: getNumVal(desc, "distance") || 5,
        choke: getNumVal(desc, "chokeMatte") || 0,
        size: getNumVal(desc, "blur") || 5
    };
}

function getFXData() {
    try {
        if (!app.documents.length) return "NO_DOC";
        var layer = getActiveLayer();
        if (!layer) return "NO_LAYER";

        var out = {};
        out.layerName = layer.name;
        out.blending = {
            blendMode: BLEND_MODE_REVERSE[String(layer.blendMode)] || "normal",
            opacity: Math.round(layer.opacity),
            fillOpacity: Math.round(layer.fillOpacity)
        };

        var fx = getCurrentLayerEffects();
        if (fx) {
            if (fx.hasKey(sID("bevelEmboss"))) {
                var be = fx.getObjectValue(sID("bevelEmboss"));
                if (getBoolVal(be, "enabled")) {
                    out.bevelEmboss = {
                        enabled: true,
                        style: enumStr(be, "bevelStyle") || "innerBevel",
                        technique: enumStr(be, "bevelTechnique") || "smoothTechnique",
                        depth: getNumVal(be, "strengthRatio") || 100,
                        direction: enumStr(be, "bevelDirection") || "in",
                        size: getNumVal(be, "blur") || 5,
                        soften: getNumVal(be, "softness") || 0,
                        useGlobalLight: getBoolVal(be, "useGlobalAngle"),
                        angle: getNumVal(be, "localLightingAngle") || 120,
                        altitude: getNumVal(be, "localLightingAltitude") || 30,
                        antiAlias: getBoolVal(be, "antialiasGloss"),
                        highlightMode: enumStr(be, "highlightMode") || "screen",
                        highlightColor: getColorVal(be, "highlightColor") || { r: 255, g: 255, b: 255 },
                        highlightOpacity: getNumVal(be, "highlightOpacity") || 75,
                        shadowMode: enumStr(be, "shadowMode") || "multiply",
                        shadowColor: getColorVal(be, "shadowColor") || { r: 0, g: 0, b: 0 },
                        shadowOpacity: getNumVal(be, "shadowOpacity") || 75
                    };
                }
            }
            if (fx.hasKey(sID("frameFX"))) {
                var st = fx.getObjectValue(sID("frameFX"));
                if (getBoolVal(st, "enabled")) {
                    var paintTypeStr = enumStr(st, "paintType");
                    var strokeObj = {
                        enabled: true,
                        size: getNumVal(st, "size") || 3,
                        position: enumStr(st, "style") || "outsetFrame",
                        blendMode: enumStr(st, "mode") || "normal",
                        opacity: getNumVal(st, "opacity") || 100
                    };
                    if (paintTypeStr === "gradientFill") {
                        strokeObj.paintType = "gradient";
                        strokeObj.gradient = {
                            angle: getNumVal(st, "angle") || 0,
                            style: enumStr(st, "type") || "linear",
                            scale: getNumVal(st, "scale") || 100,
                            reverse: getBoolVal(st, "reverse"),
                            align: getBoolVal(st, "align"),
                            stops: readGradientStops(st.getObjectValue(sID("gradient")))
                        };
                    } else {
                        strokeObj.paintType = "solid";
                        strokeObj.color = getColorVal(st, "color") || { r: 255, g: 255, b: 255 };
                    }
                    out.stroke = strokeObj;
                }
            }
            if (fx.hasKey(sID("innerShadow"))) {
                var is_ = fx.getObjectValue(sID("innerShadow"));
                if (getBoolVal(is_, "enabled")) out.innerShadow = readShadowLike(is_);
            }
            if (fx.hasKey(sID("innerGlow"))) {
                var ig = fx.getObjectValue(sID("innerGlow"));
                if (getBoolVal(ig, "enabled")) {
                    out.innerGlow = {
                        enabled: true,
                        blendMode: enumStr(ig, "mode") || "screen",
                        opacity: getNumVal(ig, "opacity") || 75,
                        technique: enumStr(ig, "glowTechnique") || "softMatte",
                        choke: getNumVal(ig, "chokeMatte") || 0,
                        size: getNumVal(ig, "blur") || 10,
                        range: getNumVal(ig, "inputRange") || 50,
                        color: getColorVal(ig, "color") || { r: 255, g: 255, b: 181 }
                    };
                }
            }
            if (fx.hasKey(sID("chromeFX"))) {
                var sa = fx.getObjectValue(sID("chromeFX"));
                if (getBoolVal(sa, "enabled")) {
                    out.satin = {
                        enabled: true,
                        blendMode: enumStr(sa, "mode") || "multiply",
                        color: getColorVal(sa, "color") || { r: 0, g: 0, b: 0 },
                        opacity: getNumVal(sa, "opacity") || 50,
                        angle: getNumVal(sa, "localLightingAngle") || 19,
                        distance: getNumVal(sa, "distance") || 11,
                        size: getNumVal(sa, "blur") || 14,
                        invert: getBoolVal(sa, "invert")
                    };
                }
            }
            if (fx.hasKey(sID("solidFill"))) {
                var co = fx.getObjectValue(sID("solidFill"));
                if (getBoolVal(co, "enabled")) {
                    out.colorOverlay = {
                        enabled: true,
                        blendMode: enumStr(co, "mode") || "normal",
                        color: getColorVal(co, "color") || { r: 255, g: 0, b: 0 },
                        opacity: getNumVal(co, "opacity") || 100
                    };
                }
            }
            if (fx.hasKey(sID("gradientFill"))) {
                var gf = fx.getObjectValue(sID("gradientFill"));
                if (getBoolVal(gf, "enabled")) {
                    out.gradientOverlay = {
                        enabled: true,
                        blendMode: enumStr(gf, "mode") || "normal",
                        opacity: getNumVal(gf, "opacity") || 100,
                        angle: getNumVal(gf, "angle") || 90,
                        style: enumStr(gf, "type") || "linear",
                        scale: getNumVal(gf, "scale") || 100,
                        reverse: getBoolVal(gf, "reverse"),
                        align: getBoolVal(gf, "align"),
                        stops: readGradientStops(gf.getObjectValue(sID("gradient")))
                    };
                }
            }
            if (fx.hasKey(sID("outerGlow"))) {
                var og = fx.getObjectValue(sID("outerGlow"));
                if (getBoolVal(og, "enabled")) {
                    out.outerGlow = {
                        enabled: true,
                        blendMode: enumStr(og, "mode") || "screen",
                        opacity: getNumVal(og, "opacity") || 75,
                        technique: enumStr(og, "glowTechnique") || "softMatte",
                        noise: getNumVal(og, "noise") || 0,
                        choke: getNumVal(og, "chokeMatte") || 0,
                        size: getNumVal(og, "blur") || 20,
                        range: getNumVal(og, "inputRange") || 50,
                        color: getColorVal(og, "color") || { r: 255, g: 190, b: 0 }
                    };
                }
            }
            if (fx.hasKey(sID("dropShadow"))) {
                var ds = fx.getObjectValue(sID("dropShadow"));
                if (getBoolVal(ds, "enabled")) out.dropShadow = readShadowLike(ds);
            }
        }
        return JSON.stringify(out);
    } catch (e) { return "ERROR:" + e.message; }
}

// ============================================================
//  COPY / PASTE STYLE & CLEAR
// ============================================================
var _copiedEffects = null;
var _copiedBlending = null;

function copyBlendingStyle() {
    if (!app.documents.length) return "NO_DOC";
    var fx = getCurrentLayerEffects();
    if (!fx) return "NO_FX";
    _copiedEffects = fx;
    try {
        var layer = app.activeDocument.activeLayer;
        _copiedBlending = {
            blendMode: BLEND_MODE_REVERSE[String(layer.blendMode)] || "normal",
            opacity: Math.round(layer.opacity),
            fillOpacity: Math.round(layer.fillOpacity)
        };
    } catch (e) { _copiedBlending = null; }
    return "OK";
}

function hasCopiedStyle() { return _copiedEffects ? "1" : "0"; }

function pasteBlendingStyle() {
    if (!_copiedEffects || !app.documents.length) return "NO_FX";
    var doc = app.activeDocument;
    var originalLayer = doc.activeLayer;
    var ids = getSelectedLayersIDs();
    if (ids.length === 0) return "NO_LAYER";
    try {
        for (var i = 0; i < ids.length; i++) {
            selectLayerByID(ids[i]);
            deleteLayerEffectsIfExists();
            var setDesc = new ActionDescriptor();
            var ref = new ActionReference();
            ref.putEnumerated(cID("Lyr "), cID("Ordn"), cID("Trgt"));
            setDesc.putReference(cID("null"), ref);
            var layerDesc = new ActionDescriptor();
            layerDesc.putObject(sID("layerEffects"), sID("layerEffects"), _copiedEffects);
            setDesc.putObject(cID("T   "), cID("Lyr "), layerDesc);
            executeAction(cID("setd"), setDesc, DialogModes.NO);
            if (_copiedBlending) applyBlendingOptionsToLayer(_copiedBlending);
        }
        selectLayerByID(originalLayer.id);
        app.refresh();
        return "OK";
    } catch (e) { return "ERROR:" + e.toString(); }
}

// Danh sách toàn bộ key effect mà panel này quản lý (khớp với các key dùng
// trong _buildEffectsDescriptor ở trên).
var ALL_FX_KEYS = ["bevelEmboss", "frameFX", "innerShadow", "innerGlow", "chromeFX", "solidFill", "gradientFill", "outerGlow", "dropShadow"];

function clearBlendingFX() {
    try {
        if (!app.documents.length) return "NO_DOC";

        // Lớp 1: cố xoá hẳn property layerEffects (đúng kiểu "Clear Layer Style").
        deleteLayerEffectsIfExists();

        // Lớp 2: dù lớp 1 có ăn hay không, vẫn set tường minh enabled=false cho
        // từng effect — đây là CÙNG cơ chế "setd" mà nút Apply đang dùng và chạy
        // đúng, nên chắc chắn hơn nhiều so với chỉ dựa vào lệnh xoá property.
        var effDesc = new ActionDescriptor();
        effDesc.putUnitDouble(sID("scale"), sID("percentUnit"), 100.0);
        for (var i = 0; i < ALL_FX_KEYS.length; i++) {
            var off = new ActionDescriptor();
            off.putBoolean(sID("enabled"), false);
            off.putBoolean(sID("present"), false);
            off.putBoolean(sID("showInDialog"), false);
            effDesc.putObject(sID(ALL_FX_KEYS[i]), sID(ALL_FX_KEYS[i]), off);
        }
        var setDesc = new ActionDescriptor();
        var ref = new ActionReference();
        ref.putEnumerated(cID("Lyr "), cID("Ordn"), cID("Trgt"));
        setDesc.putReference(cID("null"), ref);
        var layerDesc = new ActionDescriptor();
        layerDesc.putObject(sID("layerEffects"), sID("layerEffects"), effDesc);
        setDesc.putObject(cID("T   "), cID("Lyr "), layerDesc);
        executeAction(cID("setd"), setDesc, DialogModes.NO);

        app.refresh();
        return "OK";
    } catch (e) { return "ERROR:" + e.toString(); }
}

// ============================================================
//  COLOR PICKER (dùng chung, giống TypoCore)
// ============================================================
function pickColor(r, g, b) {
    try {
        var c = new SolidColor();
        c.rgb.red = r; c.rgb.green = g; c.rgb.blue = b;
        app.foregroundColor = c;
        var ok = app.showColorPicker();
        if (!ok) return "CANCEL";
        var fg = app.foregroundColor.rgb;
        return JSON.stringify({ r: Math.round(fg.red), g: Math.round(fg.green), b: Math.round(fg.blue) });
    } catch (e) { return "ERROR:" + e.message; }
}

var _typoBlendingHostLoaded = true;
