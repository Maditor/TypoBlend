// ============================================================
//  TypoBlend – Panel logic
// ============================================================
var cs = null;
var csInitErrorReason = "";

if (window.__csLoadFailed) {
    // <script src="CSInterface.js"> bắn lỗi onerror -> file không tồn tại
    // hoặc sai đường dẫn (404), trình duyệt còn chưa kịp chạy được dòng nào bên trong.
    var _csScriptTag = document.querySelector('script[src*="CSInterface"]');
    var _csResolvedUrl = _csScriptTag ? _csScriptTag.src : "CSInterface.js";
    csInitErrorReason = "Không tìm thấy CSInterface.js (404). Đường dẫn panel đang cố load: " + _csResolvedUrl;
} else if (typeof CSInterface === "undefined") {
    // File load được (không 404) nhưng nội dung không định nghĩa ra class CSInterface
    // -> khả năng file bị rỗng/hỏng/sai nội dung (không đúng file gốc của Adobe).
    csInitErrorReason = "File CSInterface.js đã load nhưng không hợp lệ (không định nghĩa CSInterface) — kiểm tra lại đúng nội dung file gốc.";
} else {
    try {
        cs = new CSInterface();
    } catch (e) {
        // Không throw ở đây nữa để phần còn lại của UI (dropdown, màu, nút bấm) vẫn dựng lên
        // bình thường — chỉ riêng các thao tác cần giao tiếp với Photoshop sẽ báo lỗi rõ ràng.
        cs = null;
        csInitErrorReason = "Lỗi khi khởi tạo CSInterface: " + (e && e.message ? e.message : e);
    }
}

function $(id) { return document.getElementById(id); }
function on(id, ev, fn) { var el = $(id); if (el) el.addEventListener(ev, fn); }
function val(id) { var el = $(id); return el ? el.value : ""; }
function numv(id) { var el = $(id); var v = parseFloat(el ? el.value : NaN); return isNaN(v) ? 0 : v; }
function checked(id) { var el = $(id); return !!(el && el.checked); }
function swatch(id) { return getSwatchColor($(id)) || { r: 0, g: 0, b: 0 }; }
function isEnabled(fx) { var cb = document.querySelector('.bo-enable[data-fx="' + fx + '"]'); return !!(cb && cb.checked); }
function setDefault(id, v) { var el = $(id); if (el) el.value = v; }

var bevelAngleDial, innerShadowAngleDial, satinAngleDial, strokeGradAngleDial, gradOverlayAngleDial, dropShadowAngleDial;
var gradOverlayEditor, strokeGradEditor;
var lastLayerId = null;
var autoSyncInterval = null;

// ============================================================
//  BLEND MODE LIST
// ============================================================
var BLEND_MODES = [
    ["normal", "Normal"], ["dissolve", "Dissolve"],
    ["darken", "Darken"], ["multiply", "Multiply"], ["colorBurn", "Color Burn"], ["linearBurn", "Linear Burn"], ["darkerColor", "Darker Color"],
    ["lighten", "Lighten"], ["screen", "Screen"], ["colorDodge", "Color Dodge"], ["linearDodge", "Linear Dodge (Add)"], ["lighterColor", "Lighter Color"],
    ["overlay", "Overlay"], ["softLight", "Soft Light"], ["hardLight", "Hard Light"], ["vividLight", "Vivid Light"], ["linearLight", "Linear Light"], ["pinLight", "Pin Light"], ["hardMix", "Hard Mix"],
    ["difference", "Difference"], ["exclusion", "Exclusion"], ["subtract", "Subtract"], ["divide", "Divide"],
    ["hue", "Hue"], ["saturation", "Saturation"], ["color", "Color"], ["luminosity", "Luminosity"]
];
function populateBlendSelects() {
    var html = BLEND_MODES.map(function (m) { return '<option value="' + m[0] + '">' + m[1] + '</option>'; }).join("");
    if ($("blendMode")) $("blendMode").innerHTML = html;
    document.querySelectorAll(".bo-select-blend").forEach(function (sel) { sel.innerHTML = html; });
}

// ============================================================
//  RANGE <-> NUMBER BINDING
// ============================================================
function bindRangeNumber(rangeId, numId) {
    var r = $(rangeId), n = $(numId);
    if (!r || !n) return;
    r.addEventListener("input", function () { n.value = r.value; });
    n.addEventListener("input", function () {
        var v = parseFloat(n.value);
        if (isNaN(v)) return;
        var min = parseFloat(r.min), max = parseFloat(r.max);
        r.value = Math.max(min, Math.min(max, v));
    });
}
function setRangeAndVal(rangeId, valId, v) {
    var r = $(rangeId), n = $(valId);
    if (n) n.value = Math.round(v);
    if (r) r.value = Math.max(parseFloat(r.min), Math.min(parseFloat(r.max), v));
}

// ============================================================
//  ANGLE DIAL (canvas kéo góc)
// ============================================================
function wireAngleDial(canvasId, inputId, onChange) {
    var canvas = $(canvasId), input = $(inputId);
    if (!canvas || !input) return null;
    canvas.width = 20; canvas.height = 20;
    var ctx = canvas.getContext("2d");

    function draw(deg) {
        var w = canvas.width, h = canvas.height, cx = w / 2, cy = h / 2, r = 7;
        ctx.clearRect(0, 0, w, h);
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, 2 * Math.PI);
        ctx.strokeStyle = "#888"; ctx.lineWidth = 1; ctx.stroke();
        var rad = deg * Math.PI / 180;
        var x = cx + r * Math.cos(rad), y = cy - r * Math.sin(rad);
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y);
        ctx.strokeStyle = "#f90"; ctx.lineWidth = 1.4; ctx.stroke();
    }
    function setFromRad(rad) {
        var deg = rad * 180 / Math.PI;
        if (deg > 180) deg -= 360;
        if (deg < -180) deg += 360;
        deg = Math.round(deg);
        input.value = deg;
        draw(deg);
        if (onChange) onChange(deg);
    }
    var dragging = false;
    function onMove(e) {
        if (!dragging) return;
        var rect = canvas.getBoundingClientRect();
        var cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
        setFromRad(Math.atan2(-(e.clientY - cy), e.clientX - cx));
    }
    function onUp() {
        dragging = false;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        scheduleAutoApply();
    }
    canvas.addEventListener("mousedown", function (e) {
        e.preventDefault(); dragging = true; onMove(e);
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
    });
    input.addEventListener("input", function () { draw(parseInt(input.value) || 0); if (onChange) onChange(parseInt(input.value) || 0); scheduleAutoApply(); });

    draw(parseInt(input.value) || 0);
    return { draw: draw };
}

// ============================================================
//  MÀU: SWATCH + COLOR PICKER
// ============================================================
function setSwatchColor(el, c) {
    if (!el) return;
    if (!c) { el.style.backgroundColor = "transparent"; el.removeAttribute("data-color"); return; }
    el.style.backgroundColor = "rgb(" + c.r + "," + c.g + "," + c.b + ")";
    el.setAttribute("data-color", JSON.stringify(c));
}
function getSwatchColor(el) {
    if (!el) return null;
    var d = el.getAttribute("data-color");
    if (!d) return null;
    try { return JSON.parse(d); } catch (e) { return null; }
}

// ============================================================
//  GRADIENT EDITOR (nhiều màu – khác TypoCore gốc chỉ có 2 màu)
// ============================================================
function interpolateColor(sortedStops, pos) {
    if (pos <= sortedStops[0].pos) return sortedStops[0];
    if (pos >= sortedStops[sortedStops.length - 1].pos) return sortedStops[sortedStops.length - 1];
    for (var i = 0; i < sortedStops.length - 1; i++) {
        var a = sortedStops[i], b = sortedStops[i + 1];
        if (pos >= a.pos && pos <= b.pos) {
            var t = (b.pos === a.pos) ? 0 : (pos - a.pos) / (b.pos - a.pos);
            return { r: Math.round(a.r + (b.r - a.r) * t), g: Math.round(a.g + (b.g - a.g) * t), b: Math.round(a.b + (b.b - a.b) * t) };
        }
    }
    return sortedStops[0];
}

function createGradientEditor(containerId, initialStops) {
    var container = $(containerId);
    if (!container) return null;

    function cloneStops(list) {
        return list.map(function (s) { return { pos: s.pos, r: s.r, g: s.g, b: s.b, opacity: (s.opacity === undefined ? 100 : s.opacity) }; });
    }
    var stops = (initialStops && initialStops.length >= 2) ? cloneStops(initialStops) : [{ pos: 0, r: 0, g: 0, b: 0, opacity: 100 }, { pos: 100, r: 255, g: 255, b: 255, opacity: 100 }];
    var selected = 0;

    container.innerHTML =
        '<div class="bo-gradient-bar"><div class="bo-gradient-fill"></div></div>' +
        '<div class="bo-gradient-stops"></div>' +
        '<div class="bo-gradient-editor-footer">' +
        '<div class="bo-grad-swatch-wrap"><div class="color-swatch bo-grad-footer-swatch" title="Selected stop color"></div></div>' +
        '<button type="button" class="bo-gradient-remove">Remove</button>' +
        '</div>' +
        '<div class="bo-gradient-editor-footer2">' +
        '<span class="bo-label" style="width:auto;">Pos</span>' +
        '<input type="number" class="bo-val bo-grad-pos" min="0" max="100" value="0">' +
        '<span class="bo-label" style="width:auto;">Opa</span>' +
        '<input type="number" class="bo-val bo-grad-opacity" min="0" max="100" value="100">' +
        '</div>';

    var bar = container.querySelector(".bo-gradient-bar");
    var fill = container.querySelector(".bo-gradient-fill");
    var stopsRow = container.querySelector(".bo-gradient-stops");
    var footerSwatch = container.querySelector(".bo-grad-footer-swatch");
    var posInput = container.querySelector(".bo-grad-pos");
    var opInput = container.querySelector(".bo-grad-opacity");
    var removeBtn = container.querySelector(".bo-gradient-remove");

    function css(c) { return "rgba(" + c.r + "," + c.g + "," + c.b + "," + ((c.opacity === undefined ? 100 : c.opacity) / 100) + ")"; }

    function renderFill() {
        var sorted = stops.slice().sort(function (a, b) { return a.pos - b.pos; });
        var parts = sorted.map(function (s) { return css(s) + " " + s.pos + "%"; });
        fill.style.background = "linear-gradient(90deg," + parts.join(",") + ")";
    }

    function renderStops() {
        stopsRow.innerHTML = "";
        stops.forEach(function (s, i) {
            var el = document.createElement("div");
            el.className = "bo-gradient-stop" + (i === selected ? " selected" : "");
            el.style.left = s.pos + "%";
            if (i !== selected) el.style.borderBottomColor = "rgb(" + s.r + "," + s.g + "," + s.b + ")";
            el.addEventListener("mousedown", function (e) {
                e.stopPropagation();
                select(i);
                var dragging = true;
                function onMove(ev) {
                    if (!dragging) return;
                    var rect = bar.getBoundingClientRect();
                    var pct = Math.round(Math.max(0, Math.min(100, ((ev.clientX - rect.left) / rect.width) * 100)));
                    stops[i].pos = pct;
                    renderFill(); renderStops(); syncFooter();
                }
                function onUp() {
                    dragging = false;
                    document.removeEventListener("mousemove", onMove);
                    document.removeEventListener("mouseup", onUp);
                    scheduleAutoApply();
                }
                document.addEventListener("mousemove", onMove);
                document.addEventListener("mouseup", onUp);
            });
            stopsRow.appendChild(el);
        });
    }

    function syncFooter() {
        var s = stops[selected];
        if (!s) return;
        setSwatchColor(footerSwatch, { r: s.r, g: s.g, b: s.b });
        posInput.value = s.pos;
        opInput.value = (s.opacity === undefined ? 100 : s.opacity);
        removeBtn.disabled = stops.length <= 2;
    }

    function select(i) { selected = i; renderStops(); syncFooter(); }
    function refresh() { renderFill(); renderStops(); }

    bar.addEventListener("click", function (e) {
        var rect = bar.getBoundingClientRect();
        var pct = Math.round(Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)));
        var sorted = stops.slice().sort(function (a, b) { return a.pos - b.pos; });
        var c = interpolateColor(sorted, pct);
        stops.push({ pos: pct, r: c.r, g: c.g, b: c.b, opacity: 100 });
        select(stops.length - 1);
        refresh();
        scheduleAutoApply();
    });

    posInput.addEventListener("input", function () {
        var v = Math.max(0, Math.min(100, parseInt(posInput.value) || 0));
        stops[selected].pos = v; refresh();
    });
    opInput.addEventListener("input", function () {
        var v = Math.max(0, Math.min(100, parseInt(opInput.value) || 0));
        stops[selected].opacity = v; refresh();
    });
    removeBtn.addEventListener("click", function () {
        if (stops.length <= 2) return;
        stops.splice(selected, 1);
        selected = Math.max(0, selected - 1);
        refresh(); syncFooter();
        scheduleAutoApply();
    });

    footerSwatch._onColor = function (c) {
        stops[selected].r = c.r; stops[selected].g = c.g; stops[selected].b = c.b;
        refresh(); syncFooter();
        scheduleAutoApply();
    };

    refresh(); syncFooter();

    var api = {
        getStops: function () { return cloneStops(stops); },
        setStops: function (newStops) {
            stops = (newStops && newStops.length >= 2) ? cloneStops(newStops) : [{ pos: 0, r: 0, g: 0, b: 0, opacity: 100 }, { pos: 100, r: 255, g: 255, b: 255, opacity: 100 }];
            selected = 0;
            refresh(); syncFooter();
        }
    };
    container._api = api;
    return api;
}

// ============================================================
//  THU THẬP DỮ LIỆU TỪ UI -> PAYLOAD GỬI SANG PHOTOSHOP
// ============================================================
function collectPayload() {
    var p = {};
    p.blending = {
        blendMode: val("blendMode"),
        opacity: numv("layerOpacityVal"),
        fillOpacity: numv("layerFillOpacityVal")
    };

    if (isEnabled("bevelEmboss")) {
        p.bevelEmboss = {
            enabled: true,
            style: val("bevelStyle"), technique: val("bevelTechnique"),
            depth: numv("bevelDepthVal"), direction: val("bevelDirection"),
            size: numv("bevelSizeVal"), soften: numv("bevelSoftenVal"),
            useGlobalLight: checked("bevelUseGlobalLight"),
            angle: numv("bevelAngleInput"), altitude: numv("bevelAltitudeVal"),
            antiAlias: checked("bevelAntiAlias"),
            highlightMode: val("bevelHighlightMode"), highlightColor: swatch("bevelHighlightColor"),
            highlightOpacity: numv("bevelHighlightOpacityVal"),
            shadowMode: val("bevelShadowMode"), shadowColor: swatch("bevelShadowColor"),
            shadowOpacity: numv("bevelShadowOpacityVal")
        };
    }

    if (isEnabled("stroke")) {
        var paintType = val("strokePaintType");
        var s = {
            enabled: true, size: numv("strokeSizeVal"), position: val("strokePosition"),
            blendMode: val("strokeBlendMode"), opacity: numv("strokeOpacityVal"), paintType: paintType
        };
        if (paintType === "gradient") {
            s.gradient = {
                stops: strokeGradEditor ? strokeGradEditor.getStops() : null,
                style: val("strokeGradientStyle"), angle: numv("strokeGradAngleInput"),
                scale: numv("strokeGradScaleVal"), reverse: checked("strokeGradReverse"), align: true
            };
        } else {
            s.color = swatch("strokeColor");
        }
        p.stroke = s;
    }

    if (isEnabled("innerShadow")) {
        p.innerShadow = {
            enabled: true, blendMode: val("innerShadowBlendMode"), color: swatch("innerShadowColor"),
            opacity: numv("innerShadowOpacityVal"), useGlobalLight: checked("innerShadowUseGlobalLight"),
            angle: numv("innerShadowAngleInput"), distance: numv("innerShadowDistanceVal"),
            choke: numv("innerShadowChokeVal"), size: numv("innerShadowSizeVal")
        };
    }

    if (isEnabled("innerGlow")) {
        p.innerGlow = {
            enabled: true, blendMode: val("innerGlowBlendMode"), opacity: numv("innerGlowOpacityVal"),
            technique: val("innerGlowTechnique"), choke: numv("innerGlowChokeVal"),
            size: numv("innerGlowSizeVal"), range: numv("innerGlowRangeVal"), color: swatch("innerGlowColor")
        };
    }

    if (isEnabled("satin")) {
        p.satin = {
            enabled: true, blendMode: val("satinBlendMode"), color: swatch("satinColor"),
            opacity: numv("satinOpacityVal"), angle: numv("satinAngleInput"),
            distance: numv("satinDistanceVal"), size: numv("satinSizeVal"), invert: checked("satinInvert")
        };
    }

    if (isEnabled("colorOverlay")) {
        p.colorOverlay = {
            enabled: true, blendMode: val("colorOverlayBlendMode"), color: swatch("colorOverlaySwatch"),
            opacity: numv("colorOverlayOpacityVal")
        };
    }

    if (isEnabled("gradientOverlay")) {
        p.gradientOverlay = {
            enabled: true, blendMode: val("gradientOverlayBlendMode"), opacity: numv("gradientOverlayOpacityVal"),
            angle: numv("gradientOverlayAngleInput"), style: val("gradientOverlayStyle"),
            scale: numv("gradientOverlayScaleVal"), reverse: checked("gradientOverlayReverse"), align: true,
            stops: gradOverlayEditor ? gradOverlayEditor.getStops() : null
        };
    }

    if (isEnabled("outerGlow")) {
        p.outerGlow = {
            enabled: true, blendMode: val("outerGlowBlendMode"), opacity: numv("outerGlowOpacityVal"),
            technique: val("outerGlowTechnique"), choke: numv("outerGlowChokeVal"),
            size: numv("outerGlowSizeVal"), range: numv("outerGlowRangeVal"), color: swatch("outerGlowColor")
        };
    }

    if (isEnabled("dropShadow")) {
        p.dropShadow = {
            enabled: true, blendMode: val("dropShadowBlendMode"), color: swatch("dropShadowColor"),
            opacity: numv("dropShadowOpacityVal"), useGlobalLight: checked("dropShadowUseGlobalLight"),
            angle: numv("dropShadowAngleInput"), distance: numv("dropShadowDistanceVal"),
            choke: numv("dropShadowChokeVal"), size: numv("dropShadowSizeVal")
        };
    }

    return p;
}

// ============================================================
//  ĐỔ DỮ LIỆU TỪ PHOTOSHOP (SYNC) LÊN UI
// ============================================================
function updateFxOnState(cb) {
    var section = cb && cb.closest(".bo-section");
    if (!section) return;
    section.classList.toggle("bo-fx-on", !!cb.checked);
}

// Thu gọn tất cả nếu đang có ít nhất 1 mục mở; ngược lại mở hết ra.
// (Blending Options luôn giữ mở vì không có checkbox bật/tắt.)
function toggleCollapseAll() {
    var sections = Array.prototype.slice.call(document.querySelectorAll(".bo-section"))
        .filter(function (s) { return !s.querySelector(".bo-header-plain"); });
    var anyExpanded = sections.some(function (s) { return !s.classList.contains("bo-collapsed"); });
    sections.forEach(function (s) { s.classList.toggle("bo-collapsed", anyExpanded); });
    saveCollapseState();
}

// Lưu/khôi phục trạng thái thu gọn (mở/đóng) của từng section — để lần mở
// panel sau vẫn giữ nguyên như lúc anh để lại, không cần thu gọn lại tay.
function saveCollapseState() {
    var state = {};
    document.querySelectorAll(".bo-section[data-fx]").forEach(function (s) {
        var fx = s.getAttribute("data-fx");
        if (fx === "blending") return; // luôn mở, không có gì để lưu
        state[fx] = s.classList.contains("bo-collapsed");
    });
    try { localStorage.setItem("typoblendSectionCollapse", JSON.stringify(state)); } catch (e) {}
}
function loadCollapseState() {
    try {
        var raw = localStorage.getItem("typoblendSectionCollapse");
        return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
}

// ============================================================
//  SETTINGS: hide/unhide tool sections you don't need, to keep the panel
//  shorter. Choice is remembered (localStorage) for the next time you open
//  the panel.
// ============================================================
var FX_SECTIONS = [
    ["blending", "Blending Options"],
    ["bevelEmboss", "Bevel & Emboss"],
    ["stroke", "Stroke"],
    ["innerShadow", "Inner Shadow"],
    ["innerGlow", "Inner Glow"],
    ["satin", "Satin"],
    ["colorOverlay", "Color Overlay"],
    ["gradientOverlay", "Gradient Overlay"],
    ["outerGlow", "Outer Glow"],
    ["dropShadow", "Drop Shadow"]
];

var hiddenSections = (function () {
    try { return JSON.parse(localStorage.getItem("typoblendHiddenSections") || "[]"); } catch (e) { return []; }
})();

function saveHiddenSections() {
    try { localStorage.setItem("typoblendHiddenSections", JSON.stringify(hiddenSections)); } catch (e) {}
}

function applyHiddenSections() {
    FX_SECTIONS.forEach(function (pair) {
        var fx = pair[0];
        var section = document.querySelector('.bo-section[data-fx="' + fx + '"]');
        if (!section) return;
        section.style.display = (hiddenSections.indexOf(fx) !== -1) ? "none" : "";
    });
}

function buildSettingsList() {
    var list = $("settingsList");
    if (!list) return;
    list.innerHTML = "";
    FX_SECTIONS.forEach(function (pair) {
        var fx = pair[0], label = pair[1];
        var row = document.createElement("label");
        row.className = "bo-settings-item";
        var cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = hiddenSections.indexOf(fx) === -1; // checked = currently visible
        cb.addEventListener("change", function () {
            var idx = hiddenSections.indexOf(fx);
            if (cb.checked) { if (idx !== -1) hiddenSections.splice(idx, 1); }
            else { if (idx === -1) hiddenSections.push(fx); }
            saveHiddenSections();
            applyHiddenSections();
        });
        var span = document.createElement("span");
        span.textContent = label;
        row.appendChild(cb);
        row.appendChild(span);
        list.appendChild(row);
    });
}

var settingsPopupOutsideListenerAdded = false;
function toggleSettingsPopup(e) {
    if (e) e.preventDefault();
    var popup = $("settingsPopup");
    var btn = $("btnSettings");
    if (!popup || !btn) return;
    if (popup.style.display === "block") { popup.style.display = "none"; return; }
    buildSettingsList();

    // Đo kích thước THẬT của popup (min/max-width trong CSS làm bề rộng thay
    // đổi theo nội dung) trước khi tính vị trí — tránh đoán sai làm neo lệch.
    popup.style.visibility = "hidden";
    popup.style.left = "0px";
    popup.style.top = "0px";
    popup.style.display = "block";
    var popupRect = popup.getBoundingClientRect();
    var popupW = popupRect.width;
    var popupH = popupRect.height;

    var rect = btn.getBoundingClientRect();
    var left = rect.right - popupW; // neo góc phải popup vào góc phải chữ Settings
    var top = rect.top - popupH - 6; // nút nằm dưới cùng panel -> mở popup lên trên
    if (top < 5) top = 5;
    if (left < 5) left = 5;
    if (left + popupW > window.innerWidth - 5) left = window.innerWidth - popupW - 5;
    popup.style.left = left + "px";
    popup.style.top = top + "px";
    popup.style.visibility = "visible";

    if (!settingsPopupOutsideListenerAdded) {
        document.addEventListener("click", function (ev) {
            var p = $("settingsPopup");
            if (p && p.style.display === "block") {
                if (p.contains(ev.target) || ev.target.closest("#btnSettings")) return;
                p.style.display = "none";
            }
        });
        settingsPopupOutsideListenerAdded = true;
    }
}

function syncSection(fx, data, fillFn, resetFn) {
    var cb = document.querySelector('.bo-enable[data-fx="' + fx + '"]');
    var section = cb ? cb.closest(".bo-section") : null;
    if (data && data.enabled) {
        if (cb) cb.checked = true;
        fillFn(data);
    } else {
        if (cb) cb.checked = false;
        resetFn();
    }
    if (cb) updateFxOnState(cb);
}

function applyDataToUI(data) {
    data = data || {};

    var bl = data.blending || {};
    setDefault("blendMode", bl.blendMode || "normal");
    setRangeAndVal("layerOpacity", "layerOpacityVal", bl.opacity !== undefined ? bl.opacity : 100);
    setRangeAndVal("layerFillOpacity", "layerFillOpacityVal", bl.fillOpacity !== undefined ? bl.fillOpacity : 100);

    syncSection("bevelEmboss", data.bevelEmboss, function (d) {
        setDefault("bevelStyle", d.style || "innerBevel");
        setDefault("bevelTechnique", d.technique || "smoothTechnique");
        setRangeAndVal("bevelDepth", "bevelDepthVal", d.depth !== undefined ? d.depth : 100);
        setDefault("bevelDirection", d.direction || "in");
        setRangeAndVal("bevelSize", "bevelSizeVal", d.size !== undefined ? d.size : 5);
        setRangeAndVal("bevelSoften", "bevelSoftenVal", d.soften !== undefined ? d.soften : 0);
        $("bevelUseGlobalLight").checked = d.useGlobalLight !== false;
        var ang = d.angle !== undefined ? d.angle : 120;
        $("bevelAngleInput").value = ang; if (bevelAngleDial) bevelAngleDial.draw(ang);
        setRangeAndVal("bevelAltitude", "bevelAltitudeVal", d.altitude !== undefined ? d.altitude : 30);
        $("bevelAntiAlias").checked = !!d.antiAlias;
        setDefault("bevelHighlightMode", d.highlightMode || "screen");
        setSwatchColor($("bevelHighlightColor"), d.highlightColor || { r: 255, g: 255, b: 255 });
        setRangeAndVal("bevelHighlightOpacity", "bevelHighlightOpacityVal", d.highlightOpacity !== undefined ? d.highlightOpacity : 75);
        setDefault("bevelShadowMode", d.shadowMode || "multiply");
        setSwatchColor($("bevelShadowColor"), d.shadowColor || { r: 0, g: 0, b: 0 });
        setRangeAndVal("bevelShadowOpacity", "bevelShadowOpacityVal", d.shadowOpacity !== undefined ? d.shadowOpacity : 75);
    }, function () {
        setDefault("bevelStyle", "innerBevel"); setDefault("bevelTechnique", "smoothTechnique");
        setRangeAndVal("bevelDepth", "bevelDepthVal", 100); setDefault("bevelDirection", "in");
        setRangeAndVal("bevelSize", "bevelSizeVal", 5); setRangeAndVal("bevelSoften", "bevelSoftenVal", 0);
        $("bevelUseGlobalLight").checked = true;
        $("bevelAngleInput").value = 120; if (bevelAngleDial) bevelAngleDial.draw(120);
        setRangeAndVal("bevelAltitude", "bevelAltitudeVal", 30);
        $("bevelAntiAlias").checked = false;
        setDefault("bevelHighlightMode", "screen"); setSwatchColor($("bevelHighlightColor"), { r: 255, g: 255, b: 255 });
        setRangeAndVal("bevelHighlightOpacity", "bevelHighlightOpacityVal", 75);
        setDefault("bevelShadowMode", "multiply"); setSwatchColor($("bevelShadowColor"), { r: 0, g: 0, b: 0 });
        setRangeAndVal("bevelShadowOpacity", "bevelShadowOpacityVal", 75);
    });

    syncSection("stroke", data.stroke, function (d) {
        setRangeAndVal("strokeSize", "strokeSizeVal", d.size !== undefined ? d.size : 3);
        setDefault("strokePosition", d.position || "outsetFrame");
        setDefault("strokeBlendMode", d.blendMode || "normal");
        setRangeAndVal("strokeOpacity", "strokeOpacityVal", d.opacity !== undefined ? d.opacity : 100);
        var isGrad = d.paintType === "gradient";
        setDefault("strokePaintType", isGrad ? "gradient" : "solid");
        $("strokeColor").style.display = isGrad ? "none" : "";
        $("strokeGradientBlock").style.display = isGrad ? "" : "none";
        if (isGrad && d.gradient) {
            var g = d.gradient;
            if (strokeGradEditor) strokeGradEditor.setStops(g.stops);
            setDefault("strokeGradientStyle", g.style || "linear");
            var ang = g.angle !== undefined ? g.angle : 0;
            $("strokeGradAngleInput").value = ang; if (strokeGradAngleDial) strokeGradAngleDial.draw(ang);
            setRangeAndVal("strokeGradScale", "strokeGradScaleVal", g.scale !== undefined ? g.scale : 100);
            $("strokeGradReverse").checked = !!g.reverse;
        } else {
            setSwatchColor($("strokeColor"), d.color || { r: 255, g: 255, b: 255 });
        }
    }, function () {
        setRangeAndVal("strokeSize", "strokeSizeVal", 3); setDefault("strokePosition", "outsetFrame");
        setDefault("strokeBlendMode", "normal"); setRangeAndVal("strokeOpacity", "strokeOpacityVal", 100);
        setDefault("strokePaintType", "solid");
        $("strokeColor").style.display = ""; $("strokeGradientBlock").style.display = "none";
        setSwatchColor($("strokeColor"), { r: 255, g: 255, b: 255 });
    });

    syncSection("innerShadow", data.innerShadow, function (d) {
        setDefault("innerShadowBlendMode", d.blendMode || "multiply");
        setSwatchColor($("innerShadowColor"), d.color || { r: 0, g: 0, b: 0 });
        setRangeAndVal("innerShadowOpacity", "innerShadowOpacityVal", d.opacity !== undefined ? d.opacity : 75);
        $("innerShadowUseGlobalLight").checked = d.useGlobalLight !== false;
        var ang = d.angle !== undefined ? d.angle : 120;
        $("innerShadowAngleInput").value = ang; if (innerShadowAngleDial) innerShadowAngleDial.draw(ang);
        setRangeAndVal("innerShadowDistance", "innerShadowDistanceVal", d.distance !== undefined ? d.distance : 5);
        setRangeAndVal("innerShadowChoke", "innerShadowChokeVal", d.choke !== undefined ? d.choke : 0);
        setRangeAndVal("innerShadowSize", "innerShadowSizeVal", d.size !== undefined ? d.size : 5);
    }, function () {
        setDefault("innerShadowBlendMode", "multiply"); setSwatchColor($("innerShadowColor"), { r: 0, g: 0, b: 0 });
        setRangeAndVal("innerShadowOpacity", "innerShadowOpacityVal", 75);
        $("innerShadowUseGlobalLight").checked = true;
        $("innerShadowAngleInput").value = 120; if (innerShadowAngleDial) innerShadowAngleDial.draw(120);
        setRangeAndVal("innerShadowDistance", "innerShadowDistanceVal", 5);
        setRangeAndVal("innerShadowChoke", "innerShadowChokeVal", 0);
        setRangeAndVal("innerShadowSize", "innerShadowSizeVal", 5);
    });

    syncSection("innerGlow", data.innerGlow, function (d) {
        setDefault("innerGlowBlendMode", d.blendMode || "screen");
        setRangeAndVal("innerGlowOpacity", "innerGlowOpacityVal", d.opacity !== undefined ? d.opacity : 75);
        setDefault("innerGlowTechnique", d.technique || "softMatte");
        setRangeAndVal("innerGlowChoke", "innerGlowChokeVal", d.choke !== undefined ? d.choke : 0);
        setRangeAndVal("innerGlowSize", "innerGlowSizeVal", d.size !== undefined ? d.size : 10);
        setRangeAndVal("innerGlowRange", "innerGlowRangeVal", d.range !== undefined ? d.range : 50);
        setSwatchColor($("innerGlowColor"), d.color || { r: 255, g: 255, b: 181 });
    }, function () {
        setDefault("innerGlowBlendMode", "screen"); setRangeAndVal("innerGlowOpacity", "innerGlowOpacityVal", 75);
        setDefault("innerGlowTechnique", "softMatte");
        setRangeAndVal("innerGlowChoke", "innerGlowChokeVal", 0); setRangeAndVal("innerGlowSize", "innerGlowSizeVal", 10);
        setRangeAndVal("innerGlowRange", "innerGlowRangeVal", 50);
        setSwatchColor($("innerGlowColor"), { r: 255, g: 255, b: 181 });
    });

    syncSection("satin", data.satin, function (d) {
        setDefault("satinBlendMode", d.blendMode || "multiply");
        setSwatchColor($("satinColor"), d.color || { r: 0, g: 0, b: 0 });
        setRangeAndVal("satinOpacity", "satinOpacityVal", d.opacity !== undefined ? d.opacity : 50);
        var ang = d.angle !== undefined ? d.angle : 19;
        $("satinAngleInput").value = ang; if (satinAngleDial) satinAngleDial.draw(ang);
        setRangeAndVal("satinDistance", "satinDistanceVal", d.distance !== undefined ? d.distance : 11);
        setRangeAndVal("satinSize", "satinSizeVal", d.size !== undefined ? d.size : 14);
        $("satinInvert").checked = d.invert !== false;
    }, function () {
        setDefault("satinBlendMode", "multiply"); setSwatchColor($("satinColor"), { r: 0, g: 0, b: 0 });
        setRangeAndVal("satinOpacity", "satinOpacityVal", 50);
        $("satinAngleInput").value = 19; if (satinAngleDial) satinAngleDial.draw(19);
        setRangeAndVal("satinDistance", "satinDistanceVal", 11); setRangeAndVal("satinSize", "satinSizeVal", 14);
        $("satinInvert").checked = true;
    });

    syncSection("colorOverlay", data.colorOverlay, function (d) {
        setDefault("colorOverlayBlendMode", d.blendMode || "normal");
        setSwatchColor($("colorOverlaySwatch"), d.color || { r: 255, g: 0, b: 0 });
        setRangeAndVal("colorOverlayOpacity", "colorOverlayOpacityVal", d.opacity !== undefined ? d.opacity : 100);
    }, function () {
        setDefault("colorOverlayBlendMode", "normal"); setSwatchColor($("colorOverlaySwatch"), { r: 255, g: 0, b: 0 });
        setRangeAndVal("colorOverlayOpacity", "colorOverlayOpacityVal", 100);
    });

    syncSection("gradientOverlay", data.gradientOverlay, function (d) {
        setDefault("gradientOverlayBlendMode", d.blendMode || "normal");
        setRangeAndVal("gradientOverlayOpacity", "gradientOverlayOpacityVal", d.opacity !== undefined ? d.opacity : 100);
        if (gradOverlayEditor) gradOverlayEditor.setStops(d.stops);
        setDefault("gradientOverlayStyle", d.style || "linear");
        var ang = d.angle !== undefined ? d.angle : 90;
        $("gradientOverlayAngleInput").value = ang; if (gradOverlayAngleDial) gradOverlayAngleDial.draw(ang);
        setRangeAndVal("gradientOverlayScale", "gradientOverlayScaleVal", d.scale !== undefined ? d.scale : 100);
        $("gradientOverlayReverse").checked = !!d.reverse;
    }, function () {
        setDefault("gradientOverlayBlendMode", "normal"); setRangeAndVal("gradientOverlayOpacity", "gradientOverlayOpacityVal", 100);
        if (gradOverlayEditor) gradOverlayEditor.setStops(null);
        setDefault("gradientOverlayStyle", "linear");
        $("gradientOverlayAngleInput").value = 90; if (gradOverlayAngleDial) gradOverlayAngleDial.draw(90);
        setRangeAndVal("gradientOverlayScale", "gradientOverlayScaleVal", 100);
        $("gradientOverlayReverse").checked = false;
    });

    syncSection("outerGlow", data.outerGlow, function (d) {
        setDefault("outerGlowBlendMode", d.blendMode || "screen");
        setRangeAndVal("outerGlowOpacity", "outerGlowOpacityVal", d.opacity !== undefined ? d.opacity : 75);
        setDefault("outerGlowTechnique", d.technique || "softMatte");
        setRangeAndVal("outerGlowChoke", "outerGlowChokeVal", d.choke !== undefined ? d.choke : 0);
        setRangeAndVal("outerGlowSize", "outerGlowSizeVal", d.size !== undefined ? d.size : 20);
        setRangeAndVal("outerGlowRange", "outerGlowRangeVal", d.range !== undefined ? d.range : 50);
        setSwatchColor($("outerGlowColor"), d.color || { r: 255, g: 190, b: 0 });
    }, function () {
        setDefault("outerGlowBlendMode", "screen"); setRangeAndVal("outerGlowOpacity", "outerGlowOpacityVal", 75);
        setDefault("outerGlowTechnique", "softMatte");
        setRangeAndVal("outerGlowChoke", "outerGlowChokeVal", 0); setRangeAndVal("outerGlowSize", "outerGlowSizeVal", 20);
        setRangeAndVal("outerGlowRange", "outerGlowRangeVal", 50);
        setSwatchColor($("outerGlowColor"), { r: 255, g: 190, b: 0 });
    });

    syncSection("dropShadow", data.dropShadow, function (d) {
        setDefault("dropShadowBlendMode", d.blendMode || "multiply");
        setSwatchColor($("dropShadowColor"), d.color || { r: 0, g: 0, b: 0 });
        setRangeAndVal("dropShadowOpacity", "dropShadowOpacityVal", d.opacity !== undefined ? d.opacity : 75);
        $("dropShadowUseGlobalLight").checked = d.useGlobalLight !== false;
        var ang = d.angle !== undefined ? d.angle : 120;
        $("dropShadowAngleInput").value = ang; if (dropShadowAngleDial) dropShadowAngleDial.draw(ang);
        setRangeAndVal("dropShadowDistance", "dropShadowDistanceVal", d.distance !== undefined ? d.distance : 5);
        setRangeAndVal("dropShadowChoke", "dropShadowChokeVal", d.choke !== undefined ? d.choke : 0);
        setRangeAndVal("dropShadowSize", "dropShadowSizeVal", d.size !== undefined ? d.size : 5);
    }, function () {
        setDefault("dropShadowBlendMode", "multiply"); setSwatchColor($("dropShadowColor"), { r: 0, g: 0, b: 0 });
        setRangeAndVal("dropShadowOpacity", "dropShadowOpacityVal", 75);
        $("dropShadowUseGlobalLight").checked = true;
        $("dropShadowAngleInput").value = 120; if (dropShadowAngleDial) dropShadowAngleDial.draw(120);
        setRangeAndVal("dropShadowDistance", "dropShadowDistanceVal", 5);
        setRangeAndVal("dropShadowChoke", "dropShadowChokeVal", 0);
        setRangeAndVal("dropShadowSize", "dropShadowSizeVal", 5);
    });
}

// ============================================================
//  SYNC / APPLY / CLEAR / COPY / PASTE
// ============================================================
function showLibError(msg) {
    var name = $("boLayerName");
    if (name) { name.textContent = "⚠ " + msg; name.style.color = "#ff6b6b"; name.classList.add("bo-error"); }
    ["btnSync", "btnApply", "btnClear", "btnCopyStyle", "btnPasteStyle"].forEach(function (id) {
        var b = $(id); if (b) b.disabled = true;
    });
    var chk = $("chkAutoSync"); if (chk) chk.disabled = true;
}

// Mọi hàm gọi sang Photoshop đều đi qua đây trước — nếu cs null (do thiếu
// client/CSInterface.js) thì báo lỗi rõ ràng thay vì im lặng không làm gì.
function csReady() {
    if (!cs) { showLibError(csInitErrorReason || "Could not connect to Photoshop — missing client/CSInterface.js (see README)."); return false; }
    return true;
}

function showSpinner(v) { var s = $("boSpinner"); if (s) s.style.display = v ? "inline-block" : "none"; }
function flashBtn(btn) {
    if (!btn) return;
    var old = btn.style.background;
    btn.style.background = "#2a5a2a";
    setTimeout(function () { btn.style.background = old; }, 250);
}

// ============================================================
//  HÀNG CHỜ CHO LỆNH GỬI SANG PHOTOSHOP
//  Photoshop chạy ExtendScript trên 1 luồng duy nhất — nếu bấm/kéo liên tục
//  làm nhiều evalScript() bắn đi gần như cùng lúc, các lệnh chồng lên nhau dễ
//  làm Photoshop bị đơ. runExclusive() đảm bảo tại một thời điểm chỉ có đúng
//  1 lệnh đang chạy; lệnh nào tới trong lúc đang bận sẽ CHỜ, và nếu có nhiều
//  lệnh cùng chờ thì chỉ giữ lại lệnh MỚI NHẤT (bỏ các lệnh cũ hơn đã lỗi thời
//  — ví dụ kéo slider liên tục thì chỉ cần áp lần giá trị cuối cùng).
// ============================================================
var csBusy = false;
var csPendingTask = null;

function runExclusive(taskFn) {
    if (csBusy) { csPendingTask = taskFn; return; }
    csBusy = true;
    taskFn(function () {
        csBusy = false;
        if (csPendingTask) {
            var next = csPendingTask;
            csPendingTask = null;
            runExclusive(next);
        }
    });
}

function performSync(opts) {
    opts = opts || {};
    if (!csReady()) return;
    showSpinner(true);
    runExclusive(function (done) {
    cs.evalScript("getFXData()", function (json) {
        done();
        showSpinner(false);
        if (!json || json === "NO_DOC" || json === "NO_LAYER" || json.indexOf("ERROR:") === 0) {
            $("boLayerName").textContent = (json === "NO_DOC") ? "No document open" : (json === "NO_LAYER" ? "No layer selected" : "Error reading data from Photoshop");
            return;
        }
        try {
            var data = JSON.parse(json);
            $("boLayerName").textContent = "Layer: " + (data.layerName || "");
            applyDataToUI(data);
            lastAppliedSnapshot = JSON.stringify(collectPayload());
            if (!opts.silent) flashBtn($("btnSync"));
        } catch (e) {
            if (!opts.silent) alert("Parse error: " + e.message);
        }
    });
    });
}

function performApply(opts) {
    opts = opts || {};
    if (!csReady()) return;
    var payload = collectPayload();
    showSpinner(true);
    runExclusive(function (done) {
        cs.evalScript("applyFXToSelectedLayers(" + JSON.stringify(JSON.stringify(payload)) + ")", function (res) {
            done();
            showSpinner(false);
            if (res === "OK") { lastAppliedSnapshot = JSON.stringify(payload); if (!opts.silent) flashBtn($("btnApply")); }
            else alert("Apply error: " + res);
        });
    });
}

function performClear() {
    if (!csReady()) return;
    if (!confirm("Remove all effects (fx) from the selected layer?")) return;
    showSpinner(true);
    runExclusive(function (done) {
        cs.evalScript("clearBlendingFX()", function (res) {
            done();
            showSpinner(false);
            if (res === "OK") performSync({ silent: true });
            else alert("Clear error: " + res);
        });
    });
}

function doCopyStyle() {
    if (!csReady()) return;
    showSpinner(true);
    runExclusive(function (done) {
        cs.evalScript("copyBlendingStyle()", function (res) {
            done();
            showSpinner(false);
            if (res === "OK") { $("btnPasteStyle").disabled = false; flashBtn($("btnCopyStyle")); }
            else alert("This layer has no effects (fx) to copy.");
        });
    });
}
function doPasteStyle() {
    if (!csReady()) return;
    showSpinner(true);
    runExclusive(function (done) {
        cs.evalScript("pasteBlendingStyle()", function (res) {
            done();
            showSpinner(false);
            if (res === "OK") { flashBtn($("btnPasteStyle")); performSync({ silent: true }); }
            else alert("Paste Style error: " + res);
        });
    });
}

function autoSyncPoll() {
    if (!cs) return;
    // Nếu đang có lệnh khác chạy (ví dụ Auto-Apply vừa bắn đi) thì bỏ qua lượt
    // poll này, đợi lượt sau — tránh xếp lệnh chồng lệnh khi thao tác liên tục.
    if (csBusy) return;
    runExclusive(function (done) {
        cs.evalScript("getActiveLayerId()", function (id) {
            done();
            if (id && id !== lastLayerId) { lastLayerId = id; performSync({ silent: true }); }
        });
    });
}
function onAutoSyncToggle(e) {
    if (e.target.checked) {
        lastLayerId = null; autoSyncPoll();
        autoSyncInterval = setInterval(autoSyncPoll, 900);
    } else {
        if (autoSyncInterval) clearInterval(autoSyncInterval);
        autoSyncInterval = null;
    }
}

// ============================================================
//  AUTO-APPLY: sau khi thả chuột (hoặc ngưng gõ) một khoảng ngắn,
//  nếu có thay đổi thật sự thì tự Apply xuống layer hiện tại.
//  Dùng debounce thay vì bắt sự kiện mouseup trực tiếp vì còn nhiều
//  control tự vẽ (angle dial, gradient stop) không phát mouseup gọn gàng
//  qua 1 nút bấm cụ thể.
// ============================================================
var autoApplyTimer = null;
var lastAppliedSnapshot = null;

function scheduleAutoApply() {
    var chk = $("chkAutoApply");
    if (!chk || !chk.checked || !cs) return;
    if (autoApplyTimer) clearTimeout(autoApplyTimer);
    // 450ms: đủ thời gian để nhận biết "đã thả chuột / ngưng gõ", đồng thời
    // giãn bớt tần suất gửi lệnh sang Photoshop khi anh chỉnh liên tục, hạn
    // chế đơ máy.
    autoApplyTimer = setTimeout(function () {
        autoApplyTimer = null;
        var payload = collectPayload();
        var snapshot = JSON.stringify(payload);
        if (snapshot === lastAppliedSnapshot) return; // không đổi gì thật sự thì thôi
        showSpinner(true);
        runExclusive(function (done) {
            cs.evalScript("applyFXToSelectedLayers(" + JSON.stringify(snapshot) + ")", function (res) {
                done();
                showSpinner(false);
                if (res === "OK") { lastAppliedSnapshot = snapshot; flashBtn($("btnApply")); }
            });
        });
    }, 450);
}

// ============================================================
//  INIT
// ============================================================
(function init() {
  try {
    populateBlendSelects();
    setDefault("strokeBlendMode", "normal");
    setDefault("innerShadowBlendMode", "multiply");
    setDefault("innerGlowBlendMode", "screen");
    setDefault("satinBlendMode", "multiply");
    setDefault("colorOverlayBlendMode", "normal");
    setDefault("gradientOverlayBlendMode", "normal");
    setDefault("outerGlowBlendMode", "screen");
    setDefault("dropShadowBlendMode", "multiply");
    setDefault("bevelHighlightMode", "screen");
    setDefault("bevelShadowMode", "multiply");

    setSwatchColor($("innerShadowColor"), { r: 0, g: 0, b: 0 });
    setSwatchColor($("innerGlowColor"), { r: 255, g: 255, b: 181 });
    setSwatchColor($("satinColor"), { r: 0, g: 0, b: 0 });
    setSwatchColor($("colorOverlaySwatch"), { r: 255, g: 0, b: 0 });
    setSwatchColor($("outerGlowColor"), { r: 255, g: 190, b: 0 });
    setSwatchColor($("dropShadowColor"), { r: 0, g: 0, b: 0 });
    setSwatchColor($("strokeColor"), { r: 255, g: 255, b: 255 });
    setSwatchColor($("bevelHighlightColor"), { r: 255, g: 255, b: 255 });
    setSwatchColor($("bevelShadowColor"), { r: 0, g: 0, b: 0 });

// Lưu/khôi phục trạng thái thu gọn (mở/đóng) của từng section — để lần mở
// panel sau vẫn giữ nguyên như lúc anh để lại, không cần thu gọn lại tay.
    var savedCollapse = loadCollapseState();
    document.querySelectorAll(".bo-section").forEach(function (s) {
        if (s.querySelector(".bo-header-plain")) return; // Blending Options luôn mở
        var fx = s.getAttribute("data-fx");
        var collapsed = (savedCollapse && Object.prototype.hasOwnProperty.call(savedCollapse, fx)) ? savedCollapse[fx] : true;
        s.classList.toggle("bo-collapsed", collapsed);
    });

    document.querySelectorAll(".bo-section-header").forEach(function (h) {
        h.addEventListener("click", function (e) {
            if (e.target.closest("input") || e.target.closest("select") || e.target.closest(".color-swatch")) return;
            if (h.classList.contains("bo-header-plain")) return;
            h.closest(".bo-section").classList.toggle("bo-collapsed");
            saveCollapseState();
        });
    });
    document.querySelectorAll(".bo-enable").forEach(function (cb) {
        cb.addEventListener("click", function (e) { e.stopPropagation(); });
        cb.addEventListener("change", function () {
            if (cb.checked) cb.closest(".bo-section").classList.remove("bo-collapsed");
            updateFxOnState(cb);
            saveCollapseState();
        });
    });

    [
        ["layerOpacity", "layerOpacityVal"], ["layerFillOpacity", "layerFillOpacityVal"],
        ["bevelDepth", "bevelDepthVal"], ["bevelSize", "bevelSizeVal"], ["bevelSoften", "bevelSoftenVal"],
        ["bevelAltitude", "bevelAltitudeVal"], ["bevelHighlightOpacity", "bevelHighlightOpacityVal"], ["bevelShadowOpacity", "bevelShadowOpacityVal"],
        ["strokeSize", "strokeSizeVal"], ["strokeOpacity", "strokeOpacityVal"], ["strokeGradScale", "strokeGradScaleVal"],
        ["innerShadowOpacity", "innerShadowOpacityVal"], ["innerShadowDistance", "innerShadowDistanceVal"], ["innerShadowChoke", "innerShadowChokeVal"], ["innerShadowSize", "innerShadowSizeVal"],
        ["innerGlowOpacity", "innerGlowOpacityVal"], ["innerGlowChoke", "innerGlowChokeVal"], ["innerGlowSize", "innerGlowSizeVal"], ["innerGlowRange", "innerGlowRangeVal"],
        ["satinOpacity", "satinOpacityVal"], ["satinDistance", "satinDistanceVal"], ["satinSize", "satinSizeVal"],
        ["colorOverlayOpacity", "colorOverlayOpacityVal"],
        ["gradientOverlayOpacity", "gradientOverlayOpacityVal"], ["gradientOverlayScale", "gradientOverlayScaleVal"],
        ["outerGlowOpacity", "outerGlowOpacityVal"], ["outerGlowChoke", "outerGlowChokeVal"], ["outerGlowSize", "outerGlowSizeVal"], ["outerGlowRange", "outerGlowRangeVal"],
        ["dropShadowOpacity", "dropShadowOpacityVal"], ["dropShadowDistance", "dropShadowDistanceVal"], ["dropShadowChoke", "dropShadowChokeVal"], ["dropShadowSize", "dropShadowSizeVal"]
    ].forEach(function (pair) { bindRangeNumber(pair[0], pair[1]); });

    bevelAngleDial = wireAngleDial("bevelAngleCanvas", "bevelAngleInput");
    innerShadowAngleDial = wireAngleDial("innerShadowAngleCanvas", "innerShadowAngleInput");
    satinAngleDial = wireAngleDial("satinAngleCanvas", "satinAngleInput");
    strokeGradAngleDial = wireAngleDial("strokeGradAngleCanvas", "strokeGradAngleInput");
    gradOverlayAngleDial = wireAngleDial("gradientOverlayAngleCanvas", "gradientOverlayAngleInput");
    dropShadowAngleDial = wireAngleDial("dropShadowAngleCanvas", "dropShadowAngleInput");

    gradOverlayEditor = createGradientEditor("gradientOverlayEditor", null);
    strokeGradEditor = createGradientEditor("strokeGradientEditor", null);

    on("strokePaintType", "change", function (e) {
        var isGrad = e.target.value === "gradient";
        $("strokeColor").style.display = isGrad ? "none" : "";
        $("strokeGradientBlock").style.display = isGrad ? "" : "none";
    });

    document.addEventListener("click", function (e) {
        var sw = e.target.closest(".color-swatch");
        if (!sw) return;
        e.stopPropagation();
        if (!cs) return;
        var cur = getSwatchColor(sw) || { r: 0, g: 0, b: 0 };
        runExclusive(function (done) {
            cs.evalScript("pickColor(" + cur.r + "," + cur.g + "," + cur.b + ")", function (res) {
                done();
                if (!res || res === "CANCEL" || res.indexOf("ERROR") === 0) return;
                try { var c = JSON.parse(res); setSwatchColor(sw, c); if (sw._onColor) sw._onColor(c); scheduleAutoApply(); } catch (e2) {}
            });
        });
    });

    on("btnSync", "click", function () { performSync(); });
    on("btnApply", "click", function () { performApply(); });
    on("btnClear", "click", performClear);
    on("btnCopyStyle", "click", doCopyStyle);
    on("btnPasteStyle", "click", doPasteStyle);
    on("chkAutoSync", "change", onAutoSyncToggle);
    on("btnCollapseAll", "click", toggleCollapseAll);
    on("btnSettings", "click", toggleSettingsPopup);
    applyHiddenSections();

    // Auto-Apply: mọi input/select/checkbox chuẩn (range, number, dropdown,
    // enable checkbox...) đều đi qua đây; các control tự vẽ (angle dial,
    // gradient stop, color picker) đã gọi scheduleAutoApply() thủ công ở trên.
    document.addEventListener("input", function (e) {
        if (e.target.id === "chkAutoApply" || e.target.id === "chkAutoSync") return;
        scheduleAutoApply();
    }, true);
    document.addEventListener("change", function (e) {
        if (e.target.id === "chkAutoApply" || e.target.id === "chkAutoSync") return;
        scheduleAutoApply();
    }, true);

    if (cs) {
        runExclusive(function (done) {
            cs.evalScript("hasCopiedStyle()", function (res) { done(); $("btnPasteStyle").disabled = (res !== "1"); });
        });
        performSync({ silent: true });
    } else {
        showLibError(csInitErrorReason || "Could not connect to Photoshop — missing client/CSInterface.js (see README).");
    }
  } catch (e) {
    console.error("TypoBlend init error:", e);
    var nameEl = $("boLayerName");
    if (nameEl) { nameEl.textContent = "⚠ Panel init error: " + e.message; nameEl.style.color = "#ff6b6b"; }
  }
})();
