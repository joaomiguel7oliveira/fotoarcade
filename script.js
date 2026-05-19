const state = {
    mode: "M",
    sceneEV: 11,
    iso: 100,
    aperture: 5.6,
    shutter: 1 / 125,
    focal: 18,
    zoomMin: 18,
    zoomMax: 55,
    digitalZoom: 1,
    focus: 75,
    subjectFocusIdeal: 75,
    aimX: 0,
    aimY: 0,
    sceneScale: 1,
    panXPercent: 0,
    panYPercent: 0,
    scenes: [
        { name: "Cena 1", bg: "Imagens/Cena 1/Fundo.png", subject: "Imagens/Cena 1/Assunto.png" },
        { name: "Cena 2", bg: "Imagens/Cena 2/Fundo.png", subject: "Imagens/Cena 2/Assunto.png" }
    ],
    sceneIndex: 0
};

const shutterStops = [
    1 / 4000,
    1 / 2000,
    1 / 1000,
    1 / 500,
    1 / 250,
    1 / 125,
    1 / 60,
    1 / 30,
    1 / 15,
    1 / 8,
    1 / 4,
    1 / 2,
    1
];

const modeInfo = {
    P: "Modo P: voce controla o ISO. A camera equilibra abertura e obturador automaticamente.",
    Av: "Modo Av: voce escolhe o diafragma. A camera ajusta o obturador para manter exposicao.",
    Tv: "Modo Tv: voce escolhe o obturador. A camera ajusta o diafragma automaticamente.",
    M: "Modo Manual: voce controla ISO, abertura e obturador para ver o resultado direto."
};

const els = {
    cameraFrame: document.getElementById("cameraFrame"),
    cameraHud: document.getElementById("cameraHud"),
    photoMask: document.getElementById("photoMask"),
    sceneContent: document.getElementById("sceneContent"),
    bg: document.querySelector(".layer-bg"),
    subject: document.querySelector(".layer-subject"),
    modeButtons: Array.from(document.querySelectorAll(".mode-btn")),
    sceneSelect: document.getElementById("sceneSelect"),
    zoom: document.getElementById("zoom"),
    digitalZoom: document.getElementById("digitalZoom"),
    focus: document.getElementById("focus"),
    iso: document.getElementById("iso"),
    aperture: document.getElementById("aperture"),
    shutter: document.getElementById("shutter"),
    zoomValue: document.getElementById("zoomValue"),
    digitalZoomValue: document.getElementById("digitalZoomValue"),
    focusValue: document.getElementById("focusValue"),
    isoValue: document.getElementById("isoValue"),
    apertureValue: document.getElementById("apertureValue"),
    shutterValue: document.getElementById("shutterValue"),
    hudIso: document.getElementById("hudIso"),
    hudAperture: document.getElementById("hudAperture"),
    hudShutter: document.getElementById("hudShutter"),
    hudFocal: document.getElementById("hudFocal"),
    hudEv: document.getElementById("hudEv"),
    dateTimeOverlay: document.getElementById("dateTimeOverlay"),
    lessonText: document.getElementById("lessonText"),
    isoNoise: document.getElementById("isoNoise"),
    snapBtn: document.getElementById("snapBtn"),
    shutterOverlay: document.getElementById("shutterOverlay")
};

const dragAim = { active: false, pointerId: null, lastX: 0, lastY: 0 };

function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
function roundToTenth(v) { return Math.round(v * 10) / 10; }

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFocusAwayFromIdeal(idealFocus, minDistance = 15) {
    const safeIdeal = clamp(Math.round(idealFocus), 0, 100);
    const lowMax = safeIdeal - minDistance;
    const highMin = safeIdeal + minDistance;

    const ranges = [];
    if (lowMax >= 0) ranges.push([0, lowMax]);
    if (highMin <= 100) ranges.push([highMin, 100]);

    if (ranges.length === 0) {
        return randomInt(0, 100);
    }
    const picked = ranges[randomInt(0, ranges.length - 1)];
    return randomInt(picked[0], picked[1]);
}

function formatDateTime(d) {
    return `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

function formatShutter(seconds) {
    if (seconds >= 1) {
        return Number.isInteger(seconds) ? `${seconds}s` : `${seconds.toFixed(1)}s`;
    }
    return `1/${Math.round(1 / seconds)}`;
}

function findNearestShutter(target) {
    let best = shutterStops[0];
    let bestDiff = Math.abs(Math.log2(target) - Math.log2(best));
    for (const stop of shutterStops) {
        const diff = Math.abs(Math.log2(target) - Math.log2(stop));
        if (diff < bestDiff) {
            best = stop;
            bestDiff = diff;
        }
    }
    return best;
}

function describeExposure(deltaStops) {
    if (deltaStops > 1.2) return "Imagem superexposta: luz em excesso, altas luzes estouradas.";
    if (deltaStops > 0.4) return "Um pouco clara demais: reduza ISO, feche o diafragma ou use obturador mais rapido.";
    if (deltaStops < -1.2) return "Imagem subexposta: falta luz, sombras fechadas.";
    if (deltaStops < -0.4) return "Um pouco escura: aumente ISO, abra o diafragma ou use obturador mais lento.";
    return "Exposicao equilibrada: bom ponto para comparar os efeitos de cada parametro.";
}

function pickProgramAperture(evAtCurrentIso) {
    const zoomSpan = Math.max(1, state.zoomMax - state.zoomMin);
    const zoomProgress = clamp((state.focal - state.zoomMin) / zoomSpan, 0, 1);
    const fromZoom = 3.6 + zoomProgress * 3.4;
    const idealForTargetShutter = Math.sqrt((2 ** evAtCurrentIso) * (1 / 125));
    return roundToTenth(clamp(fromZoom * 0.55 + idealForTargetShutter * 0.45, 2.8, 11));
}

function solveExposureForMode() {
    const evTargetAtIso100 = state.sceneEV;
    if (state.mode === "P") {
        const evAtCurrentIso = evTargetAtIso100 + Math.log2(state.iso / 100);
        state.aperture = pickProgramAperture(evAtCurrentIso);
        const idealShutter = (state.aperture ** 2) / (2 ** evAtCurrentIso);
        state.shutter = findNearestShutter(clamp(idealShutter, shutterStops[0], shutterStops.at(-1)));
    }
    if (state.mode === "Av") {
        state.iso = 100;
        const idealShutter = (state.aperture ** 2) / (2 ** evTargetAtIso100);
        state.shutter = findNearestShutter(clamp(idealShutter, shutterStops[0], shutterStops.at(-1)));
    }
    if (state.mode === "Tv") {
        state.iso = 100;
        const idealAperture = Math.sqrt((2 ** evTargetAtIso100) * state.shutter);
        state.aperture = roundToTenth(clamp(idealAperture, 1.8, 16));
    }
}

function computeExposureDeltaStops() {
    const effectiveEV = Math.log2((state.aperture ** 2) / state.shutter) - Math.log2(state.iso / 100);
    return state.sceneEV - effectiveEV;
}

function applyDigitalZoomRules() {
    const canUseDigitalZoom = state.focal >= state.zoomMax;
    if (!canUseDigitalZoom) {
        state.digitalZoom = 1;
    }
    state.digitalZoom = clamp(state.digitalZoom, 1, 2.5);
    els.digitalZoom.disabled = !canUseDigitalZoom;
}

function applyLivePreview() {
    const deltaStops = computeExposureDeltaStops();
    const overStops = Math.max(0, deltaStops);
    const underStops = Math.max(0, -deltaStops);
    // Curva assimetrica: cenas subexpostas escurecem mais rapido para parecer mais realista.
    const brightness = clamp((1 + overStops * 0.23) / (1 + underStops * 0.95), 0.14, 2.2);
    const contrast = clamp(1 + overStops * 0.08 + underStops * 0.03, 0.9, 1.45);
    const isNightScene = state.sceneIndex === 1;
    // Evita "neon" em superexposicao: ao clarear, saturacao cai levemente.
    const saturationBoost = deltaStops < 0 ? Math.abs(deltaStops) * 0.015 : 0;
    const saturationCut = deltaStops > 0 ? deltaStops * (isNightScene ? 0.18 : 0.1) : 0;
    const baseSaturation = isNightScene ? 0.92 : 1;
    const saturation = clamp(baseSaturation + saturationBoost - saturationCut, 0.62, 1.08);
    const dofStrength = clamp((5.6 - state.aperture) * 1.7, 0, 6);
    const shutterBlur = clamp(Math.max(0, Math.log2(state.shutter / (1 / 125))) * 0.35, 0, 1.2);
    const digitalLoss = Math.max(0, state.digitalZoom - 1);
    const digitalBlur = clamp(digitalLoss * 0.42, 0, 1.25);
    const detailContrast = clamp(1 - digitalLoss * 0.03, 0.88, 1);
    const focusAlignment = 1 - clamp(Math.abs(state.focus - state.subjectFocusIdeal) / 100, 0, 1);
    const farFocusAlignment = 1 - clamp(state.focus / 100, 0, 1);
    const noise = clamp((state.iso - 100) / 6300, 0, 1);

    // Em foco "Longe", o fundo deve poder ficar sempre nitido.
    const bgBlur = dofStrength * (1 - farFocusAlignment) * 1.2 + shutterBlur * 0.25 + digitalBlur * 0.6;
    // O assunto fica nitido quando o foco se aproxima do valor ideal da cena.
    const subjectBlur = dofStrength * (1 - focusAlignment) * 1.4 + shutterBlur * 0.4 + digitalBlur * 0.8;

    els.bg.style.filter = `brightness(${brightness}) contrast(${(contrast * detailContrast).toFixed(3)}) saturate(${saturation}) blur(${bgBlur.toFixed(2)}px)`;
    els.subject.style.filter = `brightness(${clamp(brightness + 0.05, 0.4, 2.6)}) contrast(${(contrast * detailContrast).toFixed(3)}) saturate(${saturation}) blur(${subjectBlur.toFixed(2)}px)`;
    const pixelated = digitalLoss > 0.85 ? "pixelated" : "auto";
    els.bg.style.imageRendering = pixelated;
    els.subject.style.imageRendering = pixelated;

    const zoomSpan = Math.max(1, state.zoomMax - state.zoomMin);
    const zoomProgress = clamp((state.focal - state.zoomMin) / zoomSpan, 0, 1);
    const opticalScale = 1 + zoomProgress * 1.05;
    state.sceneScale = clamp(opticalScale * state.digitalZoom, 1, 8.2);
    const maxPanPercent = Math.max((state.sceneScale - 1) * 50, 0);
    state.panXPercent = (state.aimX / 100) * maxPanPercent;
    state.panYPercent = (state.aimY / 100) * maxPanPercent;
    els.sceneContent.style.transform = `translate(${state.panXPercent.toFixed(2)}%, ${state.panYPercent.toFixed(2)}%) scale(${state.sceneScale})`;

    const resolutionNoise = clamp(digitalLoss * 0.06, 0, 0.16);
    els.isoNoise.style.opacity = clamp(noise * 0.68 + resolutionNoise, 0, 0.92).toFixed(2);
    els.isoNoise.style.filter = `grayscale(1) contrast(${1 + noise * 1.12})`;
    const grainSize = Math.round(92 + digitalLoss * 36);
    els.isoNoise.style.backgroundSize = `${grainSize}px ${grainSize}px`;
    els.hudEv.textContent = `${deltaStops > 0 ? "+" : ""}${deltaStops.toFixed(1)}`;
}

function applyControlLocking() {
    const locks = { P: [false, true, true], Av: [true, false, true], Tv: [true, true, false], M: [false, false, false] }[state.mode];
    els.iso.disabled = locks[0];
    els.aperture.disabled = locks[1];
    els.shutter.disabled = locks[2];
}

function syncOutputs() {
    els.zoomValue.textContent = `${state.focal}mm`;
    els.digitalZoomValue.textContent = `${state.digitalZoom.toFixed(1)}x`;
    els.focusValue.textContent = state.focus >= 50 ? "Perto" : "Longe";
    els.isoValue.textContent = `${state.iso}`;
    els.apertureValue.textContent = state.aperture.toFixed(1);
    els.shutterValue.textContent = formatShutter(state.shutter);
    els.hudIso.textContent = `${state.iso}`;
    els.hudAperture.textContent = state.aperture.toFixed(1);
    els.hudShutter.textContent = formatShutter(state.shutter);
    els.hudFocal.textContent = state.digitalZoom > 1 ? `${state.focal}mm ${state.digitalZoom.toFixed(1)}x` : `${state.focal}mm`;
    els.dateTimeOverlay.textContent = formatDateTime(new Date());
    els.lessonText.textContent = `${modeInfo[state.mode]} ${describeExposure(computeExposureDeltaStops())}`;

    const shutterIndex = shutterStops.findIndex((v) => v === state.shutter);
    if (shutterIndex >= 0) els.shutter.value = String(shutterIndex);
    els.iso.value = String(state.iso);
    els.aperture.value = String(state.aperture);
    els.zoom.value = String(state.focal);
    els.digitalZoom.value = String(state.digitalZoom);
    els.focus.value = String(state.focus);
}

function updateAimByDrag(clientX, clientY) {
    const rect = els.photoMask.getBoundingClientRect();
    state.aimX = clamp(Math.round(state.aimX + ((clientX - dragAim.lastX) / rect.width) * 110), -100, 100);
    state.aimY = clamp(Math.round(state.aimY + ((clientY - dragAim.lastY) / rect.height) * 110), -100, 100);
    dragAim.lastX = clientX;
    dragAim.lastY = clientY;
    update();
}

function drawSceneLayer(ctx, imgEl, filter, maskRect) {
    const centerX = maskRect.x + maskRect.w / 2;
    const centerY = maskRect.y + maskRect.h / 2;
    const panPxX = (state.panXPercent / 100) * maskRect.w;
    const panPxY = (state.panYPercent / 100) * maskRect.h;
    ctx.save();
    ctx.beginPath();
    ctx.rect(maskRect.x, maskRect.y, maskRect.w, maskRect.h);
    ctx.clip();
    ctx.translate(centerX + panPxX, centerY + panPxY);
    ctx.scale(state.sceneScale, state.sceneScale);
    ctx.filter = filter === "none" ? "none" : filter;
    ctx.drawImage(imgEl, -maskRect.w / 2, -maskRect.h / 2, maskRect.w, maskRect.h);
    ctx.restore();
}

function drawHudOnCanvas(ctx, width, height, hudHeight, dateText) {
    const hudTop = height - hudHeight;
    ctx.save();
    ctx.fillStyle = "#050505";
    ctx.fillRect(0, hudTop, width, hudHeight);
    ctx.strokeStyle = "#1e1f14";
    ctx.beginPath();
    ctx.moveTo(0, hudTop + 0.5);
    ctx.lineTo(width, hudTop + 0.5);
    ctx.stroke();

    const items = [`ISO ${state.iso}`, `f ${state.aperture.toFixed(1)}`, `s ${formatShutter(state.shutter)}`, `ZOOM ${state.focal}mm`, `EV ${els.hudEv.textContent}`];
    const step = width / items.length;
    ctx.fillStyle = "#9dff00";
    ctx.font = "600 22px Orbitron, monospace";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    items.forEach((text, i) => ctx.fillText(text, i * step + 18, hudTop + hudHeight / 2 + 1));

    ctx.fillStyle = "#ffffff";
    ctx.font = "700 30px Outfit, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(dateText, width - 18, 28);
    ctx.restore();
}

async function ensureImageReady(img) {
    if (img.complete && img.naturalWidth > 0) return;
    try {
        await img.decode();
    } catch (_err) {
        await new Promise((resolve) => {
            img.addEventListener("load", resolve, { once: true });
            img.addEventListener("error", resolve, { once: true });
        });
    }
}

function dataUrlToBlob(dataUrl) {
    const parts = dataUrl.split(",");
    const mime = (parts[0].match(/data:(.*?);base64/) || [])[1] || "image/png";
    const binary = atob(parts[1] || "");
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
}

async function canvasToPngBlob(canvas) {
    try {
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
        if (blob && blob.size > 128) {
            return blob;
        }
    } catch (_err) {
        // Fallback handled below.
    }

    const dataUrl = canvas.toDataURL("image/png");
    const fallbackBlob = dataUrlToBlob(dataUrl);
    if (fallbackBlob.size > 128) {
        return fallbackBlob;
    }

    return null;
}

function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function writeWithFileHandle(fileHandle, blob) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const writable = await fileHandle.createWritable();
    await writable.write(bytes);
    await writable.close();
}

async function buildPhotoBlobWithHud() {
    const frameRect = els.cameraFrame.getBoundingClientRect();
    const maskRect = els.photoMask.getBoundingClientRect();
    const hudHeight = els.cameraHud.getBoundingClientRect().height;

    await ensureImageReady(els.bg);
    await ensureImageReady(els.subject);

    const canvas = document.createElement("canvas");
    const scale = 2;
    canvas.width = Math.max(1, Math.round(frameRect.width * scale));
    canvas.height = Math.max(1, Math.round(frameRect.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.scale(scale, scale);
    ctx.fillStyle = "#050505";
    ctx.fillRect(0, 0, frameRect.width, frameRect.height);

    const localMask = { x: maskRect.left - frameRect.left, y: maskRect.top - frameRect.top, w: maskRect.width, h: maskRect.height };
    drawSceneLayer(ctx, els.bg, getComputedStyle(els.bg).filter, localMask);
    drawSceneLayer(ctx, els.subject, getComputedStyle(els.subject).filter, localMask);

    ctx.strokeStyle = "rgba(225,236,255,0.75)";
    ctx.lineWidth = 2;
    ctx.strokeRect(localMask.x, localMask.y, localMask.w, localMask.h);

    const dateText = formatDateTime(new Date());
    els.dateTimeOverlay.textContent = dateText;
    drawHudOnCanvas(ctx, frameRect.width, frameRect.height, hudHeight, dateText);

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `foto-arcade-${state.mode}_ISO${state.iso}_F${state.aperture.toFixed(1)}_S${formatShutter(state.shutter).replace("/", "-")}_${state.focal}mm-${stamp}.png`;
    const blob = await canvasToPngBlob(canvas);
    if (!blob) {
        throw new Error("Nao foi possivel gerar o PNG.");
    }

    return { blob, fileName };
}

function applyScene(index) {
    const scene = state.scenes[index];
    if (!scene) return;
    state.sceneIndex = index;
    state.subjectFocusIdeal = clamp(scene.idealFocus ?? 75, 0, 100);
    state.focus = randomFocusAwayFromIdeal(state.subjectFocusIdeal);
    state.zoomMin = clamp(scene.zoomMin ?? 18, 18, 55);
    state.zoomMax = clamp(scene.zoomMax ?? 55, state.zoomMin, 55);
    els.zoom.min = String(state.zoomMin);
    els.zoom.max = String(state.zoomMax);
    state.focal = clamp(state.focal, state.zoomMin, state.zoomMax);
    els.bg.src = scene.bg;
    els.subject.src = scene.subject;
    els.sceneSelect.value = String(index);
}

function refreshSceneSelect() {
    els.sceneSelect.innerHTML = "";
    state.scenes.forEach((scene, idx) => {
        const option = document.createElement("option");
        option.value = String(idx);
        option.textContent = scene.name;
        els.sceneSelect.appendChild(option);
    });
    els.sceneSelect.value = String(state.sceneIndex);
}

function imageExists(src) {
    return new Promise((resolve) => {
        const probe = new Image();
        probe.onload = () => resolve(true);
        probe.onerror = () => resolve(false);
        probe.src = src;
    });
}

async function readIdealFocusForScene(sceneNumber) {
    const focusFile = `Imagens/Cena ${sceneNumber}/FocoIdeal.txt`;
    try {
        const response = await fetch(focusFile, { cache: "no-store" });
        if (!response.ok) return 75;
        const raw = (await response.text()).trim();
        const parsed = Number(raw.replace(",", "."));
        if (!Number.isFinite(parsed)) return 75;
        return clamp(Math.round(parsed), 0, 100);
    } catch (_err) {
        return 75;
    }
}

function parseZoomRange(rawText) {
    const raw = (rawText || "").trim();
    if (!raw) return { min: 18, max: 55 };
    const parts = raw
        .replace(/[;|]/g, "-")
        .replace(/,/g, ".")
        .split(/\s*-\s*|\s+/)
        .filter(Boolean);
    if (parts.length < 2) return { min: 18, max: 55 };

    const a = Number(parts[0]);
    const b = Number(parts[1]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return { min: 18, max: 55 };

    const min = clamp(Math.round(Math.min(a, b)), 18, 55);
    const max = clamp(Math.round(Math.max(a, b)), min, 55);
    return { min, max };
}

async function readZoomRangeForScene(sceneNumber) {
    const rangeFile = `Imagens/Cena ${sceneNumber}/ZoomRange.txt`;
    try {
        const response = await fetch(rangeFile, { cache: "no-store" });
        if (!response.ok) return { min: 18, max: 55 };
        const raw = await response.text();
        return parseZoomRange(raw);
    } catch (_err) {
        return { min: 18, max: 55 };
    }
}

async function discoverScenes(maxScenes = 50) {
    const discovered = [];

    for (let i = 1; i <= maxScenes; i += 1) {
        const bg = `Imagens/Cena ${i}/Fundo.png`;
        const subject = `Imagens/Cena ${i}/Assunto.png`;
        const [hasBg, hasSubject] = await Promise.all([imageExists(bg), imageExists(subject)]);

        if (hasBg && hasSubject) {
            const [idealFocus, zoomRange] = await Promise.all([
                readIdealFocusForScene(i),
                readZoomRangeForScene(i)
            ]);
            discovered.push({
                name: `Cena ${i}`,
                bg,
                subject,
                idealFocus,
                zoomMin: zoomRange.min,
                zoomMax: zoomRange.max
            });
        } else {
            if (discovered.length > 0) {
                break;
            }
        }
    }

    return discovered;
}

async function initScenes() {
    const discovered = await discoverScenes();
    if (discovered.length > 0) {
        state.scenes = discovered;
    }
    state.sceneIndex = clamp(state.sceneIndex, 0, Math.max(0, state.scenes.length - 1));
    refreshSceneSelect();
    applyScene(state.sceneIndex);
}

function update() {
    applyDigitalZoomRules();
    solveExposureForMode();
    applyControlLocking();
    syncOutputs();
    applyLivePreview();
}

els.modeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
        state.mode = btn.dataset.mode;
        els.modeButtons.forEach((other) => {
            const isActive = other === btn;
            other.classList.toggle("active", isActive);
            other.setAttribute("aria-checked", isActive ? "true" : "false");
        });
        update();
    });
});

els.sceneSelect.addEventListener("change", (e) => {
    applyScene(Number(e.target.value));
    update();
});

els.zoom.addEventListener("input", (e) => { state.focal = Number(e.target.value); update(); });
els.digitalZoom.addEventListener("input", (e) => { state.digitalZoom = Number(e.target.value); update(); });
els.focus.addEventListener("input", (e) => { state.focus = Number(e.target.value); update(); });
els.iso.addEventListener("input", (e) => { state.iso = Number(e.target.value); update(); });
els.aperture.addEventListener("input", (e) => { state.aperture = Number(e.target.value); update(); });
els.shutter.addEventListener("input", (e) => { state.shutter = shutterStops[Number(e.target.value)]; update(); });

els.photoMask.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    els.photoMask.classList.add("aiming");
    try { els.photoMask.setPointerCapture(e.pointerId); } catch (_err) { }
    dragAim.active = true;
    dragAim.pointerId = e.pointerId;
    dragAim.lastX = e.clientX;
    dragAim.lastY = e.clientY;
});

els.photoMask.addEventListener("pointermove", (e) => {
    if (dragAim.active && dragAim.pointerId === e.pointerId) updateAimByDrag(e.clientX, e.clientY);
});

els.photoMask.addEventListener("pointerup", (e) => {
    if (dragAim.pointerId === e.pointerId) {
        dragAim.active = false;
        dragAim.pointerId = null;
    }
    els.photoMask.classList.remove("aiming");
});

els.photoMask.addEventListener("pointercancel", () => {
    dragAim.active = false;
    dragAim.pointerId = null;
    els.photoMask.classList.remove("aiming");
});

els.photoMask.addEventListener("wheel", (e) => {
    e.preventDefault();
    state.focal = clamp(state.focal + (e.deltaY < 0 ? 1 : -1), state.zoomMin, state.zoomMax);
    update();
}, { passive: false });

els.snapBtn.addEventListener("click", async () => {
    let fileHandle = null;
    if (typeof window.showSaveFilePicker === "function") {
        try {
            const stamp = new Date().toISOString().replace(/[:.]/g, "-");
            const suggestedName = `foto-arcade-${state.mode}_ISO${state.iso}_F${state.aperture.toFixed(1)}_S${formatShutter(state.shutter).replace("/", "-")}_${state.focal}mm-${stamp}.png`;
            fileHandle = await window.showSaveFilePicker({
                suggestedName,
                types: [{ description: "Imagem PNG", accept: { "image/png": [".png"] } }]
            });
        } catch (_err) {
            fileHandle = null;
        }
    }

    try {
        const { blob, fileName } = await buildPhotoBlobWithHud();
        let saved = false;

        if (fileHandle) {
            try {
                await writeWithFileHandle(fileHandle, blob);
                saved = true;
            } catch (_err) {
                // Se escrita falhar, cai para download.
            }
        }

        if (!saved) {
            // Tenta download direto sem abrir nova guia.
            try {
                downloadBlob(blob, fileName);
                saved = true;
            } catch (_err) {
                saved = false;
            }

            if (!saved) {
                throw new Error("Nao foi possivel iniciar o download.");
            }
        }
    } catch (_err) {
        alert("Nao foi possivel salvar a foto. Tente novamente.");
    }

    els.shutterOverlay.classList.remove("fire");
    void els.shutterOverlay.offsetWidth;
    els.shutterOverlay.classList.add("fire");
});

els.shutter.max = String(shutterStops.length - 1);
setInterval(() => { els.dateTimeOverlay.textContent = formatDateTime(new Date()); }, 1000);

initScenes().finally(() => {
    update();
});
